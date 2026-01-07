import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Create new version (snapshot of active models)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      codename,
      version_number,
      description,
      changelog,
      default_image_config
    } = body

    if (!codename || !version_number) {
      return NextResponse.json(
        { error: 'codename et version_number requis' },
        { status: 400 }
      )
    }

    // Check if version already exists
    const { data: existing } = await supabase
      .from('recognition_versions')
      .select('id')
      .eq('codename', codename)
      .eq('version_number', version_number)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Cette version existe déjà' },
        { status: 400 }
      )
    }

    // Get all active models for snapshot
    const { data: activeModels } = await supabase
      .from('meter_models')
      .select('id, name, ai_description, image_config_overrides, reading_zones')
      .eq('status', 'active')

    // Create snapshot of models
    const modelsSnapshot = (activeModels || []).map(m => ({
      id: m.id,
      name: m.name,
      prompt: m.ai_description,
      config: m.image_config_overrides,
      zones: m.reading_zones
    }))

    // Deactivate current default version
    await supabase
      .from('recognition_versions')
      .update({ is_default: false })
      .eq('is_default', true)

    // Create new version
    const { data: newVersion, error: insertError } = await supabase
      .from('recognition_versions')
      .insert({
        codename,
        version_number,
        display_name: `${codename.charAt(0).toUpperCase() + codename.slice(1)} ${version_number}`,
        description,
        changelog,
        status: 'development',
        is_default: true,
        default_image_config: default_image_config || {
          grayscale: true,
          contrast: 30,
          brightness: 0,
          sharpness: 20,
          auto_crop: true,
          max_dimension: 1024,
          jpeg_quality: 85
        },
        models_snapshot: modelsSnapshot,
        models_count: modelsSnapshot.length
      })
      .select()
      .single()

    if (insertError) {
      console.error('Create version error:', insertError)
      return NextResponse.json(
        { error: 'Erreur lors de la création' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      version: newVersion
    })

  } catch (error: any) {
    console.error('Version creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// GET - List all versions
export async function GET(request: NextRequest) {
  const { data, error } = await supabase
    .from('recognition_versions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ versions: data })
}

// PATCH - Activate a version or update status
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { version_id, action, status } = body

    if (!version_id) {
      return NextResponse.json({ error: 'version_id requis' }, { status: 400 })
    }

    if (action === 'activate') {
      // Deactivate all versions
      await supabase
        .from('recognition_versions')
        .update({ is_default: false })
        .neq('id', 'none')

      // Activate selected version
      const { error } = await supabase
        .from('recognition_versions')
        .update({ is_default: true })
        .eq('id', version_id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Version activée' })
    }

    if (action === 'update_status' && status) {
      const { error } = await supabase
        .from('recognition_versions')
        .update({ status })
        .eq('id', version_id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Status mis à jour' })
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
