import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Liste des modèles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const active = searchParams.get('active')

    let query = supabase
      .from('meter_models')
      .select('*')
      .order('created_at', { ascending: false })

    if (type) {
      query = query.eq('meter_type', type)
    }

    if (active !== null) {
      query = query.eq('is_active', active === 'true')
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])

  } catch (error) {
    console.error('Get meter models error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération' },
      { status: 500 }
    )
  }
}

// POST - Créer un modèle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      name,
      manufacturer,
      meter_type,
      unit,
      ai_description,
      zones,
      reference_photos,
      is_active = true,
      from_unrecognized_id,
    } = body

    if (!name || !meter_type) {
      return NextResponse.json(
        { error: 'Nom et type requis' },
        { status: 400 }
      )
    }

    // Create the model
    const { data, error } = await supabase
      .from('meter_models')
      .insert({
        name,
        manufacturer: manufacturer || null,
        meter_type,
        unit: unit || null,
        ai_description: ai_description || null,
        zones: zones || [],
        reference_photos: reference_photos || [],
        is_active,
        usage_count: 0,
        success_count: 0,
        fail_count: 0,
        avg_confidence: null,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // If created from unrecognized meter, update its status
    if (from_unrecognized_id) {
      await supabase
        .from('unrecognized_meters')
        .update({ 
          status: 'processed',
          linked_model_id: data.id,
        })
        .eq('id', from_unrecognized_id)
    }

    return NextResponse.json(data, { status: 201 })

  } catch (error) {
    console.error('Create meter model error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création' },
      { status: 500 }
    )
  }
}
