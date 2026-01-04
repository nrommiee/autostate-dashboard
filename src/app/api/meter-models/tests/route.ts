import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      model_id,
      photo_url,
      success,
      validation_type,
      confidence,
      extracted_serial,
      extracted_reading,
      ai_response
    } = body

    if (!model_id) {
      return NextResponse.json(
        { error: 'model_id requis' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Insert test record
    const { data, error } = await supabase
      .from('meter_model_tests')
      .insert({
        model_id,
        photo_url,
        success,
        validation_type,
        confidence,
        extracted_serial,
        extracted_reading,
        ai_response
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving test:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la sauvegarde du test' },
        { status: 500 }
      )
    }

    // Update model test_success_rate
    const { data: tests } = await supabase
      .from('meter_model_tests')
      .select('success')
      .eq('model_id', model_id)

    if (tests && tests.length > 0) {
      const successCount = tests.filter(t => t.success).length
      const successRate = successCount / tests.length

      await supabase
        .from('meter_models')
        .update({ test_success_rate: successRate })
        .eq('id', model_id)
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Test save error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('model_id')

    if (!modelId) {
      return NextResponse.json(
        { error: 'model_id requis' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('meter_model_tests')
      .select('*')
      .eq('model_id', modelId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tests:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Tests fetch error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
