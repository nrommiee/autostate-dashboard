import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Liste des batches ou un batch spécifique
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (id) {
      // Batch spécifique avec ses runs
      const { data: batch, error } = await supabase
        .from('experiment_batches')
        .select(`
          *,
          experiment_configs(name, config_type),
          experiment_runs(id, status, is_correct, confidence_score, processing_time_ms)
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      return NextResponse.json({ batch })
    }

    // Liste des batches
    let query = supabase
      .from('experiment_batches')
      .select('*, experiment_configs(name, config_type)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ batches: data })
  } catch (error) {
    console.error('Error fetching batches:', error)
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 })
  }
}

// POST - Créer un nouveau batch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, config_id, image_ids } = body

    if (!name || !config_id) {
      return NextResponse.json(
        { error: 'name and config_id are required' },
        { status: 400 }
      )
    }

    // Vérifier que la config existe
    const { data: config, error: configError } = await supabase
      .from('experiment_configs')
      .select('id')
      .eq('id', config_id)
      .single()

    if (configError || !config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    // Créer le batch
    const { data: batch, error: batchError } = await supabase
      .from('experiment_batches')
      .insert({
        name,
        description,
        config_id,
        status: 'draft'
      })
      .select()
      .single()

    if (batchError) throw batchError

    // Si des images sont fournies, créer les runs en pending
    if (image_ids && image_ids.length > 0) {
      // Récupérer les infos des images
      const { data: images } = await supabase
        .from('experiment_images')
        .select('*')
        .in('id', image_ids)

      if (images && images.length > 0) {
        const runs = images.map(img => ({
          config_id,
          batch_id: batch.id,
          image_url: img.image_url,
          image_hash: img.image_hash,
          expected_result: img.ground_truth,
          status: 'pending'
        }))

        await supabase.from('experiment_runs').insert(runs)

        // Mettre à jour le compteur du batch
        await supabase
          .from('experiment_batches')
          .update({ total_runs: runs.length })
          .eq('id', batch.id)
      }
    }

    return NextResponse.json({ batch })
  } catch (error) {
    console.error('Error creating batch:', error)
    return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 })
  }
}

// PUT - Démarrer/Arrêter un batch
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, action } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
    }

    const validActions = ['start', 'cancel', 'recalculate']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      )
    }

    if (action === 'start') {
      // Démarrer le batch
      await supabase
        .from('experiment_batches')
        .update({
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', id)

      // Lancer les runs en background (dans une vraie app, utiliser une queue)
      // Pour l'instant, on marque juste comme running
      await supabase
        .from('experiment_runs')
        .update({ status: 'pending' })
        .eq('batch_id', id)
        .eq('status', 'pending')

      // Note: L'exécution réelle des runs devrait être faite par un worker
      // ou via des appels individuels à /api/labs/experiments/runs

      return NextResponse.json({ success: true, message: 'Batch started' })
    }

    if (action === 'cancel') {
      await supabase
        .from('experiment_batches')
        .update({ status: 'cancelled' })
        .eq('id', id)

      return NextResponse.json({ success: true, message: 'Batch cancelled' })
    }

    if (action === 'recalculate') {
      // Recalculer les stats
      await supabase.rpc('calculate_batch_stats', { p_batch_id: id })

      // Vérifier si tous les runs sont terminés
      const { data: batch } = await supabase
        .from('experiment_batches')
        .select('total_runs, completed_runs')
        .eq('id', id)
        .single()

      if (batch && batch.completed_runs >= batch.total_runs) {
        await supabase
          .from('experiment_batches')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', id)
      }

      const { data: updatedBatch } = await supabase
        .from('experiment_batches')
        .select('*')
        .eq('id', id)
        .single()

      return NextResponse.json({ batch: updatedBatch })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating batch:', error)
    return NextResponse.json({ error: 'Failed to update batch' }, { status: 500 })
  }
}

// DELETE - Supprimer un batch et ses runs
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Supprimer les corrections associées aux runs du batch
    const { data: runs } = await supabase
      .from('experiment_runs')
      .select('id')
      .eq('batch_id', id)

    if (runs && runs.length > 0) {
      const runIds = runs.map(r => r.id)
      await supabase
        .from('experiment_corrections')
        .delete()
        .in('run_id', runIds)
    }

    // Supprimer les runs du batch
    await supabase
      .from('experiment_runs')
      .delete()
      .eq('batch_id', id)

    // Supprimer le batch
    const { error } = await supabase
      .from('experiment_batches')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting batch:', error)
    return NextResponse.json({ error: 'Failed to delete batch' }, { status: 500 })
  }
}
