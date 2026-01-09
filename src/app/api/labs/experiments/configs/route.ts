import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Récupérer les configs (hiérarchie complète)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level') // 'universal', 'type', 'model', 'all'
    const typeId = searchParams.get('type_id')
    const modelId = searchParams.get('model_id')

    if (level === 'universal' || !level) {
      const { data, error } = await supabase
        .from('experiment_config_universal')
        .select('*')
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      
      if (level === 'universal') {
        return NextResponse.json({ universal: data })
      }
    }

    if (level === 'type' || !level) {
      let query = supabase.from('experiment_config_type').select('*')
      if (typeId) {
        query = query.eq('id', typeId)
      }
      const { data, error } = await query.order('meter_type')
      
      if (error) throw error
      
      if (level === 'type') {
        return NextResponse.json({ types: data })
      }
    }

    if (level === 'model' || !level) {
      let query = supabase
        .from('experiment_config_model')
        .select('*, experiment_config_type(meter_type, name)')
      
      if (modelId) {
        query = query.eq('id', modelId)
      }
      if (typeId) {
        query = query.eq('type_config_id', typeId)
      }
      
      const { data, error } = await query.order('name')
      
      if (error) throw error
      
      if (level === 'model') {
        return NextResponse.json({ models: data })
      }
    }

    // Si 'all' ou pas de level, retourner tout
    const [universalRes, typesRes, modelsRes] = await Promise.all([
      supabase.from('experiment_config_universal').select('*').single(),
      supabase.from('experiment_config_type').select('*').order('meter_type'),
      supabase.from('experiment_config_model').select('*, experiment_config_type(meter_type, name)').order('name')
    ])

    return NextResponse.json({
      universal: universalRes.data,
      types: typesRes.data || [],
      models: modelsRes.data || []
    })
  } catch (error) {
    console.error('Error fetching configs:', error)
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 })
  }
}

// POST - Créer une config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { level, ...data } = body

    if (!level) {
      return NextResponse.json({ error: 'level is required (universal, type, model)' }, { status: 400 })
    }

    let result
    
    if (level === 'universal') {
      // Update plutôt que insert (une seule ligne)
      const { data: updated, error } = await supabase
        .from('experiment_config_universal')
        .update({
          base_prompt: data.base_prompt,
          preprocessing: data.preprocessing,
          min_confidence: data.min_confidence,
          multi_pass_enabled: data.multi_pass_enabled,
          multi_pass_count: data.multi_pass_count,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id)
        .select()
        .single()
      
      if (error) throw error
      result = updated
    }
    
    else if (level === 'type') {
      const { data: inserted, error } = await supabase
        .from('experiment_config_type')
        .upsert({
          meter_type: data.meter_type,
          name: data.name,
          additional_prompt: data.additional_prompt,
          preprocessing_override: data.preprocessing_override,
          reading_format_regex: data.reading_format_regex,
          typical_unit: data.typical_unit,
          decimal_places: data.decimal_places,
          updated_at: new Date().toISOString()
        }, { onConflict: 'meter_type' })
        .select()
        .single()
      
      if (error) throw error
      result = inserted
    }
    
    else if (level === 'model') {
      const { data: inserted, error } = await supabase
        .from('experiment_config_model')
        .insert({
          type_config_id: data.type_config_id,
          meter_model_id: data.meter_model_id,
          name: data.name,
          manufacturer: data.manufacturer,
          model_reference: data.model_reference,
          specific_prompt: data.specific_prompt,
          preprocessing_override: data.preprocessing_override,
          extraction_zones: data.extraction_zones,
          visual_characteristics: data.visual_characteristics,
          reading_format_regex: data.reading_format_regex
        })
        .select()
        .single()
      
      if (error) throw error
      result = inserted
    }

    return NextResponse.json({ config: result })
  } catch (error) {
    console.error('Error creating config:', error)
    return NextResponse.json({ error: 'Failed to create config' }, { status: 500 })
  }
}

// PUT - Mettre à jour une config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { level, id, ...updates } = body

    if (!level || !id) {
      return NextResponse.json({ error: 'level and id are required' }, { status: 400 })
    }

    const tableName = level === 'universal' 
      ? 'experiment_config_universal'
      : level === 'type'
        ? 'experiment_config_type'
        : 'experiment_config_model'

    // Incrémenter version
    const { data: current } = await supabase
      .from(tableName)
      .select('version')
      .eq('id', id)
      .single()

    const { data, error } = await supabase
      .from(tableName)
      .update({
        ...updates,
        version: (current?.version || 0) + 1,
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

// DELETE - Supprimer une config model (pas universal ni type)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const level = searchParams.get('level')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    if (level === 'universal') {
      return NextResponse.json({ error: 'Cannot delete universal config' }, { status: 400 })
    }

    if (level === 'type') {
      return NextResponse.json({ error: 'Cannot delete type config' }, { status: 400 })
    }

    const { error } = await supabase
      .from('experiment_config_model')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting config:', error)
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 })
  }
}
