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

// Classify a single meter photo - try to match with existing models
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

    if (!models || models.length === 0) {
      return NextResponse.json({
        matchedModel: null,
        extractedData: null,
        confidence: 0,
        message: 'Aucun modèle disponible'
      })
    }

    // Build model list for Claude
    const modelsList = models.map((m, i) => 
      `${i + 1}. ${m.name} (${m.manufacturer || 'Fabricant inconnu'}) - Type: ${m.meter_type}`
    ).join('\n')

    // Ask Claude to identify and extract data
    const prompt = `Tu es un expert en compteurs d'énergie. Analyse cette photo de compteur.

MODÈLES DISPONIBLES:
${modelsList}

TÂCHES:
1. Identifie quel modèle correspond le mieux (numéro 1-${models.length}, ou 0 si aucun ne correspond)
2. Extrais les données visibles (numéro de série, index, etc.)
3. Évalue ta confiance (0.0 à 1.0)

RÉPONDS EN JSON STRICT:
{
  "matched_model_index": 0-${models.length},
  "confidence": 0.0-1.0,
  "extracted_data": {
    "serial": {"value": "...", "confidence": 0.0-1.0},
    "reading": {"value": "...", "confidence": 0.0-1.0}
  },
  "meter_type_detected": "gas|electricity|water|other",
  "notes": "observations"
}`

    const startTime = Date.now()
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
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
        tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
        processingTime
      })
    }

    // Get matched model
    const matchedModelIndex = result.matched_model_index
    const matchedModel = matchedModelIndex > 0 && matchedModelIndex <= models.length 
      ? models[matchedModelIndex - 1] 
      : null

    return NextResponse.json({
      matchedModel: matchedModel ? {
        id: matchedModel.id,
        name: matchedModel.name,
        manufacturer: matchedModel.manufacturer,
        meter_type: matchedModel.meter_type
      } : null,
      extractedData: result.extracted_data || null,
      confidence: result.confidence || 0,
      meterTypeDetected: result.meter_type_detected,
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
