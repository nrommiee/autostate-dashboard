import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// Compress image to max 800px and JPEG quality 70
async function compressImage(base64: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64, 'base64')
    
    const compressed = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer()
    
    return compressed.toString('base64')
  } catch (err) {
    console.error('Compression error:', err)
    // Return original if compression fails
    return base64
  }
}

export async function POST(request: NextRequest) {
  console.log('=== CHECK DUPLICATE METER START ===')
  
  try {
    // 1. Parse request
    let body
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { photo_base64, detected_name, detected_manufacturer, detected_type } = body

    if (!photo_base64) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    // 2. Check env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    if (!supabaseUrl || !supabaseKey || !anthropicKey) {
      return NextResponse.json({ 
        error: 'Missing config',
        isDuplicate: false 
      }, { status: 500 })
    }

    // 3. Get ALL existing models
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: models, error: dbError } = await supabase
      .from('meter_models')
      .select('id, name, manufacturer, meter_type, reference_photos')
    
    if (dbError) {
      console.error('DB error:', dbError)
      return NextResponse.json({ 
        error: 'Database error',
        isDuplicate: false 
      }, { status: 500 })
    }

    // Filter models with photos
    const modelsWithPhotos = (models || []).filter(m => 
      m.reference_photos && 
      Array.isArray(m.reference_photos) && 
      m.reference_photos.length > 0 &&
      m.reference_photos[0]
    )

    console.log('Models with photos:', modelsWithPhotos.length)

    if (modelsWithPhotos.length === 0) {
      return NextResponse.json({ 
        isDuplicate: false, 
        matchedModel: null,
        confidence: 0,
        reason: 'Aucun modèle existant'
      })
    }

    // 4. Compress input photo
    console.log('Compressing input photo...')
    const compressedInput = await compressImage(photo_base64)
    console.log(`Input: ${photo_base64.length} -> ${compressedInput.length} bytes`)

    // 5. Load and compress ALL model images
    const modelImages: { model: typeof modelsWithPhotos[0], base64: string }[] = []
    
    for (const model of modelsWithPhotos) {
      const photoUrl = model.reference_photos[0]
      if (!photoUrl) continue
      
      try {
        let base64: string | null = null
        
        if (photoUrl.startsWith('data:')) {
          base64 = photoUrl.split(',')[1]
        } else if (photoUrl.startsWith('http')) {
          const imgResponse = await fetch(photoUrl)
          if (imgResponse.ok) {
            const arrayBuffer = await imgResponse.arrayBuffer()
            base64 = Buffer.from(arrayBuffer).toString('base64')
          }
        }
        
        if (base64) {
          // Compress the image
          const compressed = await compressImage(base64)
          console.log(`${model.name}: ${base64.length} -> ${compressed.length} bytes`)
          modelImages.push({ model, base64: compressed })
        }
      } catch (imgErr) {
        console.error(`Error loading ${model.name}:`, imgErr)
      }
    }

    console.log('Total models loaded:', modelImages.length)

    if (modelImages.length === 0) {
      return NextResponse.json({ 
        isDuplicate: false, 
        matchedModel: null,
        confidence: 0,
        reason: 'Impossible de charger les images'
      })
    }

    // 6. Call Claude Vision - compare with ALL models
    // But we need to batch if too many (Claude has limits)
    // Let's do batches of 5 models max per request
    const BATCH_SIZE = 5
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    
    for (let batchStart = 0; batchStart < modelImages.length; batchStart += BATCH_SIZE) {
      const batch = modelImages.slice(batchStart, batchStart + BATCH_SIZE)
      console.log(`Checking batch ${batchStart / BATCH_SIZE + 1}: models ${batchStart + 1}-${batchStart + batch.length}`)
      
      const content: any[] = [
        {
          type: 'text',
          text: `Compare la NOUVELLE PHOTO avec les ${batch.length} modèles ci-dessous.

NOUVELLE PHOTO - Nom: "${detected_name || 'N/A'}", Fabricant: "${detected_manufacturer || 'N/A'}"`
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: compressedInput }
        }
      ]

      for (let i = 0; i < batch.length; i++) {
        const { model, base64 } = batch[i]
        content.push({
          type: 'text',
          text: `\nMODÈLE ${i + 1}: "${model.name}" (${model.manufacturer || 'N/A'})`
        })
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
        })
      }

      content.push({
        type: 'text',
        text: `

Est-ce que la NOUVELLE PHOTO montre le MÊME compteur (même modèle exact) qu'un des modèles ci-dessus ?

Réponds UNIQUEMENT en JSON:
{"isDuplicate": true/false, "matchedModelIndex": 1-${batch.length} ou null, "confidence": 0-100, "reason": "explication courte"}

isDuplicate=true SEULEMENT si c'est exactement le même modèle de compteur.
JSON:`
      })

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content }]
      })

      const textContent = response.content.find(c => c.type === 'text')
      if (!textContent || textContent.type !== 'text') continue

      console.log('Response:', textContent.text)

      // Parse response
      let result
      try {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : null
      } catch (e) {
        continue
      }

      // If duplicate found in this batch, return immediately
      if (result?.isDuplicate && result.matchedModelIndex >= 1 && result.matchedModelIndex <= batch.length) {
        const matched = batch[result.matchedModelIndex - 1].model
        console.log('DUPLICATE FOUND:', matched.name)
        
        return NextResponse.json({
          isDuplicate: true,
          matchedModel: {
            id: matched.id,
            name: matched.name,
            manufacturer: matched.manufacturer,
            meter_type: matched.meter_type,
            photo: matched.reference_photos[0]
          },
          confidence: result.confidence || 80,
          reason: result.reason || 'Même modèle détecté'
        })
      }
    }

    // No duplicate found in any batch
    console.log('No duplicate found after checking all models')
    return NextResponse.json({
      isDuplicate: false,
      matchedModel: null,
      confidence: 0,
      reason: 'Aucun doublon trouvé'
    })

  } catch (error: any) {
    console.error('Check duplicate error:', error.message)
    
    return NextResponse.json({ 
      error: error.message || 'Unknown error',
      isDuplicate: false,
      matchedModel: null
    }, { status: 500 })
  }
}
