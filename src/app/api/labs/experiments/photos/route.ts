export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

function hashBuffer(buffer: ArrayBuffer): string {
  const hash = crypto.createHash('sha256')
  hash.update(Buffer.from(buffer))
  return hash.digest('hex').substring(0, 32)
}

// Analyser une photo avec Claude Vision pour identifier le compteur
async function analyzePhotoForClustering(imageBase64: string): Promise<{
  meter_type: string
  manufacturer: string | null
  model: string | null
  signature: string
}> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: `Analyse cette photo de compteur et identifie:
1. TYPE: gas, water, electricity, ou unknown
2. FABRICANT: nom du fabricant visible (ou null)
3. MODÈLE: référence du modèle visible (ou null)

Réponds UNIQUEMENT en JSON:
{"type":"gas|water|electricity|unknown","manufacturer":"string|null","model":"string|null"}`
            }
          ]
        }
      ]
    })

    const textContent = response.content.find(c => c.type === 'text')
    const responseText = textContent?.type === 'text' ? textContent.text : '{}'
    
    // Parser la réponse
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      // Créer une signature unique pour le clustering
      const signature = `${parsed.type || 'unknown'}_${(parsed.manufacturer || 'unknown').toLowerCase().replace(/\s+/g, '_')}_${(parsed.model || 'unknown').toLowerCase().replace(/\s+/g, '_')}`
      
      return {
        meter_type: parsed.type || 'unknown',
        manufacturer: parsed.manufacturer,
        model: parsed.model,
        signature
      }
    }
  } catch (error) {
    console.error('Claude analysis error:', error)
  }

  return {
    meter_type: 'unknown',
    manufacturer: null,
    model: null,
    signature: 'unknown_unknown_unknown'
  }
}

// Trouver ou créer un dossier pour cette signature
async function findOrCreateFolder(
  signature: string,
  meterType: string,
  manufacturer: string | null,
  model: string | null
): Promise<string> {
  // Chercher un dossier existant avec la même signature
  const { data: existingFolder } = await supabase
    .from('experiment_folders')
    .select('id')
    .eq('cluster_signature', signature)
    .eq('status', 'draft') // Seulement les brouillons, pas les promus
    .single()

  if (existingFolder) {
    return existingFolder.id
  }

  // Créer un nouveau dossier
  const folderName = model 
    ? `${manufacturer || 'Inconnu'} ${model}`
    : manufacturer 
      ? `${manufacturer} (${meterType})`
      : `Compteur ${meterType} - ${new Date().toLocaleDateString('fr-FR')}`

  const { data: newFolder, error } = await supabase
    .from('experiment_folders')
    .insert({
      name: folderName,
      status: 'draft',
      detected_type: meterType,
      cluster_signature: signature
    })
    .select()
    .single()

  if (error) {
    console.error('Folder creation error:', error)
    throw error
  }

  return newFolder.id
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

// POST - Upload photos avec clustering automatique
export async function POST(request: NextRequest) {
  console.log('POST /api/labs/experiments/photos - Start with auto-clustering')
  
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

    console.log('Files received:', files.length, 'Auto-cluster:', autoCluster)

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'files are required' }, { status: 400, headers: corsHeaders })
    }

    const uploadedPhotos = []
    const errors = []
    const clusteringResults: { file: string; signature: string; folder: string }[] = []

    for (const file of files) {
      console.log('Processing file:', file.name, 'Size:', file.size)
      
      try {
        // Lire le fichier
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const imageBase64 = buffer.toString('base64')
        
        // Calculer hash
        const imageHash = hashBuffer(arrayBuffer)

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

        // Upload vers Storage d'abord
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const fileName = `experiment-photos/${Date.now()}-${Math.random().toString(36).substring(7)}-${cleanFileName}`
        
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

        const { data: urlData } = supabase.storage
          .from('meter-photos')
          .getPublicUrl(fileName)

        // Déterminer le folder_id
        let targetFolderId = folderId

        // Si pas de folder_id et auto_cluster activé, utiliser Claude Vision
        if (!targetFolderId && autoCluster) {
          console.log('Analyzing image with Claude Vision...')
          
          const analysis = await analyzePhotoForClustering(imageBase64)
          console.log('Analysis result:', analysis)
          
          targetFolderId = await findOrCreateFolder(
            analysis.signature,
            analysis.meter_type,
            analysis.manufacturer,
            analysis.model
          )
          
          clusteringResults.push({
            file: file.name,
            signature: analysis.signature,
            folder: targetFolderId
          })
        } else if (!targetFolderId) {
          // Fallback: créer un dossier générique
          const { data: newFolder } = await supabase
            .from('experiment_folders')
            .insert({
              name: `Import ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
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

        if (dbError) {
          console.error('DB insert error:', dbError)
          errors.push({ file: file.name, error: dbError.message })
          continue
        }

        console.log('Photo created:', photo.id, 'in folder:', targetFolderId)
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
      clustering: clusteringResults,
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

    const { data: photo } = await supabase
      .from('experiment_photos')
      .select('image_url')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('experiment_photos')
      .delete()
      .eq('id', id)

    if (error) throw error

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
