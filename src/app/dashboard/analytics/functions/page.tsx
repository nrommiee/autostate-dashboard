'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Zap, 
  Image, 
  Mic, 
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react'

interface ApiFunction {
  id: string
  name: string
  description: string
  provider: string
  model: string
  icon: string
  endpoint: string
  supportsImages: boolean
  supportsAudio: boolean
  pricing: {
    inputPer1MTokens: number
    outputPer1MTokens: number
    perImage?: number
    perAudioMinute?: number
  }
}

interface FunctionStats {
  function_id: string
  request_count: number
  success_count: number
  total_cost: number
  avg_response_time: number
}

export default function ApiFunctionsPage() {
  const [functions, setFunctions] = useState<ApiFunction[]>([])
  const [stats, setStats] = useState<Record<string, FunctionStats>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Charger les fonctions depuis l'API
      const res = await fetch('/api/ai')
      const data = await res.json()
      setFunctions(data.functions || [])

      // Charger les stats depuis Supabase
      const { supabase } = await import('@/lib/supabase')
      const { data: logs } = await supabase
        .from('api_usage_logs')
        .select('function_id, success, cost_usd, response_time_ms')
      
      if (logs) {
        const grouped: Record<string, FunctionStats> = {}
        logs.forEach(log => {
          if (!grouped[log.function_id]) {
            grouped[log.function_id] = {
              function_id: log.function_id,
              request_count: 0,
              success_count: 0,
              total_cost: 0,
              avg_response_time: 0
            }
          }
          grouped[log.function_id].request_count++
          if (log.success) grouped[log.function_id].success_count++
          grouped[log.function_id].total_cost += parseFloat(log.cost_usd) || 0
          grouped[log.function_id].avg_response_time += log.response_time_ms || 0
        })
        
        // Calculer les moyennes
        Object.values(grouped).forEach(s => {
          s.avg_response_time = s.request_count > 0 
            ? Math.round(s.avg_response_time / s.request_count) 
            : 0
        })
        
        setStats(grouped)
      }
    } catch (error) {
      console.error('Error loading functions:', error)
    } finally {
      setLoading(false)
    }
  }

  const providerBadge = (provider: string) => {
    const colors: Record<string, string> = {
      anthropic: 'bg-orange-100 text-orange-700',
      openai: 'bg-green-100 text-green-700'
    }
    return (
      <Badge className={colors[provider] || 'bg-gray-100'}>
        {provider}
      </Badge>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Fonctions API</h1>
          <p className="text-gray-500 text-sm">Toutes les fonctions AI disponibles</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Fonctions</div>
          <div className="text-2xl font-bold">{functions.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Requêtes totales</div>
          <div className="text-2xl font-bold">
            {Object.values(stats).reduce((acc, s) => acc + s.request_count, 0)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Coût total</div>
          <div className="text-2xl font-bold text-teal-600">
            ${Object.values(stats).reduce((acc, s) => acc + s.total_cost, 0).toFixed(2)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Taux succès</div>
          <div className="text-2xl font-bold text-green-600">
            {(() => {
              const total = Object.values(stats).reduce((acc, s) => acc + s.request_count, 0)
              const success = Object.values(stats).reduce((acc, s) => acc + s.success_count, 0)
              return total > 0 ? `${Math.round((success / total) * 100)}%` : '-'
            })()}
          </div>
        </Card>
      </div>

      {/* Liste des fonctions */}
      <div className="grid gap-4">
        {loading ? (
          <Card className="p-8 text-center text-gray-500">
            Chargement des fonctions...
          </Card>
        ) : functions.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            Aucune fonction disponible
          </Card>
        ) : (
          functions.map(func => {
            const funcStats = stats[func.id]
            const successRate = funcStats && funcStats.request_count > 0
              ? Math.round((funcStats.success_count / funcStats.request_count) * 100)
              : null

            return (
              <Card key={func.id} className="p-4">
                <div className="flex items-start justify-between">
                  {/* Info */}
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{func.icon}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{func.name}</h3>
                        {providerBadge(func.provider)}
                        {func.supportsImages && (
                          <Badge variant="outline" className="gap-1">
                            <Image className="h-3 w-3" /> Images
                          </Badge>
                        )}
                        {func.supportsAudio && (
                          <Badge variant="outline" className="gap-1">
                            <Mic className="h-3 w-3" /> Audio
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm">{func.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>Model: {func.model}</span>
                        <span>Endpoint: <code className="bg-gray-100 px-1 rounded">{func.endpoint}</code></span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    {funcStats ? (
                      <>
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-gray-500">
                            <Zap className="h-4 w-4" />
                          </div>
                          <div className="font-bold">{funcStats.request_count}</div>
                          <div className="text-xs text-gray-400">requêtes</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            {successRate !== null && successRate >= 90 ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                          <div className="font-bold">{successRate}%</div>
                          <div className="text-xs text-gray-400">succès</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-gray-500">
                            <Clock className="h-4 w-4" />
                          </div>
                          <div className="font-bold">{funcStats.avg_response_time}ms</div>
                          <div className="text-xs text-gray-400">avg</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center gap-1 text-gray-500">
                            <DollarSign className="h-4 w-4" />
                          </div>
                          <div className="font-bold text-teal-600">${funcStats.total_cost.toFixed(3)}</div>
                          <div className="text-xs text-gray-400">total</div>
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-400 text-sm">Aucune utilisation</div>
                    )}
                  </div>
                </div>

                {/* Pricing */}
                <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-gray-500">
                  <span>Pricing:</span>
                  <span>Input: ${func.pricing.inputPer1MTokens}/1M tokens</span>
                  <span>Output: ${func.pricing.outputPer1MTokens}/1M tokens</span>
                  {func.pricing.perImage && <span>Image: ${func.pricing.perImage}/img</span>}
                  {func.pricing.perAudioMinute && <span>Audio: ${func.pricing.perAudioMinute}/min</span>}
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
