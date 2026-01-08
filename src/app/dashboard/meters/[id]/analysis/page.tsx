'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  ArrowLeft, FileText, FlaskConical, Settings, Check, ZoomIn, X,
  Loader2, CheckCircle, AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface MeterModel {
  id: string
  name: string
  manufacturer: string | null
  meter_type: string
  reference_photos: string[]
  is_active: boolean
}

interface PromptVersion {
  id: string
  model_id: string
  version: number
  prompt_text: string
  is_active: boolean
  created_at: string
  success_rate?: number
  test_count?: number
}

interface TestConfig {
  id: string
  model_id: string
  name: string
  grayscale: boolean
  contrast: number
  sharpness: number
  is_active: boolean
  created_at: string
  success_rate?: number
  test_count?: number
}

interface LabsExperiment {
  id: string
  meter_model_id: string
  prompt_version_id: string | null
  test_config_id: string | null
  status: string
  created_at: string
}

const METER_TYPE_ICONS: Record<string, string> = {
  gas: '🔥',
  electricity: '⚡',
  water_general: '💧',
  water_passage: '🚿',
  oil_tank: '🛢️',
  calorimeter: '🌡️',
  other: '📊',
}

export default function AnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const modelId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [model, setModel] = useState<MeterModel | null>(null)
  const [prompts, setPrompts] = useState<PromptVersion[]>([])
  const [configs, setConfigs] = useState<TestConfig[]>([])
  const [tests, setTests] = useState<LabsExperiment[]>([])
  
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('prompts')
  
  const [showImageLightbox, setShowImageLightbox] = useState(false)
  const [showPromptDetail, setShowPromptDetail] = useState(false)
  const [showConfigDetail, setShowConfigDetail] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Stats
  const totalTests = tests.length
  const validatedTests = tests.filter(t => t.status === 'validated' || t.status === 'corrected').length
  const successRate = totalTests > 0 ? Math.round((validatedTests / totalTests) * 100) : 0
  const activePrompt = prompts.find(p => p.is_active)
  const activeConfig = configs.find(c => c.is_active)

  // Selected items
  const selectedPrompt = prompts.find(p => p.id === selectedPromptId)
  const selectedConfig = configs.find(c => c.id === selectedConfigId)

  useEffect(() => {
    loadData()
  }, [modelId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load model
      const { data: modelData } = await supabase
        .from('meter_models')
        .select('*')
        .eq('id', modelId)
        .single()
      
      if (modelData) setModel(modelData)

      // Load prompts
      const { data: promptsData } = await supabase
        .from('prompt_versions')
        .select('*')
        .eq('model_id', modelId)
        .order('version', { ascending: false })

      // Load configs
      const { data: configsData } = await supabase
        .from('test_configs')
        .select('*')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false })

      // Load tests
      const { data: testsData } = await supabase
        .from('labs_experiments')
        .select('*')
        .eq('meter_model_id', modelId)
        .order('created_at', { ascending: false })

      const testsArray = testsData || []
      setTests(testsArray)

      // Calculate success rates for prompts
      const promptsWithStats = (promptsData || []).map(prompt => {
        const promptTests = testsArray.filter(t => t.prompt_version_id === prompt.id)
        const validated = promptTests.filter(t => t.status === 'validated' || t.status === 'corrected').length
        return {
          ...prompt,
          test_count: promptTests.length,
          success_rate: promptTests.length > 0 ? Math.round((validated / promptTests.length) * 100) : null
        }
      })
      setPrompts(promptsWithStats)

      // Calculate success rates for configs
      const configsWithStats = (configsData || []).map(config => {
        const configTests = testsArray.filter(t => t.test_config_id === config.id)
        const validated = configTests.filter(t => t.status === 'validated' || t.status === 'corrected').length
        return {
          ...config,
          test_count: configTests.length,
          success_rate: configTests.length > 0 ? Math.round((validated / configTests.length) * 100) : null
        }
      })
      setConfigs(configsWithStats)

      // Set initial selections to active items
      const activeP = promptsWithStats.find(p => p.is_active)
      const activeC = configsWithStats.find(c => c.is_active)
      if (activeP) setSelectedPromptId(activeP.id)
      if (activeC) setSelectedConfigId(activeC.id)

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyVersion = async () => {
    if (!selectedPromptId || !selectedConfigId) return
    
    setSaving(true)
    try {
      // Deactivate all prompts, activate selected
      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('model_id', modelId)
      
      await supabase
        .from('prompt_versions')
        .update({ is_active: true })
        .eq('id', selectedPromptId)

      // Deactivate all configs, activate selected
      await supabase
        .from('test_configs')
        .update({ is_active: false })
        .eq('model_id', modelId)
      
      await supabase
        .from('test_configs')
        .update({ is_active: true })
        .eq('id', selectedConfigId)

      setSuccessMessage('Version activée avec succès !')
      setTimeout(() => setSuccessMessage(null), 3000)
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error applying version:', error)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-BE', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getConfigDescription = (config: TestConfig) => {
    const parts = []
    if (config.grayscale) parts.push('N&B')
    if (config.contrast !== 0) parts.push(`Contraste ${config.contrast > 0 ? '+' : ''}${config.contrast}%`)
    if (config.sharpness !== 0) parts.push(`Netteté ${config.sharpness > 0 ? '+' : ''}${config.sharpness}%`)
    return parts.length > 0 ? parts.join(', ') : 'Original'
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!model) {
    return (
      <div className="p-6">
        <p className="text-red-500">Modèle non trouvé</p>
      </div>
    )
  }

  const photoUrl = model.reference_photos?.[0]
  const typeIcon = METER_TYPE_ICONS[model.meter_type] || '📊'

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/meters/${modelId}`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {typeIcon} {model.name}
              <span className="text-gray-400 font-normal">— Analyse des versions</span>
            </h1>
            <p className="text-sm text-gray-500">{model.manufacturer}</p>
          </div>
        </div>
        {model.is_active ? (
          <Badge className="bg-green-100 text-green-700">Actif</Badge>
        ) : (
          <Badge variant="outline" className="text-gray-500">Inactif</Badge>
        )}
      </div>

      {/* Success message */}
      {successMessage && (
        <Card className="p-3 mb-4 bg-green-50 border-green-200 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-green-700 text-sm">{successMessage}</span>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{totalTests}</div>
          <div className="text-xs text-gray-500">Tests total</div>
        </Card>
        <Card className="p-4 text-center">
          <div className={`text-2xl font-bold ${successRate >= 70 ? 'text-green-600' : successRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {successRate}%
          </div>
          <div className="text-xs text-gray-500">Réussite ({validatedTests}/{totalTests})</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-teal-600">
            {activePrompt ? `v${activePrompt.version}` : '-'}
            {activeConfig ? `+#${configs.indexOf(activeConfig) + 1}` : ''}
          </div>
          <div className="text-xs text-gray-500">Version active</div>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Photo */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Photo de référence</h3>
          {photoUrl ? (
            <div className="relative">
              <img 
                src={photoUrl} 
                alt={model.name} 
                className="w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setShowImageLightbox(true)}
              />
              <button 
                onClick={() => setShowImageLightbox(true)}
                className="absolute bottom-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-gray-400">Pas de photo</span>
            </div>
          )}
        </Card>

        {/* Tabs */}
        <div className="md:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="prompts" className="gap-2">
                <FileText className="h-4 w-4" />
                Prompts
              </TabsTrigger>
              <TabsTrigger value="configs" className="gap-2">
                <FlaskConical className="h-4 w-4" />
                Configs
              </TabsTrigger>
              <TabsTrigger value="version" className="gap-2">
                <Settings className="h-4 w-4" />
                Version
              </TabsTrigger>
            </TabsList>

            {/* Prompts tab */}
            <TabsContent value="prompts">
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Prompts disponibles</h3>
                {prompts.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Aucun prompt créé</p>
                ) : (
                  <div className="space-y-2">
                    {prompts.map((prompt) => (
                      <div 
                        key={prompt.id}
                        onClick={() => setSelectedPromptId(prompt.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedPromptId === prompt.id 
                            ? 'border-teal-500 bg-teal-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedPromptId === prompt.id ? 'border-teal-500' : 'border-gray-300'
                            }`}>
                              {selectedPromptId === prompt.id && (
                                <div className="w-2 h-2 rounded-full bg-teal-500" />
                              )}
                            </div>
                            <div>
                              <span className="font-medium">v{prompt.version}</span>
                              <span className="text-gray-400 text-sm ml-2">{formatDate(prompt.created_at)}</span>
                            </div>
                            {prompt.is_active && (
                              <Badge className="bg-green-100 text-green-700 text-xs">✓ ACTIF</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {prompt.success_rate !== null && (
                              <span className={`font-medium ${
                                prompt.success_rate >= 70 ? 'text-green-600' : 
                                prompt.success_rate >= 50 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {prompt.success_rate}%
                              </span>
                            )}
                            <span className="text-xs text-gray-400">({prompt.test_count} tests)</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected prompt detail */}
                {selectedPrompt && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Prompt v{selectedPrompt.version}</h4>
                      <Button variant="ghost" size="sm" onClick={() => setShowPromptDetail(true)}>
                        Voir complet
                      </Button>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {selectedPrompt.prompt_text?.slice(0, 300)}
                      {(selectedPrompt.prompt_text?.length || 0) > 300 && '...'}
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Configs tab */}
            <TabsContent value="configs">
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Configurations de test</h3>
                {configs.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Aucune configuration créée</p>
                ) : (
                  <div className="space-y-2">
                    {configs.map((config, index) => (
                      <div 
                        key={config.id}
                        onClick={() => setSelectedConfigId(config.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedConfigId === config.id 
                            ? 'border-teal-500 bg-teal-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedConfigId === config.id ? 'border-teal-500' : 'border-gray-300'
                            }`}>
                              {selectedConfigId === config.id && (
                                <div className="w-2 h-2 rounded-full bg-teal-500" />
                              )}
                            </div>
                            <div>
                              <span className="font-medium">#{index + 1}</span>
                              <span className="text-gray-400 text-sm ml-2">{formatDate(config.created_at)}</span>
                              <span className="text-gray-500 text-sm ml-2">— {getConfigDescription(config)}</span>
                            </div>
                            {config.is_active && (
                              <Badge className="bg-green-100 text-green-700 text-xs">✓ ACTIF</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {config.success_rate !== null && (
                              <span className={`font-medium ${
                                config.success_rate >= 70 ? 'text-green-600' : 
                                config.success_rate >= 50 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {config.success_rate}%
                              </span>
                            )}
                            <span className="text-xs text-gray-400">({config.test_count} tests)</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected config detail */}
                {selectedConfig && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Configuration #{configs.indexOf(selectedConfig) + 1}</h4>
                    <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Noir & Blanc</span>
                        <div className="font-medium">{selectedConfig.grayscale ? 'Oui' : 'Non'}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Contraste</span>
                        <div className="font-medium">{selectedConfig.contrast}%</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Netteté</span>
                        <div className="font-medium">{selectedConfig.sharpness}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Version tab */}
            <TabsContent value="version">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Définir la version active</h3>
                
                <div className="space-y-4">
                  {/* Prompt selector */}
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Prompt</label>
                    <Select value={selectedPromptId || ''} onValueChange={setSelectedPromptId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un prompt" />
                      </SelectTrigger>
                      <SelectContent>
                        {prompts.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            v{p.version} {p.is_active && '(actif)'} — {p.success_rate !== null ? `${p.success_rate}%` : '-'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Config selector */}
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Configuration test</label>
                    <Select value={selectedConfigId || ''} onValueChange={setSelectedConfigId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une config" />
                      </SelectTrigger>
                      <SelectContent>
                        {configs.map((c, i) => (
                          <SelectItem key={c.id} value={c.id}>
                            #{i + 1} - {getConfigDescription(c)} {c.is_active && '(actif)'} — {c.success_rate !== null ? `${c.success_rate}%` : '-'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Summary */}
                  <div className="border-t pt-4 mt-4">
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-center">
                      <div className="text-sm text-teal-700 mb-1">Version à activer</div>
                      <div className="text-xl font-bold text-teal-800">
                        {selectedPrompt ? `v${selectedPrompt.version}` : '-'} + {selectedConfig ? `#${configs.indexOf(selectedConfig) + 1}` : '-'}
                      </div>
                      {selectedPrompt && selectedConfig && (
                        <div className="text-sm text-teal-600 mt-1">
                          {getConfigDescription(selectedConfig)}
                        </div>
                      )}
                    </div>

                    {/* Check if selection differs from current active */}
                    {selectedPromptId && selectedConfigId && (
                      (selectedPromptId !== activePrompt?.id || selectedConfigId !== activeConfig?.id) ? (
                        <Button 
                          onClick={applyVersion}
                          disabled={saving}
                          className="w-full mt-4 bg-teal-600 hover:bg-teal-700"
                        >
                          {saving ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Application...</>
                          ) : (
                            <><Check className="h-4 w-4 mr-2" />Appliquer cette version</>
                          )}
                        </Button>
                      ) : (
                        <div className="mt-4 text-center text-sm text-gray-500">
                          <CheckCircle className="h-4 w-4 inline mr-1 text-green-500" />
                          Cette version est déjà active
                        </div>
                      )
                    )}

                    {(!selectedPromptId || !selectedConfigId) && (
                      <div className="mt-4 text-center text-sm text-yellow-600">
                        <AlertCircle className="h-4 w-4 inline mr-1" />
                        Sélectionnez un prompt et une configuration
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={showImageLightbox} onOpenChange={setShowImageLightbox}>
        <DialogContent className="max-w-4xl p-2">
          <DialogHeader className="sr-only"><DialogTitle>Image</DialogTitle></DialogHeader>
          {photoUrl && (
            <div className="relative">
              <img src={photoUrl} alt={model.name} className="w-full max-h-[80vh] object-contain rounded-lg" />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
                onClick={() => setShowImageLightbox(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Prompt detail modal */}
      <Dialog open={showPromptDetail} onOpenChange={setShowPromptDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prompt v{selectedPrompt?.version}</DialogTitle>
          </DialogHeader>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
            {selectedPrompt?.prompt_text}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
