import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - List all meter models with test counts from labs_experiments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const active = searchParams.get('active')

    let query = supabase
      .from('meter_models')
      .select('*')
      .order('usage_count', { ascending: false })

    if (type) {
      query = query.eq('meter_type', type)
    }

    if (active === 'true') {
      query = query.eq('is_active', true)
    }

    const { data: models, error } = await query

    if (error) throw error

    // Get test stats from labs_experiments for each model
    if (models && models.length > 0) {
      const modelIds = models.map(m => m.id)
      
      // FIXED: Use labs_experiments (plural) and get status for stats
      const { data: experiments } = await supabase
        .from('labs_experiments')
        .select('meter_model_id, status')
        .in('meter_model_id', modelIds)
      
      // Calculate stats per model
      const statsMap: Record<string, { total: number; success: number; failed: number }> = {}
      
      if (experiments) {
        experiments.forEach(exp => {
          if (!statsMap[exp.meter_model_id]) {
            statsMap[exp.meter_model_id] = { total: 0, success: 0, failed: 0 }
          }
          statsMap[exp.meter_model_id].total++
          
          if (exp.status === 'validated' || exp.status === 'corrected') {
            statsMap[exp.meter_model_id].success++
          } else if (exp.status === 'rejected') {
            statsMap[exp.meter_model_id].failed++
          }
        })
      }
      
      // Add stats to each model
      const modelsWithStats = models.map(m => ({
        ...m,
        total_scans: statsMap[m.id]?.total || 0,
        success_count: statsMap[m.id]?.success || 0,
        fail_count: statsMap[m.id]?.failed || 0,
        test_count: statsMap[m.id]?.total || 0
      }))
      
      return NextResponse.json(modelsWithStats)
    }

    return NextResponse.json(models || [])
  } catch (error) {
    console.error('Get meter models error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération' },
      { status: 500 }
    )
  }
}

// POST - Create new meter model
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      manufacturer,
      meter_type,
      unit,
      ai_description,
      ai_analysis_data,
      reference_photos,
      zones,
      is_verified,
      is_active,
      from_unrecognized_id
    } = body

    // Validate required fields
    if (!name || !meter_type) {
      return NextResponse.json(
        { error: 'Nom et type sont requis' },
        { status: 400 }
      )
    }

    // Insert meter model (always as draft - activation happens in Labs)
    const { data, error } = await supabase
      .from('meter_models')
      .insert({
        name,
        manufacturer: manufacturer || '',
        meter_type,
        unit: unit || 'm³',
        ai_description: ai_description || '',
        ai_analysis_data: ai_analysis_data || {},
        reference_photos: reference_photos || [],
        zones: zones || [],
        is_verified: is_verified || false,
        is_active: is_active !== false,
        status: 'draft'
      })
      .select()
      .single()

    if (error) throw error

    // If created from unrecognized meter, update its status
    if (from_unrecognized_id) {
      await supabase
        .from('unrecognized_meters')
        .update({
          status: 'processed',
          linked_model_id: data.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', from_unrecognized_id)
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Create meter model error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création' },
      { status: 500 }
    )
  }
}
