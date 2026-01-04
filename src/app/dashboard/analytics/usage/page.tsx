'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { BarChart3, TrendingUp, Zap, Image, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface FunctionStats {
  function_id: string
  function_name: string
  function_description: string
  request_count: number
  total_input_tokens: number
  total_output_tokens: number
  total_images: number
  total_tokens: number
  total_cost_usd: number
  avg_response_time_ms: number
  success_count: number
  error_count: number
}

interface DailyStats {
  date: string
  function_id: string
  function_name: string
  request_count: number
  total_tokens: number
  total_cost_usd: number
}

const FUNCTION_ICONS: Record<string, string> = {
  scan_meter: '📷',
  analyze_model: '🔍',
  test_model: '🧪',
  match_model: '🎯'
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function UsagePage() {
  const [loading, setLoading] = useState(true)
  const [functionStats, setFunctionStats] = useState<FunctionStats[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    loadStats()
  }, [selectedMonth])

  async function loadStats() {
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1).toISOString()
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

      // Stats par fonction
      const { data: funcData } = await supabase
        .from('api_usage_logs')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (funcData) {
        // Agréger par fonction
        const grouped: Record<string, FunctionStats> = {}
        funcData.forEach(log => {
          if (!grouped[log.function_id]) {
            grouped[log.function_id] = {
              function_id: log.function_id,
              function_name: log.function_name,
              function_description: log.function_description,
              request_count: 0,
              total_input_tokens: 0,
              total_output_tokens: 0,
              total_images: 0,
              total_tokens: 0,
              total_cost_usd: 0,
              avg_response_time_ms: 0,
              success_count: 0,
              error_count: 0
            }
          }
          const g = grouped[log.function_id]
          g.request_count++
          g.total_input_tokens += log.input_tokens || 0
          g.total_output_tokens += log.output_tokens || 0
          g.total_images += log.image_count || 0
          g.total_tokens += log.total_tokens || 0
          g.total_cost_usd += parseFloat(log.cost_usd) || 0
          g.avg_response_time_ms += log.response_time_ms || 0
          if (log.success) g.success_count++
          else g.error_count++
        })

        // Calculer moyenne
        Object.values(grouped).forEach(g => {
          g.avg_response_time_ms = g.request_count > 0 ? g.avg_response_time_ms / g.request_count : 0
        })

        setFunctionStats(Object.values(grouped).sort((a, b) => b.total_tokens - a.total_tokens))

        // Stats par jour
        const daily: Record<string, DailyStats> = {}
        funcData.forEach(log => {
          const date = log.created_at.split('T')[0]
          const key = `${date}-${log.function_id}`
          if (!daily[key]) {
            daily[key] = {
              date,
              function_id: log.function_id,
              function_name: log.function_name,
              request_count: 0,
              total_tokens: 0,
              total_cost_usd: 0
            }
          }
          daily[key].request_count++
          daily[key].total_tokens += log.total_tokens || 0
          daily[key].total_cost_usd += parseFloat(log.cost_usd) || 0
        })
        setDailyStats(Object.values(daily).sort((a, b) => b.date.localeCompare(a.date)))
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // Totaux
  const totals = functionStats.reduce((acc, f) => ({
    requests: acc.requests + f.request_count,
    inputTokens: acc.inputTokens + f.total_input_tokens,
    outputTokens: acc.outputTokens + f.total_output_tokens,
    images: acc.images + f.total_images,
    tokens: acc.tokens + f.total_tokens,
    cost: acc.cost + f.total_cost_usd
  }), { requests: 0, inputTokens: 0, outputTokens: 0, images: 0, tokens: 0, cost: 0 })

  // Navigation mois
  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const newDate = new Date(year, month - 1 + delta, 1)
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthName = new Date(selectedMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  // Graphique simple par jour
  const daysInMonth = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate()
  const dailyTotals: Record<string, number> = {}
  dailyStats.forEach(d => {
    dailyTotals[d.date] = (dailyTotals[d.date] || 0) + d.total_tokens
  })
  const maxDailyTokens = Math.max(...Object.values(dailyTotals), 1)

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Usage</h1>
          <p className="text-gray-500 text-sm">Consommation de tokens par fonction</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium capitalize min-w-32 text-center">{monthName}</span>
          <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Zap className="h-4 w-4" /> Requêtes
          </div>
          <div className="text-2xl font-bold">{totals.requests.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <TrendingUp className="h-4 w-4" /> Tokens entrée
          </div>
          <div className="text-2xl font-bold">{totals.inputTokens.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <BarChart3 className="h-4 w-4" /> Tokens sortie
          </div>
          <div className="text-2xl font-bold">{totals.outputTokens.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Image className="h-4 w-4" /> Images
          </div>
          <div className="text-2xl font-bold">{totals.images.toLocaleString()}</div>
        </Card>
        <Card className="p-4 bg-teal-50">
          <div className="flex items-center gap-2 text-teal-700 text-sm mb-1">
            Total tokens
          </div>
          <div className="text-2xl font-bold text-teal-700">{totals.tokens.toLocaleString()}</div>
        </Card>
      </div>

      {/* Par fonction */}
      <Card className="p-4">
        <h2 className="font-semibold mb-4">Par fonction</h2>
        
        {loading ? (
          <div className="text-center py-8 text-gray-500">Chargement...</div>
        ) : functionStats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Aucune donnée pour cette période</div>
        ) : (
          <div className="space-y-3">
            {functionStats.map((func) => {
              const percentage = totals.tokens > 0 ? (func.total_tokens / totals.tokens) * 100 : 0
              return (
                <div key={func.function_id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{FUNCTION_ICONS[func.function_id] || '📊'}</span>
                        <span className="font-medium">{func.function_name}</span>
                      </div>
                      <p className="text-gray-500 text-sm">{func.function_description}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{func.total_tokens.toLocaleString()}</div>
                      <div className="text-gray-500 text-xs">tokens</div>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-teal-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{func.request_count} requêtes</span>
                    <span>{func.total_input_tokens.toLocaleString()} in</span>
                    <span>{func.total_output_tokens.toLocaleString()} out</span>
                    <span>{func.total_images} images</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {Math.round(func.avg_response_time_ms)}ms
                    </span>
                    <span className="ml-auto font-medium text-teal-600">{percentage.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Graphique par jour */}
      <Card className="p-4">
        <h2 className="font-semibold mb-4">Tokens par jour</h2>
        <div className="h-40 flex items-end gap-1">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = String(i + 1).padStart(2, '0')
            const date = `${selectedMonth}-${day}`
            const tokens = dailyTotals[date] || 0
            const height = maxDailyTokens > 0 ? (tokens / maxDailyTokens) * 100 : 0
            return (
              <div 
                key={day} 
                className="flex-1 bg-teal-500 rounded-t hover:bg-teal-600 transition-colors cursor-pointer group relative"
                style={{ height: `${Math.max(height, 2)}%` }}
                title={`${day}: ${tokens.toLocaleString()} tokens`}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                  {day}: {tokens.toLocaleString()}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>1</span>
          <span>{Math.ceil(daysInMonth / 2)}</span>
          <span>{daysInMonth}</span>
        </div>
      </Card>

      {/* Link to Cost */}
      <div className="text-center">
        <Link href="/dashboard/analytics/cost">
          <Button variant="outline">Voir les coûts →</Button>
        </Link>
      </div>
    </div>
  )
}
