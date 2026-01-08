import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

// ============================================
// POST /api/check-meter-coherence
// Pre-check if test photo matches the model type
// ============================================

export async function POST(request: Request) {
  try {
    const { testPhoto, modelId } = await request.json()
    
    if (!testPhoto || !modelId) {
      return NextResponse.json(
        { error: 'testPhoto and modelId required' }, 
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 1. Get the model info
    const { data: model, error: modelError } = await supabase
      .from('meter_models')
      .select('id, name, manufacturer, meter_type, reference_photos')
      .eq('id', modelId)
      .single()

    if (modelError || !model) {
      return NextResponse.json(
        { error: 'Model not found' }, 
        { status: 404 }
      )
    }

    // If no reference photo, skip coherence check
    if (!model.reference_photos || model.reference_photos.length === 0) {
      return NextResponse.json({
        isCoherent: true,
        confidence: 1.0,
        reason: 'No reference photo to compare',
        skipped: true
      })
    }

    // 2. Use Claude Vision to compare test photo with reference
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })

    const prompt = `Tu es un expert en reconnaissance de compteurs.

Compare ces deux images:
- Image 1 (référence): Photo de référence du modèle "${model.manufacturer || ''} ${model.name}" (type: ${model.meter_type})
- Image 2 (test): Photo à tester

Détermine si la photo de test montre le MÊME TYPE de compteur que la photo de référence.

Critères de comparaison:
- Même marque/fabricant
- Même modèle ou série
- Même type d'affichage
- Design similaire

Réponds UNIQUEMENT avec un JSON valide:
{
  "isCoherent": true/false,
  "confidence": 0.0 à 1.0,
  "reason": "Explication courte"
}

isCoherent = true si c'est bien le même type de compteur
isCoherent = false si c'est un compteur différent`

    // Fetch reference photo
    let referencePhotoBase64: string
    const refPhotoUrl = model.reference_photos[0]
    
    if (refPhotoUrl.startsWith('http')) {
      // Fetch from URL
      const refResponse = await fetch(refPhotoUrl)
      const refBuffer = await refResponse.arrayBuffer()
      referencePhotoBase64 = Buffer.from(refBuffer).toString('base64')
    } else {
      // Assume it's already base64
      referencePhotoBase64 = refPhotoUrl
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Image 1 (référence):'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: referencePhotoBase64
              }
            },
            {
              type: 'text',
              text: 'Image 2 (test):'
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: testPhoto
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
      return NextResponse.json({
        isCoherent: true,
        confidence: 0.5,
        reason: 'Could not analyze',
        skipped: true
      })
    }

    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return NextResponse.json({
          isCoherent: true,
          confidence: 0.5,
          reason: 'Parse error',
          skipped: true
        })
      }

      const result = JSON.parse(jsonMatch[0])
      
      return NextResponse.json({
        isCoherent: result.isCoherent,
        confidence: result.confidence,
        reason: result.reason,
        modelName: `${model.manufacturer || ''} ${model.name}`.trim(),
        modelType: model.meter_type
      })

    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json({
        isCoherent: true,
        confidence: 0.5,
        reason: 'Parse error',
        skipped: true
      })
    }

  } catch (error) {
    console.error('Check coherence error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
