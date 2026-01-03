"use client"

import { useEffect, useState } from 'react'
import { 
  DollarSign, 
  Zap, 
  Mic, 
  Bot, 
  TrendingUp, 
  Calendar,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Types
interface UsageStats {
  period: number
  summary: {
    totalCalls: number
    totalCost: number
    todayCalls: number
    todayCost: number
    monthCalls: number
    monthCost: number
  }
  byService: {
    name: string
    calls: number
    inputTokens: number
    outputTokens: number
    audioSeconds: number
    cost: number
  }[]
  byFunction: {
    name: string
    service: string
    calls: number
    inputTokens: number
    outputTokens: number
    audioSeconds: number
    cost: number
  }[]
  byDay: {
    date: string
    calls: number
    cost: number
  }[]
}

// Config des services
const SERVICE_CONFIG: Record<string, { label: string; icon: any; color: string; dashboardUrl: string }> = {
  claude: { 
    label: 'Claude (Anthropic)', 
    icon: Bot, 
    color: 'text-orange-500 bg-orange-50',
    dashboardUrl: 'https://console.anthropic.com/settings/usage'
  },
  whisper: { 
    label: 'Whisper (OpenAI)', 
    icon: Mic, 
    color: 'text-green-500 bg-green-50',
    dashboardUrl: 'https://platform.openai.com/usage'
  },
  openai: { 
    label: 'OpenAI', 
    icon: Zap, 
    color: 'text-blue-500 bg-blue-50',
    dashboardUrl: 'https://platform.openai.com/usage'
  },
}

// Fonction pour formater les coûts
const formatCost = (cost: number) => {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

// Fonction pour formater les tokens
const formatTokens = (tokens: number) => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toString()
}

// Fonction pour formater la durée
const formatDuration = (seconds: number) => {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}min`
  return `${seconds}s`
}

export default function ApiUsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  // Fetch stats
  const fetchStats = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/usage?period=${period}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [period])

  // Calculer le max pour le graphique
  const maxDailyCost = stats?.byDay.reduce((max, d) => Math.max(max, d.cost), 0) || 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Consommation API</h1>
          <p className="text-gray-500">Suivi des coûts et de l'utilisation</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">90 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchStats}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Aujourd'hui */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Aujourd'hui</p>
              <p className="text-xl font-bold">{formatCost(stats?.summary.todayCost || 0)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{stats?.summary.todayCalls || 0} appels</p>
        </div>

        {/* Ce mois */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ce mois</p>
              <p className="text-xl font-bold">{formatCost(stats?.summary.monthCost || 0)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{stats?.summary.monthCalls || 0} appels</p>
        </div>

        {/* Période sélectionnée */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{period} derniers jours</p>
              <p className="text-xl font-bold">{formatCost(stats?.summary.totalCost || 0)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{stats?.summary.totalCalls || 0} appels</p>
        </div>

        {/* Moyenne journalière */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Moyenne/jour</p>
              <p className="text-xl font-bold">
                {formatCost((stats?.summary.totalCost || 0) / parseInt(period))}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            ~{Math.round((stats?.summary.totalCalls || 0) / parseInt(period))} appels/jour
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Par service */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-4">Par service</h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-400">Chargement...</div>
          ) : stats?.byService.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Aucune donnée</div>
          ) : (
            <div className="space-y-4">
              {stats?.byService.map(service => {
                const config = SERVICE_CONFIG[service.name] || {
                  label: service.name,
                  icon: Zap,
                  color: 'text-gray-500 bg-gray-50',
                  dashboardUrl: '#'
                }
                const Icon = config.icon
                
                return (
                  <div key={service.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{config.label}</p>
                        <p className="text-xs text-gray-500">
                          {service.calls} appels
                          {service.inputTokens > 0 && ` • ${formatTokens(service.inputTokens + service.outputTokens)} tokens`}
                          {service.audioSeconds > 0 && ` • ${formatDuration(service.audioSeconds)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCost(service.cost)}</p>
                      <a 
                        href={config.dashboardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 hover:underline flex items-center gap-1"
                      >
                        Dashboard <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Par fonction */}
        <div className="bg-white rounded-xl border p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4">Par fonction</h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-400">Chargement...</div>
          ) : stats?.byFunction.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Aucune donnée</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-gray-500">Fonction</th>
                    <th className="text-left py-2 font-medium text-gray-500">Service</th>
                    <th className="text-right py-2 font-medium text-gray-500">Appels</th>
                    <th className="text-right py-2 font-medium text-gray-500">Tokens</th>
                    <th className="text-right py-2 font-medium text-gray-500">Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.byFunction.slice(0, 10).map((func, index) => {
                    const config = SERVICE_CONFIG[func.service]
                    return (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-3">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {func.name}
                          </code>
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-1 rounded ${config?.color || 'bg-gray-100'}`}>
                            {func.service}
                          </span>
                        </td>
                        <td className="py-3 text-right">{func.calls}</td>
                        <td className="py-3 text-right text-gray-500">
                          {func.inputTokens > 0 
                            ? formatTokens(func.inputTokens + func.outputTokens)
                            : func.audioSeconds > 0
                              ? formatDuration(func.audioSeconds)
                              : '-'
                          }
                        </td>
                        <td className="py-3 text-right font-medium">{formatCost(func.cost)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Graphique par jour */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold mb-4">Évolution des coûts</h2>
        
        {loading ? (
          <div className="text-center py-8 text-gray-400">Chargement...</div>
        ) : stats?.byDay.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Aucune donnée</div>
        ) : (
          <div className="h-48">
            <div className="flex items-end justify-between h-full gap-1">
              {stats?.byDay.map((day, index) => {
                const height = maxDailyCost > 0 ? (day.cost / maxDailyCost) * 100 : 0
                const date = new Date(day.date)
                const isToday = day.date === new Date().toISOString().split('T')[0]
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className={`w-full rounded-t transition-all hover:opacity-80 ${
                        isToday ? 'bg-teal-500' : 'bg-teal-200'
                      }`}
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${day.date}: ${formatCost(day.cost)} (${day.calls} appels)`}
                    />
                    {(index === 0 || index === stats.byDay.length - 1 || isToday) && (
                      <span className="text-xs text-gray-400 transform -rotate-45 origin-left">
                        {date.getDate()}/{date.getMonth() + 1}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Liens vers dashboards officiels */}
      <div className="bg-gray-50 rounded-xl border p-5">
        <h2 className="font-semibold mb-3">Dashboards officiels</h2>
        <p className="text-sm text-gray-500 mb-4">
          Pour les données de facturation exactes, consultez les dashboards officiels :
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://console.anthropic.com/settings/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:border-orange-300 transition-colors"
          >
            <Bot className="w-4 h-4 text-orange-500" />
            <span>Anthropic Console</span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </a>
          <a
            href="https://platform.openai.com/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:border-green-300 transition-colors"
          >
            <Zap className="w-4 h-4 text-green-500" />
            <span>OpenAI Platform</span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </a>
        </div>
      </div>
    </div>
  )
}
