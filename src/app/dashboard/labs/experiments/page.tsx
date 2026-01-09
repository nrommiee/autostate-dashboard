'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { 
  FlaskConical, Play, Upload, Image as ImageIcon, Settings2,
  BarChart3, CheckCircle, XCircle, AlertTriangle,
  Clock, Zap, DollarSign, Target, TrendingUp,
  RefreshCw, Plus, Trash2, Eye, Edit,
  ChevronRight, Loader2, Camera, FileJson, Sliders,
  Beaker, Microscope, Database, Layers
} from 'lucide-react'

// Types
interface ExperimentConfig {
  id: string
  name: string
  description: string | null
  config_type: 'prompt' | 'preprocessing' | 'pipeline' | 'full'
  config_data: any
  is_active: boolean
  is_baseline: boolean
  created_at: string
}

interface ExperimentRun {
  id: string
  config_id: string
  image_url: string | null
  expected_result: any
  actual_result: any
  confidence_score: number | null
  processing_time_ms: number | null
  tokens_used: number | null
  api_cost_usd: number | null
  is_correct: boolean | null
  error_type: string | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'evaluated'
  created_at: string
  experiment_configs?: { name: string; config_type: string }
}

interface ExperimentBatch {
  id: string
  name: string
  description: string | null
  config_id: string
  total_runs: number
  completed_runs: number
  successful_runs: number
  accuracy_rate: number | null
  status: 'draft' | 'running' | 'completed' | 'cancelled'
  created_at: string
  experiment_configs?: { name: string; config_type: string }
}

interface ExperimentImage {
  id: string
  image_url: string
  thumbnail_url: string | null
  original_filename: string | null
  meter_type: string | null
  display_type: string | null
  lighting: string | null
  ground_truth: any
  tags: string[]
  times_used: number
  created_at: string
}

interface Stats {
  total_runs: number
  completed_runs: number
  evaluated_runs: number
  correct_runs: number
  accuracy_rate: number | null
  avg_confidence: number
  avg_processing_time_ms: number
  total_cost_usd: number
}

const CONFIG_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  prompt: { label: 'Prompt', icon: FileJson, color: 'bg-blue-100 text-blue-700' },
  preprocessing: { label: 'Pré-traitement', icon: Sliders, color: 'bg-purple-100 text-purple-700' },
  pipeline: { label: 'Pipeline', icon: Layers, color: 'bg-green-100 text-green-700' },
  full: { label: 'Complet', icon: Beaker, color: 'bg-orange-100 text-orange-700' }
}

export default function ExperimentsLabPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [configs, setConfigs] = useState<ExperimentConfig[]>([])
  const [runs, setRuns] = useState<ExperimentRun[]>([])
  const [batches, setBatches] = useState<ExperimentBatch[]>([])
  const [images, setImages] = useState<ExperimentImage[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  const [selectedConfig, setSelectedConfig] = useState<ExperimentConfig | null>(null)
  const [selectedRun, setSelectedRun] = useState<ExperimentRun | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showRunModal, setShowRunModal] = useState(false)

  const [testImage, setTestImage] = useState<string | null>(null)
  const [testConfigId, setTestConfigId] = useState<string>('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    try {
      const [configsRes, runsRes, batchesRes, imagesRes, statsRes] = await Promise.all([
        fetch('/api/labs/experiments/configs'),
        fetch('/api/labs/experiments/runs?limit=20'),
        fetch('/api/labs/experiments/batches?limit=10'),
        fetch('/api/labs/experiments/images?limit=20'),
        fetch('/api/labs/experiments/stats?period=7d')
      ])

      const [configsData, runsData, batchesData, imagesData, statsData] = await Promise.all([
        configsRes.json(),
        runsRes.json(),
        batchesRes.json(),
        imagesRes.json(),
        statsRes.json()
      ])

      setConfigs(configsData.configs || [])
      setRuns(runsData.runs || [])
      setBatches(batchesData.batches || [])
      setImages(imagesData.images || [])
      setStats(statsData.stats || null)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setTestImage(e.target?.result as string)
        setTestResult(null)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRunTest = async () => {
    if (!testImage || !testConfigId) return
    setTesting(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/labs/experiments/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: testConfigId,
          image_base64: testImage,
          run_immediately: true
        })
      })
      const data = await res.json()
      setTestResult(data.run)
      const runsRes = await fetch('/api/labs/experiments/runs?limit=20')
      const runsData = await runsRes.json()
      setRuns(runsData.runs || [])
    } catch (error) {
      setTestResult({ error: String(error) })
    } finally {
      setTesting(false)
    }
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-'
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
  }

  const formatCost = (usd: number | null) => {
    if (!usd) return '-'
    return `$${usd.toFixed(4)}`
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return '-'
    return `${(value * 100).toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <FlaskConical className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Labs Expérimental</h1>
            <p className="text-muted-foreground">Sandbox isolée pour tester sans risque</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <Beaker className="h-3 w-3 mr-1" />
            Environnement isolé
          </Badge>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800">Environnement de test</p>
          <p className="text-sm text-amber-700">
            Les expériences ici n'affectent pas la production. Testez librement vos nouvelles configs.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-2" />Aperçu</TabsTrigger>
          <TabsTrigger value="test"><Play className="h-4 w-4 mr-2" />Test</TabsTrigger>
          <TabsTrigger value="configs"><Settings2 className="h-4 w-4 mr-2" />Configs</TabsTrigger>
          <TabsTrigger value="batches"><Database className="h-4 w-4 mr-2" />Batches</TabsTrigger>
          <TabsTrigger value="images"><ImageIcon className="h-4 w-4 mr-2" />Images</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tests</p>
                  <p className="text-2xl font-bold">{stats?.total_runs || 0}</p>
                </div>
                <Target className="h-8 w-8 text-teal-600 opacity-50" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Précision</p>
                  <p className="text-2xl font-bold text-green-600">{formatPercent(stats?.accuracy_rate || null)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Confiance</p>
                  <p className="text-2xl font-bold">{formatPercent(stats?.avg_confidence || null)}</p>
                </div>
                <Zap className="h-8 w-8 text-yellow-600 opacity-50" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Coût</p>
                  <p className="text-2xl font-bold">{formatCost(stats?.total_cost_usd || null)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600 opacity-50" />
              </div>
            </Card>
          </div>

          {/* Recent Runs */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />Tests récents
            </h3>
            {runs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Aucun test - Lancez-en un dans l'onglet Test</p>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.slice(0, 5).map(run => (
                  <div key={run.id} className="p-3 border rounded-lg flex items-center justify-between hover:bg-muted/50 cursor-pointer"
                    onClick={() => { setSelectedRun(run); setShowRunModal(true) }}>
                    <div className="flex items-center gap-3">
                      {run.is_correct === true ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                       run.is_correct === false ? <XCircle className="h-5 w-5 text-red-600" /> :
                       <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                      <div>
                        <p className="font-medium text-sm">{run.experiment_configs?.name || 'Config'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString('fr-FR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{formatPercent(run.confidence_score)}</Badge>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Camera className="h-5 w-5" />Image</h3>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                {testImage ? (
                  <div className="relative">
                    <img src={testImage} alt="Test" className="w-full h-64 object-contain bg-gray-100 rounded-lg" />
                    <Button size="sm" variant="outline" className="absolute top-2 right-2"
                      onClick={() => { setTestImage(null); setTestResult(null) }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-teal-500"
                    onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Cliquez pour uploader</p>
                  </div>
                )}
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold mb-4"><Settings2 className="h-5 w-5 inline mr-2" />Config</h3>
                <Select value={testConfigId} onValueChange={setTestConfigId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {configs.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.is_baseline && '(Baseline)'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full mt-4" disabled={!testImage || !testConfigId || testing} onClick={handleRunTest}>
                  {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  {testing ? 'Analyse...' : 'Lancer'}
                </Button>
              </Card>
            </div>

            <Card className="p-4">
              <h3 className="font-semibold mb-4"><Microscope className="h-5 w-5 inline mr-2" />Résultat</h3>
              {testResult ? (
                <div className="space-y-4">
                  <div className={`p-3 rounded-lg ${testResult.error ? 'bg-red-50' : testResult.actual_result?.matched_model_id ? 'bg-green-50' : 'bg-yellow-50'}`}>
                    {testResult.error ? <XCircle className="h-5 w-5 text-red-600 inline mr-2" /> :
                     testResult.actual_result?.matched_model_id ? <CheckCircle className="h-5 w-5 text-green-600 inline mr-2" /> :
                     <AlertTriangle className="h-5 w-5 text-yellow-600 inline mr-2" />}
                    <span className="font-medium">
                      {testResult.error ? 'Erreur' : testResult.actual_result?.matched_model_id ? 'Modèle reconnu' : 'Non reconnu'}
                    </span>
                  </div>
                  {!testResult.error && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-xl font-bold text-teal-600">{formatPercent(testResult.confidence_score)}</p>
                        <p className="text-xs text-muted-foreground">Confiance</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-xl font-bold">{formatDuration(testResult.processing_time_ms)}</p>
                        <p className="text-xs text-muted-foreground">Temps</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-xl font-bold text-purple-600">{formatCost(testResult.api_cost_usd)}</p>
                        <p className="text-xs text-muted-foreground">Coût</p>
                      </div>
                    </div>
                  )}
                  {testResult.actual_result && (
                    <div className="space-y-2">
                      {testResult.actual_result.reading && (
                        <div className="flex justify-between p-2 bg-muted rounded">
                          <span className="text-sm">Index</span>
                          <span className="font-mono font-bold">{testResult.actual_result.reading}</span>
                        </div>
                      )}
                      {testResult.actual_result.serial_number && (
                        <div className="flex justify-between p-2 bg-muted rounded">
                          <span className="text-sm">N° série</span>
                          <span className="font-mono">{testResult.actual_result.serial_number}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <details>
                    <summary className="text-sm text-muted-foreground cursor-pointer">JSON brut</summary>
                    <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto max-h-40">
                      {JSON.stringify(testResult.actual_result || testResult, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Microscope className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Uploadez une image et lancez un test</p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Configs Tab */}
        <TabsContent value="configs" className="space-y-6">
          <div className="flex justify-between">
            <h3 className="font-semibold">Configurations</h3>
            <Button onClick={() => { setSelectedConfig(null); setShowConfigModal(true) }}>
              <Plus className="h-4 w-4 mr-2" />Nouvelle
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {configs.map(config => {
              const t = CONFIG_TYPE_LABELS[config.config_type]
              return (
                <Card key={config.id} className="p-4">
                  <div className="flex justify-between mb-3">
                    <Badge className={t.color}><t.icon className="h-3 w-3 mr-1" />{t.label}</Badge>
                    {config.is_baseline && <Badge variant="outline">Baseline</Badge>}
                  </div>
                  <h4 className="font-semibold">{config.name}</h4>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{config.description || '-'}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1"
                      onClick={() => { setSelectedConfig(config); setShowConfigModal(true) }}>
                      <Edit className="h-3 w-3 mr-1" />Modifier
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setTestConfigId(config.id); setActiveTab('test') }}>
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Batches Tab */}
        <TabsContent value="batches" className="space-y-6">
          <div className="flex justify-between">
            <h3 className="font-semibold">Batches</h3>
            <Button><Plus className="h-4 w-4 mr-2" />Nouveau batch</Button>
          </div>
          {batches.length === 0 ? (
            <Card className="p-12 text-center">
              <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">Aucun batch</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {batches.map(b => (
                <Card key={b.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${b.status === 'completed' ? 'bg-green-500' : b.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-yellow-500'}`} />
                    <div>
                      <h4 className="font-semibold">{b.name}</h4>
                      <p className="text-sm text-muted-foreground">{b.total_runs} tests</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold">{formatPercent(b.accuracy_rate)}</span>
                    <Progress value={(b.completed_runs / b.total_runs) * 100} className="w-24" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-6">
          <div className="flex justify-between">
            <h3 className="font-semibold">Bibliothèque d'images</h3>
            <Button><Upload className="h-4 w-4 mr-2" />Ajouter</Button>
          </div>
          {images.length === 0 ? (
            <Card className="p-12 text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">Aucune image</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {images.map(img => (
                <Card key={img.id} className="overflow-hidden group cursor-pointer">
                  <div className="aspect-square relative">
                    <img src={img.thumbnail_url || img.image_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary"><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="secondary" onClick={() => { setTestImage(img.image_url); setActiveTab('test') }}>
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                    {img.ground_truth && <Badge className="absolute top-2 right-2 bg-green-500 text-white text-xs">GT</Badge>}
                  </div>
                  <div className="p-2 flex gap-1 flex-wrap">
                    {img.meter_type && <Badge variant="outline" className="text-xs">{img.meter_type}</Badge>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Run Modal */}
      <Dialog open={showRunModal} onOpenChange={setShowRunModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Détail du test</DialogTitle></DialogHeader>
          {selectedRun && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-lg font-bold">{formatPercent(selectedRun.confidence_score)}</p>
                  <p className="text-xs text-muted-foreground">Confiance</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-lg font-bold">{formatDuration(selectedRun.processing_time_ms)}</p>
                  <p className="text-xs text-muted-foreground">Temps</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-lg font-bold">{selectedRun.tokens_used || '-'}</p>
                  <p className="text-xs text-muted-foreground">Tokens</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-lg font-bold">{formatCost(selectedRun.api_cost_usd)}</p>
                  <p className="text-xs text-muted-foreground">Coût</p>
                </div>
              </div>
              {selectedRun.actual_result && (
                <pre className="p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto max-h-48">
                  {JSON.stringify(selectedRun.actual_result, null, 2)}
                </pre>
              )}
              {selectedRun.is_correct === null && selectedRun.status === 'completed' && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4 mr-2" />Correct</Button>
                  <Button variant="destructive" className="flex-1"><XCircle className="h-4 w-4 mr-2" />Incorrect</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Config Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedConfig ? 'Modifier' : 'Nouvelle'} configuration</DialogTitle></DialogHeader>
          <ConfigEditor config={selectedConfig} onSave={async () => { setShowConfigModal(false); await loadData() }} onCancel={() => setShowConfigModal(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ConfigEditor({ config, onSave, onCancel }: { config: ExperimentConfig | null; onSave: () => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(config?.name || '')
  const [description, setDescription] = useState(config?.description || '')
  const [configType, setConfigType] = useState<string>(config?.config_type || 'prompt')
  const [configData, setConfigData] = useState(JSON.stringify(config?.config_data || {}, null, 2))
  const [isBaseline, setIsBaseline] = useState(config?.is_baseline || false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      let parsed = {}
      try { parsed = JSON.parse(configData) } catch { alert('JSON invalide'); return }
      const method = config ? 'PUT' : 'POST'
      const body = config 
        ? { id: config.id, name, description, config_data: parsed, is_baseline: isBaseline }
        : { name, description, config_type: configType, config_data: parsed, is_baseline: isBaseline }
      await fetch('/api/labs/experiments/configs', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      await onSave()
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div><label className="text-sm font-medium">Nom</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><label className="text-sm font-medium">Description</label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      {!config && (
        <div><label className="text-sm font-medium">Type</label>
          <Select value={configType} onValueChange={setConfigType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="prompt">Prompt</SelectItem>
              <SelectItem value="preprocessing">Pré-traitement</SelectItem>
              <SelectItem value="pipeline">Pipeline</SelectItem>
              <SelectItem value="full">Complet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div><label className="text-sm font-medium">Config JSON</label><Textarea value={configData} onChange={(e) => setConfigData(e.target.value)} className="font-mono h-40" /></div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="bl" checked={isBaseline} onChange={(e) => setIsBaseline(e.target.checked)} />
        <label htmlFor="bl" className="text-sm">Baseline</label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving || !name}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{config ? 'Modifier' : 'Créer'}</Button>
      </DialogFooter>
    </div>
  )
}
