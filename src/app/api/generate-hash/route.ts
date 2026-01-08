import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// Generate pHash for an image
async function generateImageHash(base64: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64, 'base64')
    
    const { data } = await sharp(buffer)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
    
    const pixels = Array.from(data)
    const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length
    const hash = pixels.map(p => p > avg ? '1' : '0').join('')
    
    let hexHash = ''
    for (let i = 0; i < hash.length; i += 4) {
      hexHash += parseInt(hash.substr(i, 4), 2).toString(16)
    }
    
    return hexHash
  } catch (err) {
    console.error('Hash generation error:', err)
    return ''
  }
}

// POST: Generate hash for a single model
export async function POST(request: NextRequest) {
  try {
    const { model_id, photo_base64 } = await request.json()

    if (!photo_base64) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    const hash = await generateImageHash(photo_base64)
    
    if (!hash) {
      return NextResponse.json({ error: 'Hash generation failed' }, { status: 500 })
    }

    // If model_id provided, save to database
    if (model_id) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        const { error } = await supabase
          .from('meter_models')
          .update({ image_hash: hash })
          .eq('id', model_id)
        
        if (error) {
          console.error('Save hash error:', error)
        }
      }
    }

    return NextResponse.json({ hash })
  } catch (error: any) {
    console.error('Generate hash error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: Batch generate hashes for all models without hash
export async function PUT(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Config error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get models without hash
    const { data: models, error: fetchError } = await supabase
      .from('meter_models')
      .select('id, name, reference_photos, image_hash')
      .is('image_hash', null)
    
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const modelsToProcess = (models || []).filter(m => 
      m.reference_photos && m.reference_photos.length > 0
    )

    console.log(`Processing ${modelsToProcess.length} models...`)

    const results = []
    
    for (const model of modelsToProcess) {
      const photoUrl = model.reference_photos[0]
      
      try {
        let base64 = ''
        
        if (photoUrl.startsWith('data:')) {
          base64 = photoUrl.split(',')[1]
        } else if (photoUrl.startsWith('http')) {
          const resp = await fetch(photoUrl)
          if (resp.ok) {
            const buf = await resp.arrayBuffer()
            base64 = Buffer.from(buf).toString('base64')
          }
        }
        
        if (base64) {
          const hash = await generateImageHash(base64)
          
          if (hash) {
            const { error: updateError } = await supabase
              .from('meter_models')
              .update({ image_hash: hash })
              .eq('id', model.id)
            
            if (!updateError) {
              results.push({ id: model.id, name: model.name, status: 'ok', hash: hash.substring(0, 16) + '...' })
              console.log(`✓ ${model.name}`)
            } else {
              results.push({ id: model.id, name: model.name, status: 'error', error: updateError.message })
            }
          }
        }
      } catch (err: any) {
        results.push({ id: model.id, name: model.name, status: 'error', error: err.message })
        console.error(`✗ ${model.name}:`, err.message)
      }
    }

    return NextResponse.json({
      processed: results.length,
      success: results.filter(r => r.status === 'ok').length,
      results
    })
  } catch (error: any) {
    console.error('Batch hash error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
