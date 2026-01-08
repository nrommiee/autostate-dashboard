import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

// ============================================
// POST /api/check-meter-duplicate
// Pre-check if a meter model already exists
// ============================================

export async function POST(request: Request) {
  try {
    const { photo } = await request.json()
    
    if (!photo) {
      return NextResponse.json({ error: 'Photo required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Get all active meter models with their reference photos
    const { data: models, error: modelsError } = await supabase
      .from('meter_models')
      .select('id, name, manufacturer, meter_type, reference_photos')
      .eq('is_active', true)
      .not('reference_photos', 'is', null)

    if (modelsError) {
      console.error('Error fetching models:', modelsError)
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
    }

    if (!models || models.length === 0) {
      return NextResponse.json({ 
        isDuplicate: false, 
        message: 'No existing models to compare' 
      })
    }

    // 2. Use Claude Vision to compare the uploaded photo with existing models
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })

    // Build comparison prompt with existing model photos
    const modelDescriptions = models
      .filter(m => m.reference_photos && m.reference_photos.length > 0)
      .map((m, i) => `Model ${i + 1}: ${m.manufacturer || ''} ${m.name} (${m.meter_type})`)
      .join('\n')

    const prompt = `Tu es un expert en reconnaissance de compteurs. 
    
Compare cette photo de compteur avec les modèles existants.

Modèles existants:
${modelDescriptions}

Analyse l'image fournie et détermine si c'est le même modèle qu'un des modèles existants.

Critères de comparaison:
- Marque/fabricant visible
- Forme et design du boîtier
- Type d'affichage (mécanique, digital)
- Disposition des éléments
- Couleurs caractéristiques

Réponds UNIQUEMENT avec un JSON valide:
{
  "isDuplicate": true/false,
  "matchedModelIndex": number ou null,
  "confidence": 0.0 à 1.0,
  "reason": "Explication courte"
}

Si isDuplicate est true, matchedModelIndex est l'index (1-based) du modèle correspondant.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: photo
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    })

    // Parse response
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ isDuplicate: false, message: 'No response from AI' })
    }

    try {
      // Extract JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return NextResponse.json({ isDuplicate: false, message: 'Could not parse AI response' })
      }

      const result = JSON.parse(jsonMatch[0])
      
      // If duplicate found, return model info
      if (result.isDuplicate && result.matchedModelIndex !== null) {
        const matchedModelIdx = result.matchedModelIndex - 1 // Convert to 0-based
        const activeModels = models.filter(m => m.reference_photos && m.reference_photos.length > 0)
        
        if (matchedModelIdx >= 0 && matchedModelIdx < activeModels.length) {
          const matchedModel = activeModels[matchedModelIdx]
          return NextResponse.json({
            isDuplicate: true,
            confidence: result.confidence,
            reason: result.reason,
            matchedModel: {
              id: matchedModel.id,
              name: matchedModel.name,
              manufacturer: matchedModel.manufacturer,
              meter_type: matchedModel.meter_type,
              referencePhoto: matchedModel.reference_photos[0]
            }
          })
        }
      }

      return NextResponse.json({
        isDuplicate: false,
        confidence: result.confidence,
        reason: result.reason
      })

    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json({ isDuplicate: false, message: 'Parse error' })
    }

  } catch (error) {
    console.error('Check duplicate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
