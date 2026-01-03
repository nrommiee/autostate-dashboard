import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // jours
    const groupBy = searchParams.get('groupBy') || 'day' // 'day', 'function', 'service'

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(period))

    // Stats globales par service
    const { data: summaryData, error: summaryError } = await supabase
      .from('api_usage_logs')
      .select('service, function_name, input_tokens, output_tokens, audio_seconds, estimated_cost, created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (summaryError) {
      throw summaryError
    }

    // Calculer les stats
    const logs = summaryData || []
    
    // Stats par service
    const byService: Record<string, {
      calls: number
      inputTokens: number
      outputTokens: number
      audioSeconds: number
      cost: number
    }> = {}

    // Stats par fonction
    const byFunction: Record<string, {
      service: string
      calls: number
      inputTokens: number
      outputTokens: number
      audioSeconds: number
      cost: number
    }> = {}

    // Stats par jour
    const byDay: Record<string, {
      date: string
      calls: number
      cost: number
    }> = {}

    // Stats aujourd'hui
    const today = new Date().toISOString().split('T')[0]
    let todayCalls = 0
    let todayCost = 0

    // Stats ce mois
    const thisMonth = new Date().toISOString().slice(0, 7)
    let monthCalls = 0
    let monthCost = 0

    logs.forEach(log => {
      const service = log.service
      const func = log.function_name
      const day = log.created_at.split('T')[0]
      const month = log.created_at.slice(0, 7)
      const cost = parseFloat(log.estimated_cost) || 0

      // Par service
      if (!byService[service]) {
        byService[service] = { calls: 0, inputTokens: 0, outputTokens: 0, audioSeconds: 0, cost: 0 }
      }
      byService[service].calls++
      byService[service].inputTokens += log.input_tokens || 0
      byService[service].outputTokens += log.output_tokens || 0
      byService[service].audioSeconds += log.audio_seconds || 0
      byService[service].cost += cost

      // Par fonction
      const funcKey = `${service}:${func}`
      if (!byFunction[funcKey]) {
        byFunction[funcKey] = { service, calls: 0, inputTokens: 0, outputTokens: 0, audioSeconds: 0, cost: 0 }
      }
      byFunction[funcKey].calls++
      byFunction[funcKey].inputTokens += log.input_tokens || 0
      byFunction[funcKey].outputTokens += log.output_tokens || 0
      byFunction[funcKey].audioSeconds += log.audio_seconds || 0
      byFunction[funcKey].cost += cost

      // Par jour
      if (!byDay[day]) {
        byDay[day] = { date: day, calls: 0, cost: 0 }
      }
      byDay[day].calls++
      byDay[day].cost += cost

      // Aujourd'hui
      if (day === today) {
        todayCalls++
        todayCost += cost
      }

      // Ce mois
      if (month === thisMonth) {
        monthCalls++
        monthCost += cost
      }
    })

    // Transformer en arrays
    const servicesArray = Object.entries(byService).map(([name, stats]) => ({
      name,
      ...stats,
    })).sort((a, b) => b.cost - a.cost)

    const functionsArray = Object.entries(byFunction).map(([key, stats]) => ({
      name: key.split(':')[1],
      ...stats,
    })).sort((a, b) => b.cost - a.cost)

    const daysArray = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))

    // Total
    const totalCost = servicesArray.reduce((sum, s) => sum + s.cost, 0)
    const totalCalls = servicesArray.reduce((sum, s) => sum + s.calls, 0)

    return NextResponse.json({
      period: parseInt(period),
      summary: {
        totalCalls,
        totalCost,
        todayCalls,
        todayCost,
        monthCalls,
        monthCost,
      },
      byService: servicesArray,
      byFunction: functionsArray,
      byDay: daysArray,
    })

  } catch (error) {
    console.error('Get API usage error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des stats' },
      { status: 500 }
    )
  }
}
