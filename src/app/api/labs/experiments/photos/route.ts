export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// Simple hash function using Node crypto
function hashBuffer(buffer: ArrayBuffer): string {
  const hash = crypto.createHash('sha256')
  hash.update(Buffer.from(buffer))
  return hash.digest('hex').substring(0, 32)
}

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
      return NextResponse.json({ photo: data }, { headers: corsHeaders })
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

    return NextResponse.json({ photos: data }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500, headers: corsHeaders })
  }
}

// POST - Upload photos
export async function POST(request: NextRequest) {
  console.log('POST /api/labs/experiments/photos - Start')
  
  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (e) {
      console.error('FormData parsing error:', e)
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400, headers: corsHeaders })
    }

    const files = formData.getAll('files') as File[]
    const folderId = formData.get('folder_id') as string | null
    const autoCluster = formData.get('auto_cluster') !== 'false'

    console.log('Files received:', files.length)

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'files are required' }, { status: 400, headers: corsHeaders })
    }

    const uploadedPhotos = []
    const errors = []

    for (const file of files) {
      console.log('Processing file:', file.name, 'Size:', file.size)
      
      try {
        // Lire le fichier
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Calculer hash
        const imageHash = hashBuffer(arrayBuffer)
        console.log('Hash:', imageHash)

        // Vérifier si doublon
        const { data: existing } = await supabase
          .from('experiment_photos')
          .select('id, folder_id')
          .eq('image_hash', imageHash)
          .maybeSingle()

        if (existing) {
          console.log('Duplicate found:', existing.id)
          errors.push({ file: file.name, error: 'Duplicate image', existing_id: existing.id })
          continue
        }

        // Nettoyer le nom de fichier
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const fileName = `experiment-photos/${Date.now()}-${Math.random().toString(36).substring(7)}-${cleanFileName}`
        
        console.log('Uploading to storage:', fileName)

        // Upload vers Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('meter-photos')
          .upload(fileName, buffer, {
            contentType: file.type || 'image/jpeg',
            upsert: false
          })

        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          errors.push({ file: file.name, error: uploadError.message })
          continue
        }

        console.log('Storage upload success')

        // Obtenir l'URL publique
        const { data: urlData } = supabase.storage
          .from('meter-photos')
          .getPublicUrl(fileName)

        console.log('Public URL:', urlData.publicUrl)

        // Déterminer le folder_id
        let targetFolderId = folderId

        // Si pas de folder_id, créer un nouveau dossier
        if (!targetFolderId && autoCluster) {
          console.log('Creating new folder...')
          const { data: newFolder, error: folderError } = await supabase
            .from('experiment_folders')
            .insert({
              name: `Import ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
              status: 'draft',
              detected_type: 'unknown'
            })
            .select()
            .single()
          
          if (folderError) {
            console.error('Folder creation error:', folderError)
            errors.push({ file: file.name, error: 'Failed to create folder: ' + folderError.message })
            continue
          }
          
          targetFolderId = newFolder.id
          console.log('New folder created:', targetFolderId)
        }

        // Créer l'entrée photo
        console.log('Inserting photo record...')
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

        if (dbError) {
          console.error('DB insert error:', dbError)
          errors.push({ file: file.name, error: dbError.message })
          continue
        }

        console.log('Photo record created:', photo.id)
        uploadedPhotos.push(photo)
      } catch (err) {
        console.error('Upload error for file:', file.name, err)
        errors.push({ file: file.name, error: String(err) })
      }
    }

    console.log('Upload complete. Success:', uploadedPhotos.length, 'Errors:', errors.length)

    return NextResponse.json({
      uploaded: uploadedPhotos,
      errors,
      total: files.length,
      success_count: uploadedPhotos.length,
      error_count: errors.length
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error uploading photos:', error)
    return NextResponse.json({ error: 'Failed to upload photos', details: String(error) }, { status: 500, headers: corsHeaders })
  }
}

// PUT - Mettre à jour une photo
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: corsHeaders })
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

    return NextResponse.json({ photo: data }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error updating photo:', error)
    return NextResponse.json({ error: 'Failed to update photo' }, { status: 500, headers: corsHeaders })
  }
}

// PATCH - Déplacer plusieurs photos
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { photo_ids, target_folder_id } = body

    if (!photo_ids || !Array.isArray(photo_ids) || photo_ids.length === 0) {
      return NextResponse.json({ error: 'photo_ids array is required' }, { status: 400, headers: corsHeaders })
    }

    if (!target_folder_id) {
      return NextResponse.json({ error: 'target_folder_id is required' }, { status: 400, headers: corsHeaders })
    }

    const { data, error } = await supabase
      .from('experiment_photos')
      .update({ folder_id: target_folder_id })
      .in('id', photo_ids)
      .select()

    if (error) throw error

    return NextResponse.json({ moved: data?.length || 0 }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error moving photos:', error)
    return NextResponse.json({ error: 'Failed to move photos' }, { status: 500, headers: corsHeaders })
  }
}

// DELETE - Supprimer une photo
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: corsHeaders })
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

    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error deleting photo:', error)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500, headers: corsHeaders })
  }
}
