import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Liste les versions d'un modèle avec leurs stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('model_id')

    if (!modelId) {
      return NextResponse.json({ error: 'model_id requis' }, { status: 400 })
    }

    // Récupérer les versions
    const { data: versions, error } = await supabase
      .from('model_versions')
      .select('*')
      .eq('model_id', modelId)
      .order('version_number', { ascending: false })

    if (error) throw error

    // Récupérer les stats de tests pour chaque version
    const { data: experiments } = await supabase
      .from('lab_experiments')
      .select('version_id, status, confidence')
      .eq('meter_model_id', modelId)

    // Calculer les stats par version
    const versionsWithStats = (versions || []).map(v => {
      const versionTests = (experiments || []).filter(e => e.version_id === v.id)
      const validated = versionTests.filter(e => e.status === 'validated' || e.status === 'corrected')
      const rejected = versionTests.filter(e => e.status === 'rejected')
      const avgConfidence = versionTests.length > 0 
        ? versionTests.reduce((sum, e) => sum + (e.confidence || 0), 0) / versionTests.length 
        : 0

      return {
        ...v,
        stats: {
          total_tests: versionTests.length,
          validated: validated.length,
          corrected: versionTests.filter(e => e.status === 'corrected').length,
          rejected: rejected.length,
          success_rate: versionTests.length > 0 
            ? Math.round((validated.length / versionTests.length) * 100) 
            : null,
          avg_confidence: Math.round(avgConfidence * 100) / 100
        }
      }
    })

    return NextResponse.json({ versions: versionsWithStats })

  } catch (error: any) {
    console.error('Get model versions error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Créer une nouvelle version
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { model_id, prompt_text, image_config, notes, activate } = body

    if (!model_id || !prompt_text) {
      return NextResponse.json(
        { error: 'model_id et prompt_text requis' },
        { status: 400 }
      )
    }

    // Trouver le prochain numéro de version
    const { data: existing } = await supabase
      .from('model_versions')
      .select('version_number')
      .eq('model_id', model_id)
      .order('version_number', { ascending: false })
      .limit(1)

    const nextVersion = existing && existing.length > 0 
      ? existing[0].version_number + 1 
      : 1

    // Créer la version
    const { data: newVersion, error } = await supabase
      .from('model_versions')
      .insert({
        model_id,
        version_number: nextVersion,
        prompt_text,
        image_config: image_config || { grayscale: false, contrast: 0, brightness: 0 },
        is_active: activate === true,
        notes
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      version: newVersion,
      message: `Version v${nextVersion} créée${activate ? ' et activée' : ''}`
    })

  } catch (error: any) {
    console.error('Create model version error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Activer une version ou mettre à jour
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { version_id, action, updates } = body

    if (!version_id) {
      return NextResponse.json({ error: 'version_id requis' }, { status: 400 })
    }

    if (action === 'activate') {
      // Le trigger SQL désactive automatiquement les autres versions
      const { error } = await supabase
        .from('model_versions')
        .update({ is_active: true })
        .eq('id', version_id)

      if (error) throw error

      return NextResponse.json({ success: true, message: 'Version activée' })
    }

    if (action === 'update' && updates) {
      const { error } = await supabase
        .from('model_versions')
        .update(updates)
        .eq('id', version_id)

      if (error) throw error

      return NextResponse.json({ success: true, message: 'Version mise à jour' })
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })

  } catch (error: any) {
    console.error('Update model version error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer une version (sauf si active)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const versionId = searchParams.get('version_id')

    if (!versionId) {
      return NextResponse.json({ error: 'version_id requis' }, { status: 400 })
    }

    // Vérifier que ce n'est pas la version active
    const { data: version } = await supabase
      .from('model_versions')
      .select('is_active')
      .eq('id', versionId)
      .single()

    if (version?.is_active) {
      return NextResponse.json(
        { error: 'Impossible de supprimer la version active' },
        { status: 400 }
      )
    }

    // Supprimer les tests liés
    await supabase
      .from('lab_experiments')
      .delete()
      .eq('version_id', versionId)

    // Supprimer la version
    const { error } = await supabase
      .from('model_versions')
      .delete()
      .eq('id', versionId)

    if (error) throw error

    return NextResponse.json({ success: true, message: 'Version supprimée' })

  } catch (error: any) {
    console.error('Delete model version error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
