import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// GET - Récupérer les configurations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'universal', 'type', 'model'
    const meterType = searchParams.get('meter_type') // 'gas', 'water', 'electricity'
    const id = searchParams.get('id')
    
    // Config universelle
    if (type === 'universal') {
      const { data, error } = await supabase
        .from('experiment_config_universal')
        .select('*')
        .single()
      
      if (error) throw error
      return NextResponse.json({ config: data }, { headers: corsHeaders })
    }
    
    // Config par type
    if (type === 'type') {
      let query = supabase
        .from('experiment_config_type')
        .select('*')
        .eq('is_active', true)
      
      if (meterType) {
        query = query.eq('meter_type', meterType)
      }
      
      const { data, error } = meterType 
        ? await query.single()
        : await query
      
      if (error && error.code !== 'PGRST116') throw error
      return NextResponse.json({ config: data, configs: Array.isArray(data) ? data : [data] }, { headers: corsHeaders })
    }
    
    // Config par modèle
    if (type === 'model') {
      if (id) {
        const { data, error } = await supabase
          .from('experiment_config_model')
          .select('*')
          .eq('id', id)
          .single()
        
        if (error) throw error
        return NextResponse.json({ config: data }, { headers: corsHeaders })
      }
      
      const { data, error } = await supabase
        .from('experiment_config_model')
        .select('*')
        .eq('is_active', true)
        .order('name')
      
      if (error) throw error
      return NextResponse.json({ configs: data }, { headers: corsHeaders })
    }
    
    // Toutes les configs
    const [universal, types, models] = await Promise.all([
      supabase.from('experiment_config_universal').select('*').single(),
      supabase.from('experiment_config_type').select('*').eq('is_active', true),
      supabase.from('experiment_config_model').select('*').eq('is_active', true).order('name')
    ])
    
    return NextResponse.json({
      universal: universal.data,
      types: types.data,
      models: models.data
    }, { headers: corsHeaders })
    
  } catch (error) {
    console.error('Error fetching configs:', error)
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500, headers: corsHeaders })
  }
}

// POST - Créer une nouvelle config modèle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      manufacturer,
      type_config_id,
      meter_model_id,
      specific_prompt,
      preprocessing_override,
      extraction_zones,
      visual_characteristics,
      reading_format_regex
    } = body
    
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400, headers: corsHeaders })
    }
    
    const { data, error } = await supabase
      .from('experiment_config_model')
      .insert({
        name,
        manufacturer,
        type_config_id,
        meter_model_id,
        specific_prompt,
        preprocessing_override,
        extraction_zones: extraction_zones || [],
        visual_characteristics: visual_characteristics || {},
        reading_format_regex
      })
      .select()
      .single()
    
    if (error) throw error
    return NextResponse.json({ config: data }, { headers: corsHeaders })
    
  } catch (error) {
    console.error('Error creating config:', error)
    return NextResponse.json({ error: 'Failed to create config' }, { status: 500, headers: corsHeaders })
  }
}

// PUT - Mettre à jour une config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, type, ...updates } = body
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: corsHeaders })
    }
    
    // Déterminer la table selon le type
    let table = 'experiment_config_model' // Par défaut
    if (type === 'universal') {
      table = 'experiment_config_universal'
    } else if (type === 'type') {
      table = 'experiment_config_type'
    }
    
    // Filtrer les champs autorisés selon le type
    const allowedFields: Record<string, string[]> = {
      'experiment_config_universal': ['base_prompt', 'default_preprocessing', 'min_confidence', 'multi_pass_enabled', 'multi_pass_count'],
      'experiment_config_type': ['additional_prompt', 'preprocessing_override', 'reading_format_regex', 'typical_unit', 'decimal_places'],
      'experiment_config_model': ['name', 'manufacturer', 'specific_prompt', 'preprocessing_override', 'extraction_zones', 'visual_characteristics', 'reading_format_regex']
    }
    
    const filteredUpdates: Record<string, any> = {}
    for (const field of allowedFields[table] || []) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }
    
    filteredUpdates.updated_at = new Date().toISOString()
    
    const { data, error } = await supabase
      .from(table)
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return NextResponse.json({ config: data }, { headers: corsHeaders })
    
  } catch (error) {
    console.error('Error updating config:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500, headers: corsHeaders })
  }
}

// DELETE - Désactiver une config modèle
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: corsHeaders })
    }
    
    // On ne supprime pas vraiment, on désactive
    const { error } = await supabase
      .from('experiment_config_model')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    
    if (error) throw error
    return NextResponse.json({ success: true }, { headers: corsHeaders })
    
  } catch (error) {
    console.error('Error deleting config:', error)
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500, headers: corsHeaders })
  }
}
