import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// GET - Liste des tests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const folderId = searchParams.get('folder_id')
    const status = searchParams.get('status')

    if (id) {
      const { data: test, error } = await supabase
        .from('experiment_tests')
        .select(`
          *,
          experiment_folders(id, name),
          experiment_config_model(id, name),
          experiment_test_results(*, experiment_photos(id, image_url, thumbnail_url))
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return NextResponse.json({ test })
    }

    let query = supabase
      .from('experiment_tests')
      .select(`
        *,
        experiment_folders(id, name),
        experiment_config_model(id, name)
      `)
      .order('created_at', { ascending: false })

    if (folderId) {
      query = query.eq('folder_id', folderId)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ tests: data })
  } catch (error) {
    console.error('Error fetching tests:', error)
    return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 })
  }
}

// POST - Créer et lancer un test
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { folder_id, config_model_id, config_type_id, use_universal_only, name, run_immediately = true } = body

    if (!folder_id) {
      return NextResponse.json({ error: 'folder_id is required' }, { status: 400 })
    }

    // Vérifier que le dossier a assez de photos
    const { data: folder } = await supabase
      .from('experiment_folders')
      .select('*, experiment_photos(*)')
      .eq('id', folder_id)
      .single()

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    const photos = folder.experiment_photos || []
    if (photos.length < (folder.min_photos_required || 5)) {
      return NextResponse.json({ 
        error: `Not enough photos. Need ${folder.min_photos_required || 5}, have ${photos.length}` 
      }, { status: 400 })
    }

    // Créer le test
    const { data: test, error: testError } = await supabase
      .from('experiment_tests')
      .insert({
        folder_id,
        config_model_id,
        config_type_id,
        use_universal_only: use_universal_only || false,
        name: name || `Test ${new Date().toLocaleString('fr-FR')}`,
        total_photos: photos.length,
        status: run_immediately ? 'running' : 'pending',
        started_at: run_immediately ? new Date().toISOString() : null
      })
      .select()
      .single()

    if (testError) throw testError

    // Mettre à jour le statut du dossier
    await supabase
      .from('experiment_folders')
      .update({ status: 'testing' })
      .eq('id', folder_id)

    // Si run_immediately, lancer le test
    if (run_immediately) {
      // Construire la config complète
      const config = await buildFullConfig(config_model_id, config_type_id, use_universal_only)
      
      // Exécuter les tests sur chaque photo
      for (const photo of photos) {
        await runTestOnPhoto(test.id, photo, config)
      }

      // Calculer les stats
      await supabase.rpc('calculate_test_stats', { p_test_id: test.id })

      // Mettre à jour le statut
      await supabase
        .from('experiment_tests')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', test.id)

      // Récupérer le test mis à jour
      const { data: updatedTest } = await supabase
        .from('experiment_tests')
        .select('*, experiment_test_results(*)')
        .eq('id', test.id)
        .single()

      return NextResponse.json({ test: updatedTest })
    }

    return NextResponse.json({ test })
  } catch (error) {
    console.error('Error creating test:', error)
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 })
  }
}

// Construire la config complète (universel + type + model)
async function buildFullConfig(
  configModelId?: string | null, 
  configTypeId?: string | null,
  useUniversalOnly?: boolean
): Promise<{
  prompt: string
  preprocessing: Record<string, unknown>
  minConfidence: number
}> {
  // 1. Config universelle (toujours)
  const { data: universal } = await supabase
    .from('experiment_config_universal')
    .select('*')
    .single()

  let prompt = universal?.base_prompt || ''
  let preprocessing = universal?.preprocessing || {}
  let minConfidence = universal?.min_confidence || 0.7

  if (useUniversalOnly) {
    return { prompt, preprocessing, minConfidence }
  }

  // 2. Config type (si spécifié)
  if (configTypeId) {
    const { data: typeConfig } = await supabase
      .from('experiment_config_type')
      .select('*')
      .eq('id', configTypeId)
      .single()

    if (typeConfig) {
      if (typeConfig.additional_prompt) {
        prompt += '\n\n' + typeConfig.additional_prompt
      }
      if (typeConfig.preprocessing_override) {
        preprocessing = { ...preprocessing, ...typeConfig.preprocessing_override }
      }
    }
  }

  // 3. Config model (si spécifié)
  if (configModelId) {
    const { data: modelConfig } = await supabase
      .from('experiment_config_model')
      .select('*, experiment_config_type(*)')
      .eq('id', configModelId)
      .single()

    if (modelConfig) {
      // Ajouter le type si pas déjà fait
      if (!configTypeId && modelConfig.experiment_config_type) {
        const typeConfig = modelConfig.experiment_config_type
        if (typeConfig.additional_prompt) {
          prompt += '\n\n' + typeConfig.additional_prompt
        }
        if (typeConfig.preprocessing_override) {
          preprocessing = { ...preprocessing, ...typeConfig.preprocessing_override }
        }
      }

      // Ajouter le spécifique model
      if (modelConfig.specific_prompt) {
        prompt += '\n\n' + modelConfig.specific_prompt
      }
      if (modelConfig.preprocessing_override) {
        preprocessing = { ...preprocessing, ...modelConfig.preprocessing_override }
      }
    }
  }

  return { prompt, preprocessing, minConfidence }
}

// Exécuter le test sur une photo
async function runTestOnPhoto(
  testId: string,
  photo: { id: string; image_url: string; ground_truth?: Record<string, unknown> },
  config: { prompt: string; preprocessing: Record<string, unknown>; minConfidence: number }
): Promise<void> {
  const startTime = Date.now()

  try {
    // Fetch l'image
    const imageResponse = await fetch(photo.image_url)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')

    // Appel Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: config.prompt
            }
          ]
        }
      ]
    })

    const processingTime = Date.now() - startTime
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
    const apiCost = (response.usage?.input_tokens || 0) / 1000000 * 3 + (response.usage?.output_tokens || 0) / 1000000 * 15

    // Parser la réponse
    const textContent = response.content.find(c => c.type === 'text')
    const responseText = textContent?.type === 'text' ? textContent.text : ''
    
    let actualResult: Record<string, unknown> = {}
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        actualResult = JSON.parse(jsonMatch[0])
      }
    } catch {
      actualResult = { error: 'Failed to parse response', raw: responseText }
    }

    // Comparer avec ground truth si disponible
    let isCorrect: boolean | null = null
    if (photo.ground_truth) {
      const gt = photo.ground_truth as { reading?: string }
      const ar = actualResult as { reading?: string }
      isCorrect = gt.reading === ar.reading
    }

    // Enregistrer le résultat
    await supabase
      .from('experiment_test_results')
      .insert({
        test_id: testId,
        photo_id: photo.id,
        config_snapshot: config,
        expected_result: photo.ground_truth || null,
        actual_result: actualResult,
        confidence_score: (actualResult as { confidence?: number }).confidence || 0,
        processing_time_ms: processingTime,
        tokens_used: tokensUsed,
        api_cost_usd: apiCost,
        is_correct: isCorrect
      })

    // Mettre à jour le statut de la photo
    await supabase
      .from('experiment_photos')
      .update({ status: 'tested' })
      .eq('id', photo.id)

  } catch (error) {
    // Enregistrer l'erreur
    await supabase
      .from('experiment_test_results')
      .insert({
        test_id: testId,
        photo_id: photo.id,
        config_snapshot: config,
        actual_result: { error: String(error) },
        is_correct: false
      })
  }
}

// PUT - Mettre à jour un résultat (correction manuelle)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { result_id, is_correct, corrected_result, error_type, error_details } = body

    if (!result_id) {
      return NextResponse.json({ error: 'result_id is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    
    if (is_correct !== undefined) updates.is_correct = is_correct
    if (corrected_result) {
      updates.corrected_result = corrected_result
      updates.corrected_at = new Date().toISOString()
    }
    if (error_type) updates.error_type = error_type
    if (error_details) updates.error_details = error_details

    const { data, error } = await supabase
      .from('experiment_test_results')
      .update(updates)
      .eq('id', result_id)
      .select()
      .single()

    if (error) throw error

    // Recalculer les stats du test
    if (data?.test_id) {
      await supabase.rpc('calculate_test_stats', { p_test_id: data.test_id })
    }

    return NextResponse.json({ result: data })
  } catch (error) {
    console.error('Error updating result:', error)
    return NextResponse.json({ error: 'Failed to update result' }, { status: 500 })
  }
}

// DELETE - Supprimer un test
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Les résultats seront supprimés en cascade
    const { error } = await supabase
      .from('experiment_tests')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting test:', error)
    return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 })
  }
}
