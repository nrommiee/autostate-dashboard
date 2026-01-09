import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Statistiques globales ou par batch/config
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batch_id')
    const configId = searchParams.get('config_id')
    const period = searchParams.get('period') || '7d'  // 24h, 7d, 30d, all

    // Calculer la date de début selon la période
    const now = new Date()
    let startDate: Date | null = null
    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = null
    }

    // Stats de base
    let runsQuery = supabase
      .from('experiment_runs')
      .select('*')

    if (batchId) {
      runsQuery = runsQuery.eq('batch_id', batchId)
    }
    if (configId) {
      runsQuery = runsQuery.eq('config_id', configId)
    }
    if (startDate) {
      runsQuery = runsQuery.gte('created_at', startDate.toISOString())
    }

    const { data: runs, error } = await runsQuery

    if (error) throw error

    // Calculer les statistiques
    const totalRuns = runs?.length || 0
    const completedRuns = runs?.filter(r => r.status === 'completed').length || 0
    const evaluatedRuns = runs?.filter(r => r.is_correct !== null).length || 0
    const correctRuns = runs?.filter(r => r.is_correct === true).length || 0
    const matchedRuns = runs?.filter(r => r.actual_result?.matched_model_id).length || 0

    const avgConfidence = runs && runs.length > 0
      ? runs.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / runs.length
      : 0

    const avgProcessingTime = runs && runs.length > 0
      ? runs.reduce((sum, r) => sum + (r.processing_time_ms || 0), 0) / runs.length
      : 0

    const totalCost = runs?.reduce((sum, r) => sum + (r.api_cost_usd || 0), 0) || 0

    // Stats par type d'erreur
    const errorsByType: Record<string, number> = {}
    runs?.filter(r => r.error_type).forEach(r => {
      errorsByType[r.error_type] = (errorsByType[r.error_type] || 0) + 1
    })

    // Stats par niveau de confiance
    const confidenceDistribution = {
      high: runs?.filter(r => (r.confidence_score || 0) >= 0.9).length || 0,
      medium: runs?.filter(r => (r.confidence_score || 0) >= 0.7 && (r.confidence_score || 0) < 0.9).length || 0,
      low: runs?.filter(r => (r.confidence_score || 0) >= 0.5 && (r.confidence_score || 0) < 0.7).length || 0,
      very_low: runs?.filter(r => (r.confidence_score || 0) < 0.5).length || 0
    }

    // Evolution dans le temps (si période > 24h)
    const timeline: { date: string; runs: number; accuracy: number }[] = []
    if (runs && runs.length > 0 && period !== '24h') {
      const dayMap = new Map<string, { total: number; correct: number }>()
      
      runs.forEach(run => {
        const date = new Date(run.created_at).toISOString().split('T')[0]
        const current = dayMap.get(date) || { total: 0, correct: 0 }
        current.total++
        if (run.is_correct) current.correct++
        dayMap.set(date, current)
      })

      dayMap.forEach((stats, date) => {
        timeline.push({
          date,
          runs: stats.total,
          accuracy: stats.total > 0 ? stats.correct / stats.total : 0
        })
      })

      timeline.sort((a, b) => a.date.localeCompare(b.date))
    }

    // Top erreurs (patterns les plus fréquents)
    const { data: corrections } = await supabase
      .from('experiment_corrections')
      .select('error_category, error_details')
      .not('error_category', 'is', null)
      .limit(100)

    const errorPatterns: Record<string, { count: number; examples: string[] }> = {}
    corrections?.forEach(c => {
      if (!errorPatterns[c.error_category]) {
        errorPatterns[c.error_category] = { count: 0, examples: [] }
      }
      errorPatterns[c.error_category].count++
      if (c.error_details && errorPatterns[c.error_category].examples.length < 3) {
        errorPatterns[c.error_category].examples.push(c.error_details)
      }
    })

    // Comparer avec la baseline si config spécifique
    let baselineComparison = null
    if (configId) {
      const { data: baseline } = await supabase
        .from('experiment_configs')
        .select('id')
        .eq('is_baseline', true)
        .single()

      if (baseline && baseline.id !== configId) {
        const { data: baselineRuns } = await supabase
          .from('experiment_runs')
          .select('confidence_score, is_correct')
          .eq('config_id', baseline.id)
          .not('is_correct', 'is', null)

        if (baselineRuns && baselineRuns.length > 0) {
          const baselineAccuracy = baselineRuns.filter(r => r.is_correct).length / baselineRuns.length
          const baselineConfidence = baselineRuns.reduce((s, r) => s + (r.confidence_score || 0), 0) / baselineRuns.length

          const currentAccuracy = evaluatedRuns > 0 ? correctRuns / evaluatedRuns : 0
          
          baselineComparison = {
            baseline_accuracy: baselineAccuracy,
            current_accuracy: currentAccuracy,
            accuracy_diff: currentAccuracy - baselineAccuracy,
            baseline_confidence: baselineConfidence,
            current_confidence: avgConfidence,
            confidence_diff: avgConfidence - baselineConfidence,
            improved: currentAccuracy > baselineAccuracy
          }
        }
      }
    }

    return NextResponse.json({
      period,
      stats: {
        total_runs: totalRuns,
        completed_runs: completedRuns,
        evaluated_runs: evaluatedRuns,
        correct_runs: correctRuns,
        matched_runs: matchedRuns,
        accuracy_rate: evaluatedRuns > 0 ? correctRuns / evaluatedRuns : null,
        match_rate: totalRuns > 0 ? matchedRuns / totalRuns : null,
        avg_confidence: avgConfidence,
        avg_processing_time_ms: Math.round(avgProcessingTime),
        total_cost_usd: totalCost
      },
      confidence_distribution: confidenceDistribution,
      errors_by_type: errorsByType,
      error_patterns: errorPatterns,
      timeline,
      baseline_comparison: baselineComparison
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

// POST - Comparer deux configs (A/B testing)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { config_a_id, config_b_id, name, description } = body

    if (!config_a_id || !config_b_id) {
      return NextResponse.json(
        { error: 'config_a_id and config_b_id are required' },
        { status: 400 }
      )
    }

    // Récupérer les stats des deux configs
    const getConfigStats = async (configId: string) => {
      const { data: runs } = await supabase
        .from('experiment_runs')
        .select('confidence_score, is_correct, processing_time_ms, api_cost_usd')
        .eq('config_id', configId)
        .eq('status', 'evaluated')

      if (!runs || runs.length === 0) {
        return null
      }

      return {
        total: runs.length,
        correct: runs.filter(r => r.is_correct).length,
        accuracy: runs.filter(r => r.is_correct).length / runs.length,
        avg_confidence: runs.reduce((s, r) => s + (r.confidence_score || 0), 0) / runs.length,
        avg_time: runs.reduce((s, r) => s + (r.processing_time_ms || 0), 0) / runs.length,
        total_cost: runs.reduce((s, r) => s + (r.api_cost_usd || 0), 0)
      }
    }

    const statsA = await getConfigStats(config_a_id)
    const statsB = await getConfigStats(config_b_id)

    if (!statsA || !statsB) {
      return NextResponse.json(
        { error: 'Both configs need evaluated runs for comparison' },
        { status: 400 }
      )
    }

    // Déterminer le gagnant
    let winner: 'A' | 'B' | 'TIE' = 'TIE'
    const accuracyDiff = statsB.accuracy - statsA.accuracy
    if (Math.abs(accuracyDiff) > 0.02) {  // Différence significative > 2%
      winner = accuracyDiff > 0 ? 'B' : 'A'
    }

    // Créer la comparaison
    const { data: comparison, error } = await supabase
      .from('experiment_comparisons')
      .insert({
        name: name || `Comparison ${new Date().toISOString()}`,
        description,
        config_a_id,
        config_b_id,
        winner,
        metrics: {
          accuracy_a: statsA.accuracy,
          accuracy_b: statsB.accuracy,
          accuracy_diff: accuracyDiff,
          confidence_a: statsA.avg_confidence,
          confidence_b: statsB.avg_confidence,
          confidence_diff: statsB.avg_confidence - statsA.avg_confidence,
          speed_a_ms: statsA.avg_time,
          speed_b_ms: statsB.avg_time,
          cost_a_usd: statsA.total_cost,
          cost_b_usd: statsB.total_cost,
          samples_a: statsA.total,
          samples_b: statsB.total
        },
        conclusion: winner === 'TIE' 
          ? 'Les deux configurations ont des performances similaires'
          : `La configuration ${winner} est meilleure avec ${Math.abs(accuracyDiff * 100).toFixed(1)}% de différence`,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ comparison })
  } catch (error) {
    console.error('Error creating comparison:', error)
    return NextResponse.json({ error: 'Failed to create comparison' }, { status: 500 })
  }
}
