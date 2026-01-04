import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// ============================================
// POST - Enregistrer une correction
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      model_id,
      zone_type,
      ai_value,
      human_value,
      photo_url,
      confidence
    } = body

    if (!zone_type || !ai_value || !human_value) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Ne pas enregistrer si identique
    if (ai_value === human_value) {
      return NextResponse.json({ message: 'Pas de correction nécessaire' })
    }

    // Déterminer le type d'erreur
    const error_type = detectErrorType(ai_value, human_value)

    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('meter_corrections')
      .insert({
        model_id,
        zone_type,
        ai_value,
        human_value,
        error_type,
        photo_url,
        confidence
      })
      .select()
      .single()

    if (error) throw error

    // Mettre à jour les règles du modèle si pattern détecté
    if (model_id && error_type) {
      await updateModelRules(supabase, model_id, error_type)
    }

    return NextResponse.json({ 
      success: true, 
      correction: data,
      error_type 
    })

  } catch (error) {
    console.error('Correction save error:', error)
    return NextResponse.json({ error: 'Erreur sauvegarde' }, { status: 500 })
  }
}

// ============================================
// GET - Récupérer les corrections d'un modèle
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const model_id = searchParams.get('model_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = createAdminClient()
    
    let query = supabase
      .from('meter_corrections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (model_id) {
      query = query.eq('model_id', model_id)
    }

    const { data, error } = await query

    if (error) throw error

    // Statistiques
    const stats = {
      total: data?.length || 0,
      by_type: {} as Record<string, number>,
      by_zone: {} as Record<string, number>
    }

    data?.forEach(c => {
      if (c.error_type) {
        stats.by_type[c.error_type] = (stats.by_type[c.error_type] || 0) + 1
      }
      stats.by_zone[c.zone_type] = (stats.by_zone[c.zone_type] || 0) + 1
    })

    return NextResponse.json({ corrections: data, stats })

  } catch (error) {
    console.error('Corrections fetch error:', error)
    return NextResponse.json({ error: 'Erreur récupération' }, { status: 500 })
  }
}

// ============================================
// HELPERS
// ============================================

function detectErrorType(aiValue: string, humanValue: string): string {
  const ai = aiValue.replace(/[^0-9,\.]/g, '')
  const human = humanValue.replace(/[^0-9,\.]/g, '')
  
  // Position de la virgule différente
  const aiCommaPos = ai.indexOf(',') !== -1 ? ai.indexOf(',') : ai.indexOf('.')
  const humanCommaPos = human.indexOf(',') !== -1 ? human.indexOf(',') : human.indexOf('.')
  
  if (aiCommaPos !== humanCommaPos && aiCommaPos !== -1 && humanCommaPos !== -1) {
    return 'decimal_position'
  }
  
  // Chiffre manquant ou en trop
  const aiDigits = ai.replace(/[^0-9]/g, '')
  const humanDigits = human.replace(/[^0-9]/g, '')
  
  if (aiDigits.length !== humanDigits.length) {
    return aiDigits.length > humanDigits.length ? 'extra_digit' : 'missing_digit'
  }
  
  // Chiffres différents
  if (aiDigits !== humanDigits) {
    // Compter combien de chiffres différents
    let diffs = 0
    for (let i = 0; i < Math.max(aiDigits.length, humanDigits.length); i++) {
      if (aiDigits[i] !== humanDigits[i]) diffs++
    }
    
    if (diffs === 1) return 'wrong_digit'
    if (diffs > 3) return 'hallucination'
    return 'multiple_wrong_digits'
  }
  
  return 'format_error'
}

async function updateModelRules(supabase: any, modelId: string, errorType: string) {
  // Récupérer les corrections récentes pour ce modèle
  const { data: corrections } = await supabase
    .from('meter_corrections')
    .select('error_type')
    .eq('model_id', modelId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!corrections || corrections.length < 3) return

  // Compter les types d'erreurs
  const errorCounts: Record<string, number> = {}
  corrections.forEach((c: any) => {
    if (c.error_type) {
      errorCounts[c.error_type] = (errorCounts[c.error_type] || 0) + 1
    }
  })

  // Si un type d'erreur revient souvent, l'ajouter aux common_errors
  const frequentErrors = Object.entries(errorCounts)
    .filter(([_, count]) => count >= 2)
    .map(([type]) => type)

  if (frequentErrors.length === 0) return

  // Mettre à jour les règles
  const { data: existingRules } = await supabase
    .from('meter_reading_rules')
    .select('common_errors')
    .eq('model_id', modelId)
    .single()

  const currentErrors = existingRules?.common_errors || []
  const newErrors = [...new Set([...currentErrors, ...frequentErrors])]

  await supabase
    .from('meter_reading_rules')
    .upsert({
      model_id: modelId,
      common_errors: newErrors,
      updated_at: new Date().toISOString()
    })
}
