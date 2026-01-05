'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { 
  MoreVertical,
  RefreshCw,
  Image,
  Mic,
  FileText,
  Check,
  X,
  Pencil,
  Eye,
  Zap,
  Clock,
  CheckCircle
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface ApiFunction {
  id: string
  name: string
  customName?: string
  description: string
  customDescription?: string
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

interface DbFunction {
  id: string
  function_id: string
  custom_name: string | null
  custom_description: string | null
}

// ============================================
// LOGOS
// ============================================
const AnthropicLogo = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M17.304 3.541l-5.296 16.918H9.262L4.696 7.831h2.858l3.211 10.588L14.446 3.54h2.858zM19.345 20.459L15.39 7.831h2.858l3.955 12.628h-2.858z"/>
  </svg>
)

const OpenAILogo = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
  </svg>
)

// ============================================
// MAIN COMPONENT
// ============================================
export default function ApiFunctionsPage() {
  const [functions, setFunctions] = useState<ApiFunction[]>([])
  const [dbFunctions, setDbFunctions] = useState<Record<string, DbFunction>>({})
  const [stats, setStats] = useState<Record<string, FunctionStats>>({})
  const [loading, setLoading] = useState(true)
  
  // Édition inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  
  // Sheet détail
  const [selectedFunction, setSelectedFunction] = useState<ApiFunction | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // 1. Charger les fonctions depuis l'API
      const res = await fetch('/api/ai')
      const data = await res.json()
      setFunctions(data.functions || [])

      // 2. Charger les noms personnalisés depuis Supabase
      const { data: dbData } = await supabase
        .from('api_functions')
        .select('*')
      
      if (dbData) {
        const mapped: Record<string, DbFunction> = {}
        dbData.forEach((d: DbFunction) => {
          mapped[d.function_id] = d
        })
        setDbFunctions(mapped)
      }

      // 3. Charger les stats
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

  // Sauvegarder le nom personnalisé
  async function saveCustomName(functionId: string, newName: string) {
    const existing = dbFunctions[functionId]
    
    if (existing) {
      await supabase
        .from('api_functions')
        .update({ custom_name: newName })
        .eq('function_id', functionId)
    } else {
      await supabase
        .from('api_functions')
        .insert({ function_id: functionId, custom_name: newName })
    }
    
    setDbFunctions(prev => ({
      ...prev,
      [functionId]: {
        ...prev[functionId],
        id: prev[functionId]?.id || '',
        function_id: functionId,
        custom_name: newName,
        custom_description: prev[functionId]?.custom_description || null
      }
    }))
    
    setEditingId(null)
  }

  // Sauvegarder la description personnalisée
  async function saveCustomDescription(functionId: string, newDesc: string) {
    const existing = dbFunctions[functionId]
    
    if (existing) {
      await supabase
        .from('api_functions')
        .update({ custom_description: newDesc })
        .eq('function_id', functionId)
    } else {
      await supabase
        .from('api_functions')
        .insert({ function_id: functionId, custom_description: newDesc })
    }
    
    setDbFunctions(prev => ({
      ...prev,
      [functionId]: {
        ...prev[functionId],
        id: prev[functionId]?.id || '',
        function_id: functionId,
        custom_name: prev[functionId]?.custom_name || null,
        custom_description: newDesc
      }
    }))
  }

  // Obtenir le nom affiché (custom ou default)
  const getDisplayName = (func: ApiFunction) => {
    return dbFunctions[func.id]?.custom_name || func.name
  }

  const getDisplayDescription = (func: ApiFunction) => {
    return dbFunctions[func.id]?.custom_description || func.description
  }

  // Stats totales
  const totalRequests = Object.values(stats).reduce((acc, s) => acc + s.request_count, 0)
  const totalCost = Object.values(stats).reduce((acc, s) => acc + s.total_cost, 0)
  const totalSuccess = Object.values(stats).reduce((acc, s) => acc + s.success_count, 0)
  const successRate = totalRequests > 0 ? Math.round((totalSuccess / totalRequests) * 100) : 0

  // Type icon
  const getTypeIcon = (func: ApiFunction) => {
    if (func.supportsAudio) return <Mic className="h-4 w-4 text-purple-500" />
    if (func.supportsImages) return <Image className="h-4 w-4 text-blue-500" />
    return <FileText className="h-4 w-4 text-gray-500" />
  }

  const getTypeLabel = (func: ApiFunction) => {
    if (func.supportsAudio) return 'Audio'
    if (func.supportsImages) return 'Image'
    return 'Texte'
  }

  // LLM logo
  const getLLMLogo = (provider: string) => {
    if (provider === 'anthropic') return <AnthropicLogo />
    if (provider === 'openai') return <OpenAILogo />
    return null
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

      {/* Stats globales - 4 blocs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Fonctions</div>
          <div className="text-2xl font-bold">{functions.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Requêtes</div>
          <div className="text-2xl font-bold">{totalRequests}</div>
        </Card>
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Coût total</div>
          <div className="text-2xl font-bold text-teal-600">${totalCost.toFixed(2)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Taux succès</div>
          <div className="text-2xl font-bold text-green-600">{successRate}%</div>
        </Card>
      </div>

      {/* Tableau */}
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600">Nom API</th>
              <th className="text-left p-4 font-medium text-gray-600">Type</th>
              <th className="text-left p-4 font-medium text-gray-600">LLM</th>
              <th className="text-center p-4 font-medium text-gray-600">Requêtes</th>
              <th className="text-right p-4 font-medium text-teal-600">Coût total</th>
              <th className="text-right p-4 font-medium text-gray-600">Coût moyen</th>
              <th className="p-4 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  Chargement...
                </td>
              </tr>
            ) : functions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  Aucune fonction
                </td>
              </tr>
            ) : (
              functions.map(func => {
                const funcStats = stats[func.id]
                const avgCost = funcStats && funcStats.request_count > 0
                  ? funcStats.total_cost / funcStats.request_count
                  : 0

                return (
                  <tr key={func.id} className="hover:bg-gray-50">
                    {/* Nom API - Éditable */}
                    <td className="p-4">
                      {editingId === func.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 w-48"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => saveCustomName(func.id, editValue)}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4 text-gray-400" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span className="text-xl">{func.icon}</span>
                          <span className="font-medium">{getDisplayName(func)}</span>
                          <button
                            onClick={() => {
                              setEditingId(func.id)
                              setEditValue(getDisplayName(func))
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(func)}
                        <span className="text-sm text-gray-600">{getTypeLabel(func)}</span>
                      </div>
                    </td>

                    {/* LLM */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getLLMLogo(func.provider)}
                      </div>
                    </td>

                    {/* Requêtes */}
                    <td className="p-4 text-center">
                      <span className="font-medium">
                        {funcStats?.request_count || 0}
                      </span>
                    </td>

                    {/* Coût total */}
                    <td className="p-4 text-right">
                      <span className="font-bold text-teal-600">
                        ${(funcStats?.total_cost || 0).toFixed(3)}
                      </span>
                    </td>

                    {/* Coût moyen */}
                    <td className="p-4 text-right">
                      <span className="text-gray-600">
                        ${avgCost.toFixed(4)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedFunction(func)
                            setSheetOpen(true)
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Voir la fiche
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditingId(func.id)
                            setEditValue(getDisplayName(func))
                          }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Renommer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 text-sm text-gray-500">
          {functions.length} fonction{functions.length > 1 ? 's' : ''}
        </div>
      </Card>

      {/* Sheet - Fiche complète */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          {selectedFunction && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span className="text-2xl">{selectedFunction.icon}</span>
                  {getDisplayName(selectedFunction)}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Description éditable */}
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <Textarea
                    value={getDisplayDescription(selectedFunction)}
                    onChange={(e) => {
                      // Update local state immediately
                      setDbFunctions(prev => ({
                        ...prev,
                        [selectedFunction.id]: {
                          ...prev[selectedFunction.id],
                          id: prev[selectedFunction.id]?.id || '',
                          function_id: selectedFunction.id,
                          custom_name: prev[selectedFunction.id]?.custom_name || null,
                          custom_description: e.target.value
                        }
                      }))
                    }}
                    onBlur={(e) => saveCustomDescription(selectedFunction.id, e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>

                {/* Infos techniques */}
                <div className="space-y-3">
                  <h3 className="font-medium">Informations techniques</h3>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Provider</span>
                      <div className="flex items-center gap-2 mt-1">
                        {getLLMLogo(selectedFunction.provider)}
                        <span className="capitalize">{selectedFunction.provider}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Modèle</span>
                      <div className="mt-1 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {selectedFunction.model}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-500 text-sm">Endpoint</span>
                    <div className="mt-1 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {selectedFunction.endpoint}
                    </div>
                  </div>

                  <div>
                    <span className="text-gray-500 text-sm">Type</span>
                    <div className="flex items-center gap-2 mt-1">
                      {getTypeIcon(selectedFunction)}
                      <span>{getTypeLabel(selectedFunction)}</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                {stats[selectedFunction.id] && (
                  <div className="space-y-3">
                    <h3 className="font-medium">Statistiques</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="p-3">
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <Zap className="h-4 w-4" />
                          Requêtes
                        </div>
                        <div className="text-xl font-bold mt-1">
                          {stats[selectedFunction.id].request_count}
                        </div>
                      </Card>
                      
                      <Card className="p-3">
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          Succès
                        </div>
                        <div className="text-xl font-bold mt-1 text-green-600">
                          {stats[selectedFunction.id].request_count > 0
                            ? Math.round((stats[selectedFunction.id].success_count / stats[selectedFunction.id].request_count) * 100)
                            : 0}%
                        </div>
                      </Card>
                      
                      <Card className="p-3">
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <Clock className="h-4 w-4" />
                          Temps moyen
                        </div>
                        <div className="text-xl font-bold mt-1">
                          {stats[selectedFunction.id].avg_response_time}ms
                        </div>
                      </Card>
                      
                      <Card className="p-3">
                        <div className="flex items-center gap-2 text-teal-600 text-sm">
                          $
                          Coût total
                        </div>
                        <div className="text-xl font-bold mt-1 text-teal-600">
                          ${stats[selectedFunction.id].total_cost.toFixed(3)}
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Pricing */}
                <div className="space-y-3">
                  <h3 className="font-medium">Tarification</h3>
                  <div className="text-sm space-y-1 text-gray-600">
                    <div>Input: ${selectedFunction.pricing.inputPer1MTokens}/1M tokens</div>
                    <div>Output: ${selectedFunction.pricing.outputPer1MTokens}/1M tokens</div>
                    {selectedFunction.pricing.perImage && (
                      <div>Image: ${selectedFunction.pricing.perImage}/image</div>
                    )}
                    {selectedFunction.pricing.perAudioMinute && (
                      <div>Audio: ${selectedFunction.pricing.perAudioMinute}/minute</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
