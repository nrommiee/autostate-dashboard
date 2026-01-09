import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Promouvoir un dossier validé vers meter_models
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { folder_id, config_model_id, name, manufacturer, meter_type } = body

    if (!folder_id) {
      return NextResponse.json({ error: 'folder_id is required' }, { status: 400 })
    }

    // Récupérer le dossier avec ses infos
    const { data: folder, error: folderError } = await supabase
      .from('experiment_folders')
      .select(`
        *,
        experiment_config_model(*),
        experiment_photos(*)
      `)
      .eq('id', folder_id)
      .single()

    if (folderError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Vérifier que le dossier est validé ou prêt
    if (!['ready', 'validated'].includes(folder.status)) {
      return NextResponse.json({ 
        error: 'Folder must be validated before promotion' 
      }, { status: 400 })
    }

    // Si déjà lié à un modèle existant, mettre à jour ce modèle
    if (folder.linked_meter_model_id) {
      const { data: updatedModel, error: updateError } = await supabase
        .from('meter_models')
        .update({
          model_config_id: config_model_id || folder.config_model_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', folder.linked_meter_model_id)
        .select()
        .single()

      if (updateError) throw updateError

      // Marquer le dossier comme promu
      await supabase
        .from('experiment_folders')
        .update({ status: 'promoted' })
        .eq('id', folder_id)

      // Marquer la config comme promue
      if (config_model_id || folder.config_model_id) {
        await supabase
          .from('experiment_config_model')
          .update({ 
            is_promoted: true,
            promoted_at: new Date().toISOString(),
            meter_model_id: folder.linked_meter_model_id
          })
          .eq('id', config_model_id || folder.config_model_id)
      }

      return NextResponse.json({ 
        action: 'updated',
        meter_model: updatedModel 
      })
    }

    // Sinon, créer un nouveau modèle
    const configModel = folder.experiment_config_model

    // Récupérer le type config pour avoir le meter_type
    let meterType = meter_type || folder.detected_type
    if (configModel?.type_config_id) {
      const { data: typeConfig } = await supabase
        .from('experiment_config_type')
        .select('meter_type')
        .eq('id', configModel.type_config_id)
        .single()
      
      if (typeConfig) {
        meterType = typeConfig.meter_type
      }
    }

    // Créer le meter_model
    const { data: newModel, error: createError } = await supabase
      .from('meter_models')
      .insert({
        name: name || folder.name || configModel?.name || 'Nouveau compteur',
        manufacturer: manufacturer || configModel?.manufacturer,
        meter_type: meterType || 'gas',
        display_type: (configModel?.visual_characteristics as { display_type?: string })?.display_type || 'mechanical',
        is_active: true,
        model_config_id: config_model_id || folder.config_model_id
      })
      .select()
      .single()

    if (createError) throw createError

    // Lier le dossier au nouveau modèle
    await supabase
      .from('experiment_folders')
      .update({ 
        status: 'promoted',
        linked_meter_model_id: newModel.id
      })
      .eq('id', folder_id)

    // Marquer la config comme promue
    if (config_model_id || folder.config_model_id) {
      await supabase
        .from('experiment_config_model')
        .update({ 
          is_promoted: true,
          promoted_at: new Date().toISOString(),
          meter_model_id: newModel.id
        })
        .eq('id', config_model_id || folder.config_model_id)
    }

    // Optionnel: Copier les photos de référence vers meter_model_photos
    const referencePhotos = (folder.experiment_photos || []).filter(
      (p: { status: string }) => p.status === 'reference' || p.status === 'validated'
    )

    if (referencePhotos.length > 0) {
      const photoInserts = referencePhotos.slice(0, 5).map((p: { image_url: string }, index: number) => ({
        meter_model_id: newModel.id,
        photo_url: p.image_url,
        is_reference: index === 0,
        display_order: index
      }))

      await supabase
        .from('meter_model_photos')
        .insert(photoInserts)
    }

    return NextResponse.json({ 
      action: 'created',
      meter_model: newModel 
    })
  } catch (error) {
    console.error('Error promoting folder:', error)
    return NextResponse.json({ error: 'Failed to promote folder' }, { status: 500 })
  }
}

// GET - Vérifier si un dossier peut être promu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folder_id')

    if (!folderId) {
      return NextResponse.json({ error: 'folder_id is required' }, { status: 400 })
    }

    const { data: folder } = await supabase
      .from('experiment_folders')
      .select(`
        *,
        experiment_tests(accuracy_rate, status)
      `)
      .eq('id', folderId)
      .single()

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Vérifier les conditions
    const tests = folder.experiment_tests || []
    const completedTests = tests.filter((t: { status: string }) => t.status === 'completed')
    const bestAccuracy = Math.max(...completedTests.map((t: { accuracy_rate: number }) => t.accuracy_rate || 0), 0)

    const canPromote = 
      folder.photo_count >= (folder.min_photos_required || 5) &&
      completedTests.length > 0 &&
      bestAccuracy >= 0.7 // Au moins 70% de précision

    return NextResponse.json({
      can_promote: canPromote,
      reasons: {
        has_enough_photos: folder.photo_count >= (folder.min_photos_required || 5),
        has_completed_tests: completedTests.length > 0,
        has_good_accuracy: bestAccuracy >= 0.7,
        best_accuracy: bestAccuracy
      },
      is_linked_to_existing: !!folder.linked_meter_model_id
    })
  } catch (error) {
    console.error('Error checking promotion eligibility:', error)
    return NextResponse.json({ error: 'Failed to check eligibility' }, { status: 500 })
  }
}
