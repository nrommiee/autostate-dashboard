import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Classify a single meter photo - try to match with existing models AND extract data
export async function POST(request: NextRequest) {
  try {
    const { photo } = await request.json()

    if (!photo) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    // Get all active models for matching
    const { data: models } = await supabase
      .from('meter_models')
      .select('id, name, manufacturer, meter_type, ai_description, reading_zones')
      .in('status', ['active', 'draft'])
      .order('name')

    // Build model list for Claude (if any models exist)
    const modelsList = (models || []).map((m, i) => 
      `${i + 1}. ${m.name} (${m.manufacturer || 'Fabricant inconnu'}) - Type: ${m.meter_type}`
    ).join('\n')

    const hasModels = models && models.length > 0

    // Ask Claude to identify and extract data
    const prompt = `Tu es un expert en compteurs d'énergie (gaz, électricité, eau). Analyse cette photo de compteur.

${hasModels ? `MODÈLES CONNUS:
${modelsList}

Si tu reconnais un de ces modèles, indique son numéro (1-${models!.length}). Sinon, indique 0.` : 'Aucun modèle connu dans la base.'}

TÂCHES:
1. ${hasModels ? `Identifie si la photo correspond à un modèle connu (numéro 1-${models!.length}, ou 0 si aucun)` : 'Identifie le type de compteur'}
2. Extrais TOUTES les données visibles :
   - Numéro de série / matricule
   - Index de consommation (avec décimales si présentes)
   - Code EAN si visible
   - Tout autre chiffre pertinent
3. Évalue ta confiance pour chaque donnée extraite (0.0 à 1.0)

RÉPONDS EN JSON STRICT (sans markdown):
{
  "matched_model_index": ${hasModels ? '0-' + models!.length : '0'},
  "confidence": 0.0-1.0,
  "meter_type_detected": "gas|electricity|water|other",
  "extracted_data": {
    "serial": {"value": "numéro de série ou null", "confidence": 0.0-1.0},
    "reading": {"value": "index principal ou null", "confidence": 0.0-1.0},
    "reading_day": {"value": "index jour si bi-horaire ou null", "confidence": 0.0-1.0},
    "reading_night": {"value": "index nuit si bi-horaire ou null", "confidence": 0.0-1.0},
    "ean": {"value": "code EAN ou null", "confidence": 0.0-1.0}
  },
  "meter_description": "description courte du compteur identifié",
  "notes": "observations éventuelles"
}`

    const startTime = Date.now()
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo } },
          { type: 'text', text: prompt }
        ]
      }]
    })

    const processingTime = Date.now() - startTime
    const textContent = response.content.find(c => c.type === 'text')
    
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response from Claude')
    }

    // Parse JSON response
    let result
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      result = null
    }

    if (!result) {
      return NextResponse.json({
        matchedModel: null,
        extractedData: null,
        confidence: 0,
        error: 'Impossible d\'analyser la réponse',
        tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
        processingTime
      })
    }

    // Get matched model
    const matchedModelIndex = result.matched_model_index
    const matchedModel = hasModels && matchedModelIndex > 0 && matchedModelIndex <= models!.length 
      ? models![matchedModelIndex - 1] 
      : null

    // Clean extracted data - remove null values
    const cleanExtractedData: Record<string, { value: string; confidence: number }> = {}
    if (result.extracted_data) {
      Object.entries(result.extracted_data).forEach(([key, val]: [string, any]) => {
        if (val && val.value && val.value !== 'null' && val.value !== null) {
          cleanExtractedData[key] = {
            value: String(val.value),
            confidence: val.confidence || 0.5
          }
        }
      })
    }

    return NextResponse.json({
      matchedModel: matchedModel ? {
        id: matchedModel.id,
        name: matchedModel.name,
        manufacturer: matchedModel.manufacturer,
        meter_type: matchedModel.meter_type
      } : null,
      extractedData: Object.keys(cleanExtractedData).length > 0 ? cleanExtractedData : null,
      confidence: result.confidence || 0,
      meterTypeDetected: result.meter_type_detected,
      meterDescription: result.meter_description,
      notes: result.notes,
      tokens: { 
        input: response.usage.input_tokens, 
        output: response.usage.output_tokens 
      },
      processingTime
    })

  } catch (error: any) {
    console.error('Classify meter error:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la classification' },
      { status: 500 }
    )
  }
}
