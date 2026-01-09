import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Liste des photos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const folderId = searchParams.get('folder_id')
    const status = searchParams.get('status')

    if (id) {
      const { data, error } = await supabase
        .from('experiment_photos')
        .select('*, experiment_folders(id, name)')
        .eq('id', id)
        .single()

      if (error) throw error
      return NextResponse.json({ photo: data })
    }

    let query = supabase
      .from('experiment_photos')
      .select('*, experiment_folders(id, name)')
      .order('uploaded_at', { ascending: false })

    if (folderId) {
      query = query.eq('folder_id', folderId)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ photos: data })
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}

// POST - Upload photos (avec clustering automatique)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const folderId = formData.get('folder_id') as string | null
    const autoCluster = formData.get('auto_cluster') !== 'false'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'files are required' }, { status: 400 })
    }

    const uploadedPhotos = []
    const errors = []

    for (const file of files) {
      try {
        // Upload vers Supabase Storage
        const fileName = `experiment-photos/${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`
        const { error: uploadError } = await supabase.storage
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

        // Calculer hash
        const arrayBuffer = await file.arrayBuffer()
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32)

        // Vérifier si doublon
        const { data: existing } = await supabase
          .from('experiment_photos')
          .select('id, folder_id')
          .eq('image_hash', imageHash)
          .single()

        if (existing) {
          errors.push({ file: file.name, error: 'Duplicate image', existing_id: existing.id })
          continue
        }

        // Déterminer le folder_id
        let targetFolderId = folderId

        // TODO: Auto-clustering si autoCluster = true et pas de folder_id
        // Pour l'instant, créer un nouveau dossier si pas de folder_id
        if (!targetFolderId && autoCluster) {
          const { data: newFolder } = await supabase
            .from('experiment_folders')
            .insert({
              name: `Import ${new Date().toLocaleDateString('fr-FR')}`,
              status: 'draft',
              detected_type: 'unknown'
            })
            .select()
            .single()
          
          if (newFolder) {
            targetFolderId = newFolder.id
          }
        }

        // Créer l'entrée photo
        const { data: photo, error: dbError } = await supabase
          .from('experiment_photos')
          .insert({
            folder_id: targetFolderId,
            image_url: urlData.publicUrl,
            image_hash: imageHash,
            original_filename: file.name,
            file_size_bytes: file.size,
            status: 'pending'
          })
          .select()
          .single()

        if (dbError) throw dbError

        uploadedPhotos.push(photo)
      } catch (err) {
        errors.push({ file: file.name, error: String(err) })
      }
    }

    return NextResponse.json({
      uploaded: uploadedPhotos,
      errors,
      total: files.length,
      success_count: uploadedPhotos.length,
      error_count: errors.length
    })
  } catch (error) {
    console.error('Error uploading photos:', error)
    return NextResponse.json({ error: 'Failed to upload photos' }, { status: 500 })
  }
}

// PUT - Mettre à jour une photo (déplacer, changer status, ajouter ground truth)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const allowedFields = ['folder_id', 'status', 'ground_truth']
    const filteredUpdates: Record<string, unknown> = {}
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }

    const { data, error } = await supabase
      .from('experiment_photos')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ photo: data })
  } catch (error) {
    console.error('Error updating photo:', error)
    return NextResponse.json({ error: 'Failed to update photo' }, { status: 500 })
  }
}

// PATCH - Déplacer plusieurs photos
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { photo_ids, target_folder_id } = body

    if (!photo_ids || !Array.isArray(photo_ids) || photo_ids.length === 0) {
      return NextResponse.json({ error: 'photo_ids array is required' }, { status: 400 })
    }

    if (!target_folder_id) {
      return NextResponse.json({ error: 'target_folder_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('experiment_photos')
      .update({ folder_id: target_folder_id })
      .in('id', photo_ids)
      .select()

    if (error) throw error

    return NextResponse.json({ moved: data?.length || 0 })
  } catch (error) {
    console.error('Error moving photos:', error)
    return NextResponse.json({ error: 'Failed to move photos' }, { status: 500 })
  }
}

// DELETE - Supprimer une photo
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Récupérer l'URL pour supprimer du storage
    const { data: photo } = await supabase
      .from('experiment_photos')
      .select('image_url')
      .eq('id', id)
      .single()

    // Supprimer de la base
    const { error } = await supabase
      .from('experiment_photos')
      .delete()
      .eq('id', id)

    if (error) throw error

    // Supprimer du storage
    if (photo?.image_url) {
      try {
        const path = photo.image_url.split('/meter-photos/')[1]
        if (path) {
          await supabase.storage.from('meter-photos').remove([path])
        }
      } catch (e) {
        console.warn('Failed to delete from storage:', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting photo:', error)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
}
