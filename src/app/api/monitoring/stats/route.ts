import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Récupérer les stats de monitoring
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '24h' // 1h, 24h, 7d, 30d
    
    // Calculer la date de début selon la période
    const now = new Date()
    let startDate: Date
    
    switch (period) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default: // 24h
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }
    
    // Récupérer les stats des logs
    const { data: logs } = await supabase
      .from('app_logs')
      .select('level, source, duration_ms, status_code, created_at')
      .gte('timestamp', startDate.toISOString())
    
    const logsArray = logs || []
    
    // Calculer les métriques
    const stats = {
      period,
      total_events: logsArray.length,
      by_level: {
        ERROR: logsArray.filter(l => l.level === 'ERROR').length,
        WARN: logsArray.filter(l => l.level === 'WARN').length,
        INFO: logsArray.filter(l => l.level === 'INFO').length,
        DEBUG: logsArray.filter(l => l.level === 'DEBUG').length
      },
      by_source: logsArray.reduce((acc, l) => {
        acc[l.source] = (acc[l.source] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      api_stats: {
        total_requests: logsArray.filter(l => l.duration_ms !== null).length,
        avg_duration_ms: Math.round(
          logsArray.filter(l => l.duration_ms).reduce((sum, l) => sum + (l.duration_ms || 0), 0) / 
          Math.max(logsArray.filter(l => l.duration_ms).length, 1)
        ),
        error_rate: logsArray.length > 0 
          ? Math.round((logsArray.filter(l => l.level === 'ERROR').length / logsArray.length) * 100)
          : 0
      }
    }
    
    // Récupérer les erreurs non résolues
    const { data: unresolvedErrors, count: unresolvedCount } = await supabase
      .from('app_logs')
      .select('*', { count: 'exact' })
      .eq('level', 'ERROR')
      .is('resolved_at', null)
      .order('timestamp', { ascending: false })
      .limit(10)
    
    // Récupérer les queries lentes (> 500ms)
    const { data: slowQueries } = await supabase
      .from('app_logs')
      .select('*')
      .gt('duration_ms', 500)
      .gte('timestamp', startDate.toISOString())
      .order('duration_ms', { ascending: false })
      .limit(10)
    
    // Stats business (depuis d'autres tables)
    const [
      { count: missionsToday },
      { count: usersActive },
      { count: metersScanned }
    ] = await Promise.all([
      supabase.from('missions').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(now.setHours(0,0,0,0)).toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .gte('last_sign_in', startDate.toISOString()),
      supabase.from('lab_experiments').select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
    ])
    
    // Vérifier la santé Supabase
    const supabaseHealth = {
      database: 'healthy',
      storage: 'healthy',
      auth: 'healthy'
    }
    
    // Test rapide de connexion
    try {
      await supabase.from('profiles').select('id').limit(1)
    } catch {
      supabaseHealth.database = 'error'
    }
    
    return NextResponse.json({
      stats,
      unresolved_errors: {
        count: unresolvedCount || 0,
        recent: unresolvedErrors || []
      },
      slow_queries: slowQueries || [],
      business: {
        missions_today: missionsToday || 0,
        active_users: usersActive || 0,
        meters_scanned: metersScanned || 0
      },
      supabase_health: supabaseHealth,
      generated_at: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Get monitoring stats error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
