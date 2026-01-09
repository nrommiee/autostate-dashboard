import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// GET - Liste des dossiers ou un dossier spécifique
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const withPhotos = searchParams.get('with_photos') === 'true'

    if (id) {
      // Récupérer un dossier spécifique avec ses photos
      const { data, error } = await supabase
        .from('experiment_folders')
        .select(`*, experiment_photos!experiment_photos_folder_id_fkey(*)`)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching folder by id:', error)
        return NextResponse.json({ error: 'Failed to fetch folder', details: error.message }, { status: 500, headers: corsHeaders })
      }
      
      return NextResponse.json({ folder: data }, { headers: corsHeaders })
    }

    // Liste des dossiers - spécifier la relation via folder_id
    const { data, error } = await supabase
      .from('experiment_folders')
      .select(withPhotos ? `*, experiment_photos!experiment_photos_folder_id_fkey(*)` : `*`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching folders:', error)
      return NextResponse.json({ error: 'Failed to fetch folders', details: error.message }, { status: 500, headers: corsHeaders })
    }

    // Calculer photo_count simplement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const foldersWithCount = (data || []).map((folder: any) => ({
      ...folder,
      photo_count: folder.experiment_photos?.length || 0,
      min_photos_required: 5
    }))

    return NextResponse.json({ folders: foldersWithCount }, { headers: corsHeaders })
  } catch (error) {
    console.error('Unexpected error in GET folders:', error)
    return NextResponse.json({ error: 'Failed to fetch folders', details: String(error) }, { status: 500, headers: corsHeaders })
  }
}

// POST - Créer un nouveau dossier (manuellement)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, detected_type, description } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400, headers: corsHeaders })
    }

    const { data, error } = await supabase
      .from('experiment_folders')
      .insert({
        name,
        detected_type: detected_type || 'unknown',
        description: description || null,
        status: 'draft',
        is_unclassified: false,
        cluster_signature: `manual_${Date.now()}`,
        photos_since_last_test: 0
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ folder: data }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error creating folder:', error)
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500, headers: corsHeaders })
  }
}

// PUT - Mettre à jour un dossier
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: corsHeaders })
    }

    const allowedFields = ['name', 'description', 'status', 'linked_meter_model_id', 'config_model_id', 'detected_type', 'reference_photo_id']
    const filteredUpdates: Record<string, unknown> = {}
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }

    // Mettre à jour automatiquement le status si nécessaire
    if (filteredUpdates.status === undefined) {
      // Vérifier le nombre de photos
      const { data: folder } = await supabase
        .from('experiment_folders')
        .select('status, is_unclassified, experiment_photos!experiment_photos_folder_id_fkey(id)')
        .eq('id', id)
        .single()
      
      if (folder && !folder.is_unclassified) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const photoCount = (folder.experiment_photos as any)?.length || 0
        if (folder.status === 'draft' && photoCount >= 5) {
          filteredUpdates.status = 'ready'
        }
      }
    }

    const { data, error } = await supabase
      .from('experiment_folders')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ folder: data }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error updating folder:', error)
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500, headers: corsHeaders })
  }
}

// DELETE - Supprimer un dossier
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: corsHeaders })
    }

    // Vérifier si c'est le dossier "Non classé"
    const { data: folder } = await supabase
      .from('experiment_folders')
      .select('is_unclassified')
      .eq('id', id)
      .single()

    if (folder?.is_unclassified) {
      return NextResponse.json({ 
        error: 'Cannot delete unclassified folder',
        message: 'Le dossier "Non classé" ne peut pas être supprimé'
      }, { status: 400, headers: corsHeaders })
    }

    // Récupérer les photos pour supprimer du storage
    const { data: photos } = await supabase
      .from('experiment_photos')
      .select('image_url')
      .eq('folder_id', id)

    // Supprimer les photos du storage
    if (photos && photos.length > 0) {
      const paths = photos
        .map(p => p.image_url?.split('/meter-photos/')[1])
        .filter(Boolean)
      
      if (paths.length > 0) {
        await supabase.storage.from('meter-photos').remove(paths as string[])
      }
    }

    // Supprimer les photos de la DB
    await supabase
      .from('experiment_photos')
      .delete()
      .eq('folder_id', id)

    // Supprimer le dossier
    const { error } = await supabase
      .from('experiment_folders')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error deleting folder:', error)
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500, headers: corsHeaders })
  }
}
