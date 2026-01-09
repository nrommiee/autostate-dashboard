import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Récupérer les logs avec filtres
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const level = searchParams.get('level') // ERROR, WARN, INFO, DEBUG
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const from = searchParams.get('from') // ISO date
    const to = searchParams.get('to') // ISO date
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const unresolved = searchParams.get('unresolved') === 'true'
    
    let query = supabase
      .from('app_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (level) {
      query = query.eq('level', level)
    }
    
    if (source) {
      query = query.eq('source', source)
    }
    
    if (search) {
      query = query.or(`message.ilike.%${search}%,error_message.ilike.%${search}%`)
    }
    
    if (from) {
      query = query.gte('timestamp', from)
    }
    
    if (to) {
      query = query.lte('timestamp', to)
    }
    
    if (unresolved) {
      query = query.is('resolved_at', null).eq('level', 'ERROR')
    }
    
    const { data, error, count } = await query
    
    if (error) throw error
    
    return NextResponse.json({ 
      logs: data || [],
      total: count || 0,
      limit,
      offset
    })
    
  } catch (error: any) {
    console.error('Get logs error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Créer un nouveau log (pour le client-side logging)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { data, error } = await supabase
      .from('app_logs')
      .insert({
        timestamp: new Date().toISOString(),
        level: body.level || 'INFO',
        source: body.source || 'client',
        message: body.message,
        user_id: body.user_id,
        user_email: body.user_email,
        session_id: body.session_id,
        request_id: body.request_id,
        method: body.method,
        path: body.path,
        duration_ms: body.duration_ms,
        status_code: body.status_code,
        data: body.data,
        error_name: body.error_name,
        error_message: body.error_message,
        error_stack: body.error_stack,
        suggested_fix: body.suggested_fix
      })
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ success: true, log: data })
    
  } catch (error: any) {
    console.error('Create log error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Marquer un log comme résolu
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { log_id, resolved_by, resolution_notes } = body
    
    if (!log_id) {
      return NextResponse.json({ error: 'log_id requis' }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from('app_logs')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by,
        resolution_notes
      })
      .eq('id', log_id)
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ success: true, log: data })
    
  } catch (error: any) {
    console.error('Update log error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Supprimer les vieux logs (cleanup)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('older_than_days') || '30')
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    const { error, count } = await supabase
      .from('app_logs')
      .delete()
      .lt('timestamp', cutoffDate.toISOString())
      .neq('level', 'ERROR') // Keep errors longer
    
    if (error) throw error
    
    return NextResponse.json({ 
      success: true, 
      deleted: count,
      message: `Supprimé les logs de plus de ${days} jours`
    })
    
  } catch (error: any) {
    console.error('Delete logs error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
