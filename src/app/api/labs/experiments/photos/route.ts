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

// Analyser une photo avec Claude Vision
async function analyzePhotoForClustering(imageBase64: string): Promise<{
  meter_type: string
  manufacturer: string | null
  model: string | null
  confidence: number
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
              text: `Analyse cette photo de compteur d'énergie (gaz, eau, électricité).

Identifie avec précision:
1. TYPE: "gas", "water", "electricity", ou "unknown"
2. FABRICANT: Le nom exact du fabricant visible sur le compteur (ex: "Itron", "Schlumberger", "Landis+Gyr")
3. MODÈLE: La référence exacte du modèle visible (ex: "G4", "A1140", "MULTICAL 402")
4. CONFIANCE: Un score de 0 à 100 indiquant ta certitude

Règles:
- Si tu ne vois PAS clairement le fabricant, mets null
- Si tu ne vois PAS clairement le modèle, mets null  
- Confiance 100 = fabricant ET modèle clairement lisibles
- Confiance 50-99 = un des deux manquant ou partiellement lisible
- Confiance 0-49 = impossible à identifier

Réponds UNIQUEMENT en JSON:
{"type":"gas|water|electricity|unknown","manufacturer":"string|null","model":"string|null","confidence":0-100}`
            }
          ]
        }
      ]
    })

    const textContent = response.content.find(c => c.type === 'text')
    const responseText = textContent?.type === 'text' ? textContent.text : '{}'
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      
      // Créer signature unique
      const mfr = (parsed.manufacturer || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_')
      const mdl = (parsed.model || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_')
      const signature = `${parsed.type || 'unknown'}_${mfr}_${mdl}`
      
      return {
        meter_type: parsed.type || 'unknown',
        manufacturer: parsed.manufacturer || null,
        model: parsed.model || null,
        confidence: parsed.confidence || 0,
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
    confidence: 0,
    signature: 'unknown_unknown_unknown'
  }
}

// Générer un nom de dossier propre
function generateFolderName(manufacturer: string | null, model: string | null, meterType: string): string {
  if (manufacturer && model) {
    return `${manufacturer} ${model}`
  }
  if (manufacturer) {
    return `${manufacturer} (modèle inconnu)`
  }
  if (model) {
    return model
  }
  // Fallback avec type
  const typeLabels: Record<string, string> = {
    gas: 'Compteur gaz',
    water: 'Compteur eau',
    electricity: 'Compteur électrique',
    unknown: 'Compteur'
  }
  return `${typeLabels[meterType] || 'Compteur'} - ${new Date().toLocaleDateString('fr-FR')}`
}

// Trouver ou créer un dossier
async function findOrCreateFolder(
  signature: string,
  meterType: string,
  manufacturer: string | null,
  model: string | null,
  confidence: number
): Promise<string> {
  // Si confiance < 100, mettre dans le pot commun "Non classé"
  if (confidence < 100) {
    // Chercher le dossier "Non classé" existant
    const { data: unclassifiedFolder } = await supabase
      .from('experiment_folders')
      .select('id')
      .eq('name', 'Non classé')
      .eq('is_unclassified', true)
      .single()

    if (unclassifiedFolder) {
      return unclassifiedFolder.id
    }

    // Créer le dossier "Non classé"
    const { data: newUnclassified, error } = await supabase
      .from('experiment_folders')
      .insert({
        name: 'Non classé',
        status: 'draft',
        detected_type: 'unknown',
        is_unclassified: true,
        cluster_signature: 'unclassified'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating unclassified folder:', error)
      throw error
    }

    return newUnclassified.id
  }

  // Confiance 100% - chercher dossier existant avec même signature
  const { data: existingFolder } = await supabase
    .from('experiment_folders')
    .select('id')
    .eq('cluster_signature', signature)
    .not('is_unclassified', 'eq', true)
    .single()

  if (existingFolder) {
    return existingFolder.id
  }

  // Créer nouveau dossier
  const folderName = generateFolderName(manufacturer, model, meterType)

  const { data: newFolder, error } = await supabase
    .from('experiment_folders')
    .insert({
      name: folderName,
      status: 'draft',
      detected_type: meterType,
      cluster_signature: signature,
      is_unclassified: false
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
    const all = searchParams.get('all')

    if (id) {
      const { data, error } = await supabase
        .from('experiment_photos')
        .select('*, experiment_folders(id, name, detected_type)')
        .eq('id', id)
        .single()

      if (error) throw error
      return NextResponse.json({ photo: data }, { headers: corsHeaders })
    }

    let query = supabase
      .from('experiment_photos')
      .select('*, experiment_folders(id, name, detected_type)')
      .order('uploaded_at', { ascending: false })

    if (folderId) {
      query = query.eq('folder_id', folderId)
    }
    if (status) {
      query = query.eq('status', status)
    }
    
    // Limite si pas "all"
    if (!all) {
      query = query.limit(200)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ photos: data }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500, headers: corsHeaders })
  }
}

// POST - Upload photos avec clustering intelligent
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
    const skipAnalysis = formData.get('skip_analysis') === 'true'

    // Limite de 20 photos
    if (files.length > 20) {
      return NextResponse.json({ 
        error: 'Limite dépassée',
        message: 'Maximum 20 photos par upload. Veuillez réduire votre sélection.'
      }, { status: 400, headers: corsHeaders })
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'files are required' }, { status: 400, headers: corsHeaders })
    }

    const uploadedPhotos = []
    const errors = []
    const analysisResults: { 
      file: string
      manufacturer: string | null
      model: string | null
      confidence: number
      folder: string 
    }[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`Processing file ${i + 1}/${files.length}:`, file.name)
      
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const imageBase64 = buffer.toString('base64')
        const imageHash = hashBuffer(arrayBuffer)

        // Vérifier doublon
        const { data: existing } = await supabase
          .from('experiment_photos')
          .select('id, folder_id')
          .eq('image_hash', imageHash)
          .maybeSingle()

        if (existing) {
          errors.push({ file: file.name, error: 'Photo déjà importée', existing_id: existing.id })
          continue
        }

        // Upload Storage
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

        // Déterminer folder_id
        let targetFolderId = folderId
        let analysis = null

        if (!targetFolderId && autoCluster && !skipAnalysis) {
          console.log('Analyzing image with Claude Vision...')
          analysis = await analyzePhotoForClustering(imageBase64)
          console.log('Analysis:', analysis)
          
          targetFolderId = await findOrCreateFolder(
            analysis.signature,
            analysis.meter_type,
            analysis.manufacturer,
            analysis.model,
            analysis.confidence
          )
          
          analysisResults.push({
            file: file.name,
            manufacturer: analysis.manufacturer,
            model: analysis.model,
            confidence: analysis.confidence,
            folder: targetFolderId
          })
        } else if (!targetFolderId) {
          // Sans analyse, mettre dans "Non classé"
          const { data: unclassifiedFolder } = await supabase
            .from('experiment_folders')
            .select('id')
            .eq('is_unclassified', true)
            .single()

          if (unclassifiedFolder) {
            targetFolderId = unclassifiedFolder.id
          } else {
            const { data: newFolder } = await supabase
              .from('experiment_folders')
              .insert({
                name: 'Non classé',
                status: 'draft',
                detected_type: 'unknown',
                is_unclassified: true
              })
              .select()
              .single()
            targetFolderId = newFolder?.id
          }
        }

        // Créer entrée photo
        const { data: photo, error: dbError } = await supabase
          .from('experiment_photos')
          .insert({
            folder_id: targetFolderId,
            image_url: urlData.publicUrl,
            image_hash: imageHash,
            original_filename: file.name,
            file_size_bytes: file.size,
            status: 'pending',
            detected_type: analysis?.meter_type || 'unknown',
            ai_confidence: analysis?.confidence || null
          })
          .select()
          .single()

        if (dbError) {
          console.error('DB insert error:', dbError)
          errors.push({ file: file.name, error: dbError.message })
          continue
        }

        uploadedPhotos.push(photo)
      } catch (err) {
        console.error('Upload error for file:', file.name, err)
        errors.push({ file: file.name, error: String(err) })
      }
    }

    return NextResponse.json({
      uploaded: uploadedPhotos,
      errors,
      analysis: analysisResults,
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

    const allowedFields = ['folder_id', 'status', 'ground_truth', 'detected_type']
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
    const { photo_ids, target_folder_id, detected_type } = body

    if (!photo_ids || !Array.isArray(photo_ids) || photo_ids.length === 0) {
      return NextResponse.json({ error: 'photo_ids array is required' }, { status: 400, headers: corsHeaders })
    }

    const updates: Record<string, unknown> = {}
    
    if (target_folder_id) {
      updates.folder_id = target_folder_id
    }
    if (detected_type) {
      updates.detected_type = detected_type
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400, headers: corsHeaders })
    }

    const { data, error } = await supabase
      .from('experiment_photos')
      .update(updates)
      .in('id', photo_ids)
      .select()

    if (error) throw error

    return NextResponse.json({ updated: data?.length || 0, photos: data }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error updating photos:', error)
    return NextResponse.json({ error: 'Failed to update photos' }, { status: 500, headers: corsHeaders })
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
