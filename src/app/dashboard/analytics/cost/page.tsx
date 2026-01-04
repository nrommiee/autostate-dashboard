'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { DollarSign, TrendingUp, Calculator, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface FunctionCost {
  function_id: string
  function_name: string
  function_description: string
  request_count: number
  total_cost_usd: number
  avg_cost_per_request: number
}

interface DailyCost {
  date: string
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
export default function CostPage() {
  const [loading, setLoading] = useState(true)
  const [functionCosts, setFunctionCosts] = useState<FunctionCost[]>([])
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    loadCosts()
  }, [selectedMonth])

  async function loadCosts() {
    setLoading(true)
    try {
      const [year, month] = selectedMonth.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1).toISOString()
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

      const { data } = await supabase
        .from('api_usage_logs')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (data) {
        // Coûts par fonction
        const grouped: Record<string, FunctionCost> = {}
        data.forEach(log => {
          if (!grouped[log.function_id]) {
            grouped[log.function_id] = {
              function_id: log.function_id,
              function_name: log.function_name,
              function_description: log.function_description,
              request_count: 0,
              total_cost_usd: 0,
              avg_cost_per_request: 0
            }
          }
          grouped[log.function_id].request_count++
          grouped[log.function_id].total_cost_usd += parseFloat(log.cost_usd) || 0
        })

        Object.values(grouped).forEach(g => {
          g.avg_cost_per_request = g.request_count > 0 ? g.total_cost_usd / g.request_count : 0
        })

        setFunctionCosts(Object.values(grouped).sort((a, b) => b.total_cost_usd - a.total_cost_usd))

        // Coûts par jour
        const daily: Record<string, number> = {}
        data.forEach(log => {
          const date = log.created_at.split('T')[0]
          daily[date] = (daily[date] || 0) + (parseFloat(log.cost_usd) || 0)
        })
        setDailyCosts(
          Object.entries(daily)
            .map(([date, total_cost_usd]) => ({ date, total_cost_usd }))
            .sort((a, b) => a.date.localeCompare(b.date))
        )
      }
    } catch (error) {
      console.error('Error loading costs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Totaux
  const totalCost = functionCosts.reduce((acc, f) => acc + f.total_cost_usd, 0)
  const totalRequests = functionCosts.reduce((acc, f) => acc + f.request_count, 0)
  const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0

  // Navigation mois
  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const newDate = new Date(year, month - 1 + delta, 1)
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthName = new Date(selectedMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  // Projection mensuelle
  const daysElapsed = new Date().getDate()
  const daysInMonth = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate()
  const projectedCost = daysElapsed > 0 ? (totalCost / daysElapsed) * daysInMonth : 0

  // Graphique
  const maxDailyCost = Math.max(...dailyCosts.map(d => d.total_cost_usd), 0.01)

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Coûts</h1>
          <p className="text-gray-500 text-sm">Dépenses API par fonction</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
          <div className="flex items-center gap-2 text-teal-700 text-sm mb-1">
            <DollarSign className="h-4 w-4" /> Coût total
          </div>
          <div className="text-3xl font-bold text-teal-700">${totalCost.toFixed(2)}</div>
          <div className="text-teal-600 text-xs">USD</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Calculator className="h-4 w-4" /> Coût moyen
          </div>
          <div className="text-2xl font-bold">${avgCostPerRequest.toFixed(4)}</div>
          <div className="text-gray-400 text-xs">par requête</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            Requêtes
          </div>
          <div className="text-2xl font-bold">{totalRequests}</div>
          <div className="text-gray-400 text-xs">ce mois</div>
        </Card>
        <Card className="p-4 border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2 text-orange-700 text-sm mb-1">
            <TrendingUp className="h-4 w-4" /> Projection
          </div>
          <div className="text-2xl font-bold text-orange-700">${projectedCost.toFixed(2)}</div>
          <div className="text-orange-600 text-xs">fin de mois</div>
        </Card>
      </div>

      {/* Par fonction */}
      <Card className="p-4">
        <h2 className="font-semibold mb-4">Coût par fonction</h2>
        
        {loading ? (
          <div className="text-center py-8 text-gray-500">Chargement...</div>
        ) : functionCosts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Aucune donnée pour cette période</div>
        ) : (
          <div className="space-y-3">
            {functionCosts.map((func) => {
              const percentage = totalCost > 0 ? (func.total_cost_usd / totalCost) * 100 : 0
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
                      <div className="font-bold text-lg text-teal-600">${func.total_cost_usd.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div 
                      className="h-full bg-teal-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      <span>{func.request_count} requêtes</span>
                      <span>${func.avg_cost_per_request.toFixed(4)}/req</span>
                    </div>
                    <span className="font-medium text-teal-600">{percentage.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Graphique par jour */}
      <Card className="p-4">
        <h2 className="font-semibold mb-4">Coût par jour</h2>
        <div className="h-40 flex items-end gap-1">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = String(i + 1).padStart(2, '0')
            const date = `${selectedMonth}-${day}`
            const cost = dailyCosts.find(d => d.date === date)?.total_cost_usd || 0
            const height = maxDailyCost > 0 ? (cost / maxDailyCost) * 100 : 0
            return (
              <div 
                key={day} 
                className="flex-1 bg-teal-500 rounded-t hover:bg-teal-600 transition-colors cursor-pointer group relative"
                style={{ height: `${Math.max(height, 2)}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                  {day}: ${cost.toFixed(3)}
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

      {/* Estimation états des lieux */}
      <Card className="p-4 border-blue-200 bg-blue-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-800">Estimation mensuelle</h3>
            <p className="text-blue-700 text-sm mt-1">
              Pour <strong>100 états des lieux/mois</strong> avec ~8 compteurs chacun :
            </p>
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-blue-600">800 scans</div>
                <div className="text-blue-800 font-bold">~${(800 * 0.012).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-blue-600">Coût/état des lieux</div>
                <div className="text-blue-800 font-bold">~${(8 * 0.012).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Link to Usage */}
      <div className="text-center">
        <Link href="/dashboard/analytics/usage">
          <Button variant="outline">← Voir l'usage</Button>
        </Link>
      </div>
    </div>
  )
}
