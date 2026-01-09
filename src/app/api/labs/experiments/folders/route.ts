import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Liste des dossiers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status')
    const linkedModelId = searchParams.get('linked_model_id')
    const withPhotos = searchParams.get('with_photos') === 'true'

    if (id) {
      // Dossier spécifique avec photos
      const { data: folder, error } = await supabase
        .from('experiment_folders')
        .select(`
          *,
          meter_models(id, name, manufacturer),
          experiment_config_model(id, name),
          experiment_photos(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return NextResponse.json({ folder })
    }

    // Liste des dossiers
    let query = supabase
      .from('experiment_folders')
      .select(`
        *,
        meter_models(id, name, manufacturer)
        ${withPhotos ? ', experiment_photos(id, image_url, thumbnail_url, status)' : ''}
      `)
      .order('updated_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (linkedModelId) {
      query = query.eq('linked_meter_model_id', linkedModelId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ folders: data })
  } catch (error) {
    console.error('Error fetching folders:', error)
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
  }
}

// POST - Créer un dossier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, detected_type, linked_meter_model_id } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('experiment_folders')
      .insert({
        name,
        description,
        detected_type: detected_type || 'unknown',
        linked_meter_model_id,
        status: 'draft'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ folder: data })
  } catch (error) {
    console.error('Error creating folder:', error)
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
  }
}

// PUT - Mettre à jour un dossier
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Champs autorisés
    const allowedFields = [
      'name', 'description', 'detected_type', 'linked_meter_model_id',
      'config_model_id', 'status', 'min_photos_required'
    ]

    const filteredUpdates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }
    filteredUpdates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('experiment_folders')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ folder: data })
  } catch (error) {
    console.error('Error updating folder:', error)
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 })
  }
}

// DELETE - Supprimer un dossier (et ses photos)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Les photos seront supprimées en cascade (ON DELETE CASCADE)
    const { error } = await supabase
      .from('experiment_folders')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting folder:', error)
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 })
  }
}
