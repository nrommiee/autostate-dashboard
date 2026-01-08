import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { photo_base64, detected_name, detected_manufacturer, detected_type } = await request.json()

    if (!photo_base64) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    // Récupérer tous les modèles existants avec leurs photos
    const { data: models, error } = await supabase
      .from('meter_models')
      .select('id, name, manufacturer, meter_type, reference_photos')
      .not('reference_photos', 'is', null)

    if (error) throw error

    // Filtrer les modèles qui ont au moins une photo
    const modelsWithPhotos = (models || []).filter(m => 
      m.reference_photos && m.reference_photos.length > 0
    )

    if (modelsWithPhotos.length === 0) {
      return NextResponse.json({ 
        isDuplicate: false, 
        matchedModel: null,
        confidence: 0 
      })
    }

    // Préparer les images pour Claude (max 5 modèles pour limiter les tokens)
    const modelsToCompare = modelsWithPhotos.slice(0, 10)
    
    // Construire le contenu pour Claude
    const content: any[] = [
      {
        type: 'text',
        text: `Tu es un expert en identification de compteurs. 

NOUVELLE PHOTO À ANALYSER:
- Nom détecté: ${detected_name || 'Non détecté'}
- Fabricant détecté: ${detected_manufacturer || 'Non détecté'}
- Type détecté: ${detected_type || 'Non détecté'}

Voici la photo du nouveau compteur:`
      },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: photo_base64
        }
      },
      {
        type: 'text',
        text: `\n\nVoici les modèles existants dans la base de données. Compare la nouvelle photo avec chacun:\n`
      }
    ]

    // Ajouter chaque modèle existant avec sa photo
    for (let i = 0; i < modelsToCompare.length; i++) {
      const model = modelsToCompare[i]
      const photoUrl = model.reference_photos[0]
      
      content.push({
        type: 'text',
        text: `\n--- MODÈLE ${i + 1}: "${model.name}" (${model.manufacturer || 'Fabricant inconnu'}) - Type: ${model.meter_type} ---`
      })

      // Si c'est une URL, on l'ajoute comme référence
      if (photoUrl.startsWith('http')) {
        content.push({
          type: 'image',
          source: {
            type: 'url',
            url: photoUrl
          }
        })
      }
    }

    content.push({
      type: 'text',
      text: `

ANALYSE DEMANDÉE:
Compare la nouvelle photo avec tous les modèles existants ci-dessus.

Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "isDuplicate": true/false,
  "matchedModelIndex": numéro du modèle (1-${modelsToCompare.length}) ou null si pas de match,
  "confidence": pourcentage de 0 à 100,
  "reason": "explication courte"
}

Un compteur est considéré comme DOUBLON si:
- C'est le MÊME modèle exact (même marque, même référence)
- Pas juste un compteur similaire ou de la même famille

Sois strict: ne retourne isDuplicate=true que si tu es sûr à plus de 80% que c'est le même modèle exact.`
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ isDuplicate: false, matchedModel: null, confidence: 0 })
    }

    // Parser la réponse JSON
    let result
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found')
      }
    } catch {
      return NextResponse.json({ isDuplicate: false, matchedModel: null, confidence: 0 })
    }

    // Si doublon détecté, retourner les infos du modèle correspondant
    if (result.isDuplicate && result.matchedModelIndex) {
      const matchedModel = modelsToCompare[result.matchedModelIndex - 1]
      return NextResponse.json({
        isDuplicate: true,
        matchedModel: {
          id: matchedModel.id,
          name: matchedModel.name,
          manufacturer: matchedModel.manufacturer,
          meter_type: matchedModel.meter_type,
          photo: matchedModel.reference_photos[0]
        },
        confidence: result.confidence,
        reason: result.reason
      })
    }

    return NextResponse.json({
      isDuplicate: false,
      matchedModel: null,
      confidence: result.confidence || 0,
      reason: result.reason
    })

  } catch (error) {
    console.error('Check duplicate error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification' },
      { status: 500 }
    )
  }
}
