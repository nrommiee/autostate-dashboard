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
    const level = searchParams.get('level') // 'universal', 'type', 'model', 'all'
    const type = searchParams.get('type') // alias pour level (legacy)
    const meterType = searchParams.get('meter_type') // 'gas', 'water', 'electricity'
    const id = searchParams.get('id')
    const folderId = searchParams.get('folder_id')
    
    const queryLevel = level || type
    
    // Config universelle
    if (queryLevel === 'universal') {
      const { data, error } = await supabase
        .from('experiment_config_universal')
        .select('*')
        .single()
      
      if (error) throw error
      return NextResponse.json({ universal: data, config: data }, { headers: corsHeaders })
    }
    
    // Config par type
    if (queryLevel === 'type') {
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
      return NextResponse.json({ type: data, config: data, configs: Array.isArray(data) ? data : [data] }, { headers: corsHeaders })
    }
    
    // Config par modèle
    if (queryLevel === 'model') {
      if (id) {
        const { data, error } = await supabase
          .from('experiment_config_model')
          .select('*')
          .eq('id', id)
          .single()
        
        if (error) throw error
        return NextResponse.json({ model: data, config: data }, { headers: corsHeaders })
      }
      
      const { data, error } = await supabase
        .from('experiment_config_model')
        .select('*')
        .eq('is_active', true)
        .order('name')
      
      if (error) throw error
      return NextResponse.json({ models: data, configs: data }, { headers: corsHeaders })
    }
    
    // Toutes les configs (level=all)
    if (queryLevel === 'all') {
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
    }
    
    // Par folder_id - récupérer la config liée au dossier
    if (folderId) {
      // Récupérer le dossier avec son config_model_id
      const { data: folder, error: folderError } = await supabase
        .from('experiment_folders')
        .select('id, name, detected_type, config_model_id')
        .eq('id', folderId)
        .single()
      
      if (folderError) throw folderError
      
      // Récupérer la config universelle
      const { data: universal } = await supabase
        .from('experiment_config_universal')
        .select('*')
        .single()
      
      // Récupérer la config type correspondante
      const { data: typeConfig } = await supabase
        .from('experiment_config_type')
        .select('*')
        .eq('meter_type', folder.detected_type)
        .eq('is_active', true)
        .single()
      
      // Récupérer la config modèle si elle existe
      let modelConfig = null
      if (folder.config_model_id) {
        const { data } = await supabase
          .from('experiment_config_model')
          .select('*')
          .eq('id', folder.config_model_id)
          .single()
        modelConfig = data
      }
      
      return NextResponse.json({
        folder,
        universal,
        type: typeConfig,
        model: modelConfig,
        // Pour compatibilité avec l'ancien format
        configs: modelConfig ? [modelConfig] : []
      }, { headers: corsHeaders })
    }
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

// POST - Créer une nouvelle config modèle (depuis le dashboard FolderTestPage)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      // Nouveau format depuis FolderTestPage
      folder_id,
      preprocessing,
      zones,
      index_config,
      prompt_model,
      // Ancien format direct
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
    
    // ═══════════════════════════════════════════════════════════════
    // NOUVEAU FORMAT: Depuis le dashboard FolderTestPage
    // ═══════════════════════════════════════════════════════════════
    if (folder_id) {
      // Récupérer le dossier pour avoir le nom et type
      const { data: folder, error: folderError } = await supabase
        .from('experiment_folders')
        .select('id, name, detected_type, config_model_id')
        .eq('id', folder_id)
        .single()
      
      if (folderError || !folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404, headers: corsHeaders })
      }
      
      // Récupérer le type_config_id correspondant au detected_type
      const { data: typeConfig } = await supabase
        .from('experiment_config_type')
        .select('id')
        .eq('meter_type', folder.detected_type)
        .eq('is_active', true)
        .single()
      
      // Convertir les données du dashboard en format config_model
      const configData = {
        name: folder.name, // Utilise le nom du dossier
        manufacturer: folder.name.split(' ')[0], // Premier mot = fabricant (APATOR, ITRON, etc.)
        type_config_id: typeConfig?.id || null,
        specific_prompt: prompt_model || null,
        preprocessing_override: preprocessing || null,
        extraction_zones: zones || [],
        visual_characteristics: index_config ? {
          num_digits: index_config.integerDigits,
          num_decimals: index_config.decimalDigits,
          display_type: 'mechanical' // Par défaut
        } : null,
        is_active: true
      }
      
      let configId = folder.config_model_id
      
      if (configId) {
        // Mettre à jour la config existante
        const { data: updatedConfig, error: updateError } = await supabase
          .from('experiment_config_model')
          .update({
            ...configData,
            updated_at: new Date().toISOString()
          })
          .eq('id', configId)
          .select()
          .single()
        
        if (updateError) throw updateError
        return NextResponse.json({ config: updatedConfig, updated: true }, { headers: corsHeaders })
        
      } else {
        // Créer une nouvelle config
        const { data: newConfig, error: insertError } = await supabase
          .from('experiment_config_model')
          .insert(configData)
          .select()
          .single()
        
        if (insertError) throw insertError
        
        // Lier la config au dossier
        const { error: linkError } = await supabase
          .from('experiment_folders')
          .update({ config_model_id: newConfig.id })
          .eq('id', folder_id)
        
        if (linkError) {
          console.error('Error linking config to folder:', linkError)
        }
        
        return NextResponse.json({ config: newConfig, created: true, linked: !linkError }, { headers: corsHeaders })
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ANCIEN FORMAT: Création directe
    // ═══════════════════════════════════════════════════════════════
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
