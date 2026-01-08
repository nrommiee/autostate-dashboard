import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  console.log('=== CHECK DUPLICATE METER START ===')
  
  try {
    // 1. Parse request
    let body
    try {
      body = await request.json()
      console.log('Body parsed, keys:', Object.keys(body))
    } catch (e) {
      console.error('JSON parse error:', e)
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { photo_base64, detected_name, detected_manufacturer, detected_type } = body

    if (!photo_base64) {
      console.log('No photo provided')
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }
    
    console.log('Photo length:', photo_base64.length)
    console.log('Detected:', { detected_name, detected_manufacturer, detected_type })

    // 2. Check env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    console.log('Env vars present:', { 
      supabaseUrl: !!supabaseUrl, 
      supabaseKey: !!supabaseKey,
      anthropicKey: !!anthropicKey
    })
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: 'Missing Supabase config',
        isDuplicate: false 
      }, { status: 500 })
    }

    if (!anthropicKey) {
      return NextResponse.json({ 
        error: 'Missing Anthropic config',
        isDuplicate: false 
      }, { status: 500 })
    }

    // 3. Get existing models
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: models, error: dbError } = await supabase
      .from('meter_models')
      .select('id, name, manufacturer, meter_type, reference_photos')
    
    if (dbError) {
      console.error('DB error:', dbError)
      return NextResponse.json({ 
        error: 'Database error', 
        details: dbError.message,
        isDuplicate: false 
      }, { status: 500 })
    }

    console.log('Models found:', models?.length || 0)

    // Filter models with photos
    const modelsWithPhotos = (models || []).filter(m => 
      m.reference_photos && 
      Array.isArray(m.reference_photos) && 
      m.reference_photos.length > 0 &&
      m.reference_photos[0]
    )

    console.log('Models with photos:', modelsWithPhotos.length)

    if (modelsWithPhotos.length === 0) {
      console.log('No models to compare, returning not duplicate')
      return NextResponse.json({ 
        isDuplicate: false, 
        matchedModel: null,
        confidence: 0,
        reason: 'Aucun modèle existant avec photo'
      })
    }

    // 4. Prepare images - LIMIT TO 3 models to stay under token/size limits
    const modelsToCompare = modelsWithPhotos.slice(0, 3)
    const modelImages: { model: typeof modelsToCompare[0], base64: string }[] = []
    
    // Max size for each image: ~1MB in base64 (to stay well under 5MB total)
    const MAX_BASE64_LENGTH = 1_000_000
    
    for (const model of modelsToCompare) {
      const photoUrl = model.reference_photos[0]
      console.log(`Processing model ${model.name}`)
      
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
          // Skip images that are too large
          if (base64.length > MAX_BASE64_LENGTH) {
            console.log(`Skipping ${model.name} - image too large: ${base64.length} bytes`)
            continue
          }
          
          modelImages.push({ model, base64 })
          console.log(`Added model ${model.name} (${base64.length} bytes)`)
        }
      } catch (imgErr) {
        console.error(`Error loading image for ${model.name}:`, imgErr)
      }
    }

    console.log('Model images loaded:', modelImages.length)

    if (modelImages.length === 0) {
      return NextResponse.json({ 
        isDuplicate: false, 
        matchedModel: null,
        confidence: 0,
        reason: 'Impossible de charger les images existantes'
      })
    }

    // Also check if input photo is too large
    let inputPhoto = photo_base64
    if (inputPhoto.length > MAX_BASE64_LENGTH) {
      console.log(`Input photo too large: ${inputPhoto.length}, truncating not possible - skip comparison`)
      // Can't compare, just return not duplicate
      return NextResponse.json({ 
        isDuplicate: false, 
        matchedModel: null,
        confidence: 0,
        reason: 'Photo trop grande pour comparaison'
      })
    }

    // 5. Call Claude Vision
    const anthropic = new Anthropic({ apiKey: anthropicKey })

    const content: any[] = [
      {
        type: 'text',
        text: `Compare la NOUVELLE PHOTO avec les ${modelImages.length} modèles existants.

NOUVELLE PHOTO - Nom détecté: "${detected_name || 'N/A'}", Fabricant: "${detected_manufacturer || 'N/A'}"`
      },
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: inputPhoto }
      }
    ]

    for (let i = 0; i < modelImages.length; i++) {
      const { model, base64 } = modelImages[i]
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

Est-ce que la NOUVELLE PHOTO montre le même compteur qu'un des modèles existants ?

Réponds en JSON:
{"isDuplicate": true/false, "matchedModelIndex": 1-${modelImages.length} ou null, "confidence": 0-100, "reason": "explication"}

Si c'est le même modèle exact (même marque, même design), isDuplicate=true.
JSON:`
    })

    console.log('Calling Claude with', modelImages.length, 'comparison images...')
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      console.log('No text response from Claude')
      return NextResponse.json({ isDuplicate: false, matchedModel: null, confidence: 0 })
    }

    console.log('Claude response:', textContent.text)

    // 6. Parse response
    let result
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch (e) {
      console.error('JSON parse error')
      return NextResponse.json({ isDuplicate: false, matchedModel: null, confidence: 0 })
    }

    if (!result) {
      return NextResponse.json({ isDuplicate: false, matchedModel: null, confidence: 0 })
    }

    console.log('Parsed result:', result)

    // 7. Return result
    if (result.isDuplicate && result.matchedModelIndex >= 1 && result.matchedModelIndex <= modelImages.length) {
      const matched = modelImages[result.matchedModelIndex - 1].model
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

    console.log('No duplicate found')
    return NextResponse.json({
      isDuplicate: false,
      matchedModel: null,
      confidence: result.confidence || 0,
      reason: result.reason || ''
    })

  } catch (error: any) {
    console.error('=== CHECK DUPLICATE ERROR ===')
    console.error('Error:', error.message)
    
    return NextResponse.json({ 
      error: error.message || 'Unknown error',
      isDuplicate: false,
      matchedModel: null
    }, { status: 500 })
  }
}
