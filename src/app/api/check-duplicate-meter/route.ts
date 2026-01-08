import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// Helper to fetch image and convert to base64
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return base64
  } catch (error) {
    console.error('Error fetching image:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { photo_base64, detected_name, detected_manufacturer, detected_type } = await request.json()

    if (!photo_base64) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    // Create Supabase client inside the function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase env vars:', { url: !!supabaseUrl, key: !!supabaseKey })
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Récupérer tous les modèles existants avec leurs photos
    const { data: models, error } = await supabase
      .from('meter_models')
      .select('id, name, manufacturer, meter_type, reference_photos')
      .not('reference_photos', 'is', null)

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    // Filtrer les modèles qui ont au moins une photo
    const modelsWithPhotos = (models || []).filter(m => 
      m.reference_photos && m.reference_photos.length > 0
    )

    console.log(`Found ${modelsWithPhotos.length} models with photos`)

    if (modelsWithPhotos.length === 0) {
      return NextResponse.json({ 
        isDuplicate: false, 
        matchedModel: null,
        confidence: 0 
      })
    }

    // Limiter à 10 modèles pour éviter trop de tokens (mais plus que 5)
    const modelsToCompare = modelsWithPhotos.slice(0, 10)
    
    // Préparer les images existantes en base64
    const modelImages: { model: typeof modelsToCompare[0], base64: string }[] = []
    
    for (const model of modelsToCompare) {
      const photoUrl = model.reference_photos[0]
      if (photoUrl) {
        // Si c'est déjà en base64, l'utiliser directement
        if (photoUrl.startsWith('data:')) {
          modelImages.push({ model, base64: photoUrl.split(',')[1] })
        } else {
          const base64 = await urlToBase64(photoUrl)
          if (base64) {
            modelImages.push({ model, base64 })
          }
        }
      }
    }

    console.log(`Loaded ${modelImages.length} model images for comparison`)

    if (modelImages.length === 0) {
      return NextResponse.json({ 
        isDuplicate: false, 
        matchedModel: null,
        confidence: 0 
      })
    }

    // Construire le contenu pour Claude
    const content: any[] = [
      {
        type: 'text',
        text: `Tu es un expert en identification de compteurs d'énergie.

TÂCHE: Compare la NOUVELLE PHOTO avec les ${modelImages.length} modèles existants pour détecter si c'est un doublon.

NOUVELLE PHOTO À ANALYSER:
- Nom détecté: ${detected_name || 'Non détecté'}
- Fabricant détecté: ${detected_manufacturer || 'Non détecté'}
- Type détecté: ${detected_type || 'Non détecté'}`
      },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: photo_base64
        }
      }
    ]

    // Ajouter chaque modèle existant avec sa photo
    for (let i = 0; i < modelImages.length; i++) {
      const { model, base64 } = modelImages[i]
      
      content.push({
        type: 'text',
        text: `\n--- MODÈLE ${i + 1}: "${model.name}" (${model.manufacturer || 'Fabricant inconnu'}) - Type: ${model.meter_type} ---`
      })

      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: base64
        }
      })
    }

    content.push({
      type: 'text',
      text: `

ANALYSE DEMANDÉE:
Compare la NOUVELLE PHOTO (première image) avec tous les modèles existants ci-dessus.

Réponds UNIQUEMENT en JSON valide:
{
  "isDuplicate": true ou false,
  "matchedModelIndex": numéro du modèle (1-${modelImages.length}) ou null,
  "confidence": pourcentage de 0 à 100,
  "reason": "explication courte"
}

RÈGLES:
- isDuplicate = true si c'est le MÊME modèle exact ou très similaire (même marque, même design)
- Deux photos du même compteur physique = DOUBLON
- isDuplicate=true si confiance > 70%

JSON:`
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

    console.log('Claude response:', textContent.text)

    // Parser la réponse JSON
    let result
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found')
      }
    } catch (e) {
      console.error('JSON parse error:', textContent.text)
      return NextResponse.json({ isDuplicate: false, matchedModel: null, confidence: 0 })
    }

    // Si doublon détecté, retourner les infos du modèle correspondant
    if (result.isDuplicate && result.matchedModelIndex && result.matchedModelIndex >= 1 && result.matchedModelIndex <= modelImages.length) {
      const matchedModel = modelImages[result.matchedModelIndex - 1].model
      console.log(`Duplicate found: ${matchedModel.name} with ${result.confidence}% confidence`)
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
      { error: 'Erreur lors de la vérification', details: String(error) },
      { status: 500 }
    )
  }
}
