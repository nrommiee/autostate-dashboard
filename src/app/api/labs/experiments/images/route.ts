import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Liste des images de test
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const meterType = searchParams.get('meter_type')
    const displayType = searchParams.get('display_type')
    const lighting = searchParams.get('lighting')
    const hasGroundTruth = searchParams.get('has_ground_truth')
    const tags = searchParams.get('tags')?.split(',')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (id) {
      const { data, error } = await supabase
        .from('experiment_images')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return NextResponse.json({ image: data })
    }

    let query = supabase
      .from('experiment_images')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (meterType) {
      query = query.eq('meter_type', meterType)
    }
    if (displayType) {
      query = query.eq('display_type', displayType)
    }
    if (lighting) {
      query = query.eq('lighting', lighting)
    }
    if (hasGroundTruth === 'true') {
      query = query.not('ground_truth', 'is', null)
    }
    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags)
    }

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({ images: data, total: count })
  } catch (error) {
    console.error('Error fetching images:', error)
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
  }
}

// POST - Ajouter une nouvelle image
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const metadata = formData.get('metadata') as string | null

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    // Parser les métadonnées si fournies
    let meta: any = {}
    if (metadata) {
      try {
        meta = JSON.parse(metadata)
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
    }

    // Upload vers Supabase Storage
    const fileName = `experiment-images/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('meter-photos')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) throw uploadError

    // Obtenir l'URL publique
    const { data: urlData } = supabase.storage
      .from('meter-photos')
      .getPublicUrl(fileName)

    // Calculer un hash simple
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32)

    // Créer l'entrée en base
    const { data: image, error: dbError } = await supabase
      .from('experiment_images')
      .insert({
        image_url: urlData.publicUrl,
        image_hash: imageHash,
        original_filename: file.name,
        file_size_bytes: file.size,
        meter_type: meta.meter_type || null,
        display_type: meta.display_type || null,
        manufacturer: meta.manufacturer || null,
        model_name: meta.model_name || null,
        lighting: meta.lighting || null,
        angle: meta.angle || null,
        quality: meta.quality || null,
        ground_truth: meta.ground_truth || null,
        source: meta.source || 'lab',
        source_details: meta.source_details || null,
        tags: meta.tags || []
      })
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json({ image })
  } catch (error) {
    console.error('Error uploading image:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

// PUT - Mettre à jour les métadonnées d'une image
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Champs autorisés à mettre à jour
    const allowedFields = [
      'meter_type', 'display_type', 'manufacturer', 'model_name',
      'lighting', 'angle', 'quality', 'ground_truth', 'source',
      'source_details', 'tags', 'width', 'height'
    ]

    const filteredUpdates: any = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }

    const { data, error } = await supabase
      .from('experiment_images')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ image: data })
  } catch (error) {
    console.error('Error updating image:', error)
    return NextResponse.json({ error: 'Failed to update image' }, { status: 500 })
  }
}

// DELETE - Supprimer une image
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Récupérer l'URL pour supprimer du storage
    const { data: image } = await supabase
      .from('experiment_images')
      .select('image_url')
      .eq('id', id)
      .single()

    // Supprimer de la base
    const { error } = await supabase
      .from('experiment_images')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Supprimer du storage (best effort)
    if (image?.image_url) {
      try {
        const path = image.image_url.split('/meter-photos/')[1]
        if (path) {
          await supabase.storage.from('meter-photos').remove([path])
        }
      } catch (e) {
        console.warn('Failed to delete from storage:', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting image:', error)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}
