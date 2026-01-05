'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, TrendingUp, Zap, Image, ChevronLeft, ChevronRight, Search, FlaskConical, Camera, Target } from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

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

interface ChartDataPoint {
  date: string
  tokens: number
}

const FUNCTION_ICONS: Record<string, React.ReactNode> = {
  scan_meter: <Camera className="h-5 w-5 text-blue-600" />,
  analyze_model: <Search className="h-5 w-5 text-purple-600" />,
  test_model: <FlaskConical className="h-5 w-5 text-green-600" />,
  match_model: <Target className="h-5 w-5 text-orange-600" />
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
        setDailyStats(Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)))
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

  // Préparer données pour le graphique AreaChart
  const [year, month] = selectedMonth.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  
  const dailyTotals: Record<string, number> = {}
  dailyStats.forEach(d => {
    dailyTotals[d.date] = (dailyTotals[d.date] || 0) + d.total_tokens
  })

  const chartData: ChartDataPoint[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0')
    const date = `${selectedMonth}-${day}`
    return {
      date: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      tokens: dailyTotals[date] || 0
    }
  })

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
          <div className="text-2xl font-bold">{totals.requests.toLocaleString('fr-FR')}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <TrendingUp className="h-4 w-4" /> Tokens entrée
          </div>
          <div className="text-2xl font-bold">{totals.inputTokens.toLocaleString('fr-FR')}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <BarChart3 className="h-4 w-4" /> Tokens sortie
          </div>
          <div className="text-2xl font-bold">{totals.outputTokens.toLocaleString('fr-FR')}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Image className="h-4 w-4" /> Images
          </div>
          <div className="text-2xl font-bold">{totals.images.toLocaleString('fr-FR')}</div>
        </Card>
        <Card className="p-4 bg-teal-50">
          <div className="flex items-center gap-2 text-teal-700 text-sm mb-1">
            Total tokens
          </div>
          <div className="text-2xl font-bold text-teal-700">{totals.tokens.toLocaleString('fr-FR')}</div>
        </Card>
      </div>

      {/* Tableau par fonction */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="font-semibold">Par fonction</h2>
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            Chargement...
          </div>
        ) : functionStats.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Aucune donnée pour cette période</div>
        ) : (
          <div className="overflow-x-auto">
            {/* Table Header */}
            <div className="grid grid-cols-[auto_1fr_100px_120px_120px_80px_120px] gap-4 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-500 border-b">
              <div className="w-10"></div>
              <div>Fonction</div>
              <div className="text-right">Requêtes</div>
              <div className="text-right">Tokens in</div>
              <div className="text-right">Tokens out</div>
              <div className="text-right">Images</div>
              <div className="text-right">Total</div>
            </div>

            {/* Table Body */}
            <div className="divide-y">
              {functionStats.map((func) => (
                <div 
                  key={func.function_id}
                  className="grid grid-cols-[auto_1fr_100px_120px_120px_80px_120px] gap-4 px-4 py-4 items-center hover:bg-gray-50 transition-colors"
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    {FUNCTION_ICONS[func.function_id] || <BarChart3 className="h-5 w-5 text-gray-600" />}
                  </div>

                  {/* Name & Description */}
                  <div>
                    <div className="font-medium text-gray-900">{func.function_name}</div>
                    <div className="text-sm text-gray-500">{func.function_description}</div>
                  </div>

                  {/* Requêtes */}
                  <div className="text-right font-medium">
                    {func.request_count.toLocaleString('fr-FR')}
                  </div>

                  {/* Tokens in */}
                  <div className="text-right text-gray-600">
                    {func.total_input_tokens.toLocaleString('fr-FR')}
                  </div>

                  {/* Tokens out */}
                  <div className="text-right text-gray-600">
                    {func.total_output_tokens.toLocaleString('fr-FR')}
                  </div>

                  {/* Images */}
                  <div className="text-right text-gray-600">
                    {func.total_images.toLocaleString('fr-FR')}
                  </div>

                  {/* Total */}
                  <div className="text-right font-bold text-teal-600">
                    {func.total_tokens.toLocaleString('fr-FR')}
                  </div>
                </div>
              ))}
            </div>

            {/* Table Footer - Totaux */}
            <div className="grid grid-cols-[auto_1fr_100px_120px_120px_80px_120px] gap-4 px-4 py-3 bg-gray-50 border-t text-sm font-semibold">
              <div className="w-10"></div>
              <div className="text-gray-700">Total</div>
              <div className="text-right">{totals.requests.toLocaleString('fr-FR')}</div>
              <div className="text-right">{totals.inputTokens.toLocaleString('fr-FR')}</div>
              <div className="text-right">{totals.outputTokens.toLocaleString('fr-FR')}</div>
              <div className="text-right">{totals.images.toLocaleString('fr-FR')}</div>
              <div className="text-right text-teal-600">{totals.tokens.toLocaleString('fr-FR')}</div>
            </div>
          </div>
        )}
      </Card>

      {/* Graphique AreaChart */}
      <Card className="p-4">
        <h2 className="font-semibold mb-4">Tokens par jour</h2>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tokensGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: '#9ca3af' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: '#9ca3af' }}
                allowDecimals={false}
                tickFormatter={(value) => value.toLocaleString('fr-FR')}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                labelStyle={{ color: '#111827', fontWeight: 600 }}
                formatter={(value) => [Number(value).toLocaleString('fr-FR'), 'Tokens']}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#0d9488"
                strokeWidth={2}
                fill="url(#tokensGradient)"
                name="Tokens"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
