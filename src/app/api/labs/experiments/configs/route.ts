import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Liste des configs ou une config spécifique
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type')
    const activeOnly = searchParams.get('active') !== 'false'

    if (id) {
      // Requête pour un seul élément
      const { data, error } = await supabase
        .from('experiment_configs')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return NextResponse.json({ configs: [data] })
    }

    // Requête pour liste
    let query = supabase
      .from('experiment_configs')
      .select('*')
      .order('created_at', { ascending: false })

    if (type) {
      query = query.eq('config_type', type)
    }
    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ configs: data })
  } catch (error) {
    console.error('Error fetching configs:', error)
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 })
  }
}

// POST - Créer une nouvelle config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, config_type, config_data, is_baseline } = body

    if (!name || !config_type) {
      return NextResponse.json(
        { error: 'name and config_type are required' },
        { status: 400 }
      )
    }

    // Valider le type
    const validTypes = ['prompt', 'preprocessing', 'pipeline', 'full']
    if (!validTypes.includes(config_type)) {
      return NextResponse.json(
        { error: `config_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Si c'est une baseline, désactiver les autres baselines du même type
    if (is_baseline) {
      await supabase
        .from('experiment_configs')
        .update({ is_baseline: false })
        .eq('config_type', config_type)
        .eq('is_baseline', true)
    }

    const { data, error } = await supabase
      .from('experiment_configs')
      .insert({
        name,
        description,
        config_type,
        config_data: config_data || {},
        is_baseline: is_baseline || false,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ config: data })
  } catch (error) {
    console.error('Error creating config:', error)
    return NextResponse.json({ error: 'Failed to create config' }, { status: 500 })
  }
}

// PUT - Mettre à jour une config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Si on active is_baseline, désactiver les autres
    if (updates.is_baseline) {
      const { data: current } = await supabase
        .from('experiment_configs')
        .select('config_type')
        .eq('id', id)
        .single()

      if (current) {
        await supabase
          .from('experiment_configs')
          .update({ is_baseline: false })
          .eq('config_type', current.config_type)
          .eq('is_baseline', true)
          .neq('id', id)
      }
    }

    const { data, error } = await supabase
      .from('experiment_configs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ config: data })
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}

// DELETE - Supprimer une config (soft delete via is_active)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const hard = searchParams.get('hard') === 'true'

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    if (hard) {
      // Suppression définitive
      const { error } = await supabase
        .from('experiment_configs')
        .delete()
        .eq('id', id)

      if (error) throw error
    } else {
      // Soft delete
      const { error } = await supabase
        .from('experiment_configs')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting config:', error)
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 })
  }
}
