import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Trouver ou créer une version pour ce modèle avec cette config
async function findOrCreateVersion(
  modelId: string, 
  imageConfig: any,
  promptText?: string
): Promise<string | null> {
  // Normaliser la config
  const normalizedConfig = {
    grayscale: imageConfig?.grayscale || false,
    contrast: imageConfig?.contrast || 0,
    brightness: imageConfig?.brightness || 0
  }

  // Chercher une version existante avec cette config exacte
  const { data: existingVersions } = await supabase
    .from('model_versions')
    .select('id, image_config, prompt_text')
    .eq('model_id', modelId)
    .order('version_number', { ascending: false })

  if (existingVersions && existingVersions.length > 0) {
    // Chercher une version avec la même config image
    const matchingVersion = existingVersions.find(v => {
      const vc = v.image_config || {}
      return vc.grayscale === normalizedConfig.grayscale &&
             vc.contrast === normalizedConfig.contrast &&
             vc.brightness === normalizedConfig.brightness
    })

    if (matchingVersion) {
      return matchingVersion.id
    }
  }

  // Aucune version correspondante, en créer une nouvelle
  // D'abord récupérer le prompt du modèle si pas fourni
  let finalPrompt = promptText
  if (!finalPrompt) {
    const { data: model } = await supabase
      .from('meter_models')
      .select('ai_description, name, meter_type')
      .eq('id', modelId)
      .single()

    finalPrompt = model?.ai_description || `MODÈLE: ${model?.name || 'Inconnu'}\nTYPE: ${model?.meter_type || 'Inconnu'}`
  }

  // Trouver le prochain numéro de version
  const nextVersion = existingVersions && existingVersions.length > 0
    ? Math.max(...existingVersions.map((v: any) => v.version_number || 0)) + 1
    : 1

  // Créer la nouvelle version
  const { data: newVersion, error } = await supabase
    .from('model_versions')
    .insert({
      model_id: modelId,
      version_number: nextVersion,
      prompt_text: finalPrompt,
      image_config: normalizedConfig,
      is_active: nextVersion === 1, // Activer automatiquement si c'est la première
      notes: `Auto-créée lors d'un test avec config: ${normalizedConfig.grayscale ? 'N&B' : 'Couleur'}${normalizedConfig.contrast !== 0 ? ` C:${normalizedConfig.contrast}%` : ''}${normalizedConfig.brightness !== 0 ? ` L:${normalizedConfig.brightness}%` : ''}`
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating version:', error)
    return null
  }

  console.log(`Created new version v${nextVersion} for model ${modelId}`)
  return newVersion.id
}

// Save experiment result to database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      meter_model_id,
      photo_base64,
      photo_processed_base64,
      extracted_data,
      corrected_data,
      confidence,
      status, // 'validated' | 'corrected' | 'rejected'
      image_config_used,
      tokens_input,
      tokens_output,
      processing_time_ms,
      test_config_id // ID de la config de test nommée (optionnel)
    } = body

    if (!meter_model_id || !status) {
      return NextResponse.json(
        { error: 'meter_model_id et status requis' },
        { status: 400 }
      )
    }

    // Trouver ou créer la version correspondante
    const versionId = await findOrCreateVersion(meter_model_id, image_config_used)

    let photo_url = null
    let photo_processed_url = null

    // Upload photos to Storage if provided
    if (photo_base64) {
      const photoBuffer = Buffer.from(photo_base64, 'base64')
      const photoPath = `tests/${meter_model_id}/${Date.now()}_original.jpg`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meter-test-photos')
        .upload(photoPath, photoBuffer, {
          contentType: 'image/jpeg',
          upsert: false
        })

      if (uploadError) {
        console.error('Photo upload error:', uploadError)
      } else {
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('meter-test-photos')
          .getPublicUrl(photoPath)
        photo_url = urlData.publicUrl
      }
    }

    if (photo_processed_base64) {
      const processedBuffer = Buffer.from(photo_processed_base64, 'base64')
      const processedPath = `tests/${meter_model_id}/${Date.now()}_processed.jpg`
      
      const { error: uploadError } = await supabase.storage
        .from('meter-test-photos')
        .upload(processedPath, processedBuffer, {
          contentType: 'image/jpeg',
          upsert: false
        })

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('meter-test-photos')
          .getPublicUrl(processedPath)
        photo_processed_url = urlData.publicUrl
      }
    }

    // Calculate expiration date (30 days)
    const expires_at = new Date()
    expires_at.setDate(expires_at.getDate() + 30)

    // Insert experiment
    const { data: experiment, error: insertError } = await supabase
      .from('lab_experiments')
      .insert({
        meter_model_id,
        version_id: versionId, // Lier à la version
        test_config_id: test_config_id || null, // Lier à la config nommée
        photo_url,
        photo_processed_url,
        extracted_data: extracted_data || {},
        corrected_data: corrected_data || null,
        confidence: confidence || 0,
        status,
        image_config_used: image_config_used || {},
        tokens_input: tokens_input || 0,
        tokens_output: tokens_output || 0,
        processing_time_ms: processing_time_ms || 0,
        expires_at: expires_at.toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert experiment error:', insertError)
      return NextResponse.json(
        { error: 'Erreur lors de la sauvegarde' },
        { status: 500 }
      )
    }

    // Update model stats
    await updateModelStats(meter_model_id, status)

    return NextResponse.json({
      success: true,
      experiment_id: experiment.id,
      version_id: versionId,
      photo_url,
      expires_at: expires_at.toISOString()
    })

  } catch (error: any) {
    console.error('Save experiment error:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// Update model statistics after a test
async function updateModelStats(modelId: string, status: string) {
  const isSuccess = status === 'validated' || status === 'corrected'
  
  // Get current stats
  const { data: model } = await supabase
    .from('meter_models')
    .select('total_scans, success_count, fail_count')
    .eq('id', modelId)
    .single()

  if (!model) return

  // Update stats
  const updates: any = {
    total_scans: (model.total_scans || 0) + 1
  }

  if (isSuccess) {
    updates.success_count = (model.success_count || 0) + 1
  } else {
    updates.fail_count = (model.fail_count || 0) + 1
  }

  await supabase
    .from('meter_models')
    .update(updates)
    .eq('id', modelId)
}

// GET - Fetch experiments for a model
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const modelId = searchParams.get('model_id')
  const limit = parseInt(searchParams.get('limit') || '50')

  if (!modelId) {
    return NextResponse.json({ error: 'model_id requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('lab_experiments')
    .select('*')
    .eq('meter_model_id', modelId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ experiments: data })
}
