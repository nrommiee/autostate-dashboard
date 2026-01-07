'use client'

import { useEffect, useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  Upload, Play, Check, X, RotateCcw, Loader2, 
  CheckCircle, XCircle, Edit3, Zap, 
  ImageIcon, TrendingUp, FlaskConical, BarChart3,
  Target, Star, Lightbulb, Image as ImageIconLucide
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Types
interface MeterModel {
  id: string
  name: string
  manufacturer: string | null
  meter_type: string
  unit: string
  recognition_version_id: string | null
  image_config_overrides: ImageConfig
  reference_photos: string[]
}

interface RecognitionVersion {
  id: string
  codename: string
  version_number: string
  display_name: string
  status: string
  is_default: boolean
  default_image_config: ImageConfig
}

interface ImageConfig {
  grayscale: boolean
  contrast: number
  brightness: number
  sharpness: number
  auto_crop: boolean
  max_dimension: number
  jpeg_quality: number
}

interface TestResult {
  success: boolean
  serial_number: string | null
  reading: string | null
  confidence: number
  tokens_input: number
  tokens_output: number
  processing_time_ms: number
  raw_response: any
}

interface LabExperiment {
  id: string
  meter_model_id: string
  status: string
  extracted_data: any
  confidence: number
  tokens_input: number
  tokens_output: number
  processing_time_ms: number
  image_config_used: ImageConfig
  created_at: string
  corrected_data: any
}

interface ConfigStats {
  configKey: string
  config: ImageConfig
  tests: number
  validated: number
  corrected: number
  rejected: number
  successRate: number
  avgConfidence: number
  avgTokens: number
  isActive: boolean
}

const DEFAULT_CONFIG: ImageConfig = {
  grayscale: true,
  contrast: 30,
  brightness: 0,
  sharpness: 20,
  auto_crop: true,
  max_dimension: 1024,
  jpeg_quality: 85
}

const NEUTRAL_CONFIG: ImageConfig = {
  grayscale: false,
  contrast: 0,
  brightness: 0,
  sharpness: 0,
  auto_crop: false,
  max_dimension: 1024,
  jpeg_quality: 85
}

const METER_TYPE_ICONS: Record<string, string> = {
  gas: '🔥',
  electricity: '⚡',
  water_general: '💧',
  water_passage: '🚿',
  oil_tank: '🛢️',
  calorimeter: '🌡️',
  other: '📊'
}

function getConfigKey(config: ImageConfig): string {
  return `${config.grayscale ? 'bw' : 'color'}_c${config.contrast}_b${config.brightness}_s${config.sharpness}_ac${config.auto_crop}`
}

function formatConfig(config: ImageConfig): string {
  const parts = []
  if (config.grayscale) parts.push('N&B')
  else parts.push('Couleur')
  if (config.contrast !== 0) parts.push(`C:${config.contrast > 0 ? '+' : ''}${config.contrast}%`)
  if (config.brightness !== 0) parts.push(`L:${config.brightness > 0 ? '+' : ''}${config.brightness}%`)
  if (config.sharpness !== 0) parts.push(`N:${config.sharpness}%`)
  return parts.join(' • ')
}

function configsEqual(a: ImageConfig, b: ImageConfig): boolean {
  return a.grayscale === b.grayscale &&
    a.contrast === b.contrast &&
    a.brightness === b.brightness &&
    a.sharpness === b.sharpness &&
    a.auto_crop === b.auto_crop
}

export default function LabsMetersPage() {
  const [models, setModels] = useState<MeterModel[]>([])
  const [versions, setVersions] = useState<RecognitionVersion[]>([])
  const [experiments, setExperiments] = useState<LabExperiment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<MeterModel | null>(null)
  const [activeVersion, setActiveVersion] = useState<RecognitionVersion | null>(null)
  const [activeTab, setActiveTab] = useState<'test' | 'analyze'>('test')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null)
  const [processedPhotoUrl, setProcessedPhotoUrl] = useState<string | null>(null)
  const [imageConfig, setImageConfig] = useState<ImageConfig>(DEFAULT_CONFIG)
  const [savedModelConfig, setSavedModelConfig] = useState<ImageConfig>(DEFAULT_CONFIG)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [correctionSerial, setCorrectionSerial] = useState('')
  const [correctionReading, setCorrectionReading] = useState('')
  const [correctionNote, setCorrectionNote] = useState('')
  const [currentExperimentId, setCurrentExperimentId] = useState<string | null>(null)
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [configToActivate, setConfigToActivate] = useState<ImageConfig | null>(null)
  const [activating, setActivating] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (selectedModelId) {
      const model = models.find(m => m.id === selectedModelId)
      setSelectedModel(model || null)
      if (model) {
        const version = versions.find(v => v.id === model.recognition_version_id) || versions.find(v => v.is_default)
        setActiveVersion(version || null)
        const baseConfig = version?.default_image_config || DEFAULT_CONFIG
        const mergedConfig = { ...baseConfig, ...(model.image_config_overrides || {}) }
        setImageConfig(mergedConfig)
        setSavedModelConfig(mergedConfig)
        loadModelExperiments(model.id)
      }
    } else {
      setSelectedModel(null)
      setActiveVersion(null)
      setImageConfig(DEFAULT_CONFIG)
      setSavedModelConfig(DEFAULT_CONFIG)
      setExperiments([])
    }
  }, [selectedModelId, models, versions])

  useEffect(() => {
    if (originalImageRef.current && canvasRef.current) applyImageProcessing()
  }, [imageConfig])

  async function loadData() {
    setLoading(true)
    try {
      const { data: modelsData } = await supabase.from('meter_models').select('*').eq('is_active', true).order('name')
      if (modelsData) setModels(modelsData)
      const { data: versionsData } = await supabase.from('recognition_versions').select('*').order('created_at', { ascending: false })
      if (versionsData) setVersions(versionsData)
    } catch (err) { console.error('Error loading data:', err) }
    setLoading(false)
  }

  async function loadModelExperiments(modelId: string) {
    const { data } = await supabase.from('labs_experiments').select('*').eq('meter_model_id', modelId).eq('experiment_type', 'meter_recognition').order('created_at', { ascending: false }).limit(50)
    if (data) setExperiments(data)
  }

  function applyImageProcessing() {
    const canvas = canvasRef.current
    const img = originalImageRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const maxDim = imageConfig.max_dimension
    let width = img.naturalWidth, height = img.naturalHeight
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height)
      width *= ratio
      height *= ratio
    }
    canvas.width = width
    canvas.height = height
    ctx.drawImage(img, 0, 0, width, height)
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2]
      if (imageConfig.grayscale) { const gray = 0.299 * r + 0.587 * g + 0.114 * b; r = g = b = gray }
      const brightness = imageConfig.brightness * 2.55
      r += brightness; g += brightness; b += brightness
      const contrast = (imageConfig.contrast + 100) / 100
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
      r = factor * (r - 128) + 128
      g = factor * (g - 128) + 128
      b = factor * (b - 128) + 128
      data[i] = Math.max(0, Math.min(255, r))
      data[i + 1] = Math.max(0, Math.min(255, g))
      data[i + 2] = Math.max(0, Math.min(255, b))
    }
    ctx.putImageData(imageData, 0, 0)
    if (imageConfig.sharpness > 0) {
      ctx.globalCompositeOperation = 'overlay'
      ctx.globalAlpha = imageConfig.sharpness / 200
      ctx.drawImage(canvas, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }
    setProcessedPhotoUrl(canvas.toDataURL('image/jpeg', imageConfig.jpeg_quality / 100))
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setTestResult(null)
    setCurrentExperimentId(null)
    const url = URL.createObjectURL(file)
    setOriginalPhotoUrl(url)
    const img = new Image()
    img.onload = () => { originalImageRef.current = img; applyImageProcessing() }
    img.src = url
  }

  function resetTest() {
    setPhotoFile(null)
    setOriginalPhotoUrl(null)
    setProcessedPhotoUrl(null)
    setTestResult(null)
    setCurrentExperimentId(null)
    originalImageRef.current = null
  }

  function updateConfig(key: keyof ImageConfig, value: any) {
    setImageConfig({ ...imageConfig, [key]: value })
  }

  function resetToOriginal() { setImageConfig({ ...NEUTRAL_CONFIG }) }
  function resetToAurora() { setImageConfig({ ...(activeVersion?.default_image_config || DEFAULT_CONFIG) }) }
  function resetToActiveConfig() { setImageConfig({ ...savedModelConfig }) }

  async function runTest() {
    if (!processedPhotoUrl || !selectedModel) return
    setTesting(true)
    setTestResult(null)
    try {
      const startTime = Date.now()
      const base64 = processedPhotoUrl.split(',')[1]
      const response = await fetch('/api/labs/test-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, model_id: selectedModel.id, image_config: imageConfig })
      })
      const result = await response.json()
      const processingTime = Date.now() - startTime
      if (response.ok) {
        setTestResult({
          success: result.success,
          serial_number: result.extracted_data?.serial_number || null,
          reading: result.extracted_data?.reading?.value || null,
          confidence: result.extracted_data?.confidence?.overall || 0,
          tokens_input: result.tokens_input || 0,
          tokens_output: result.tokens_output || 0,
          processing_time_ms: processingTime,
          raw_response: result.raw_response
        })
        setCurrentExperimentId(result.experiment_id)
        loadModelExperiments(selectedModel.id)
      } else { throw new Error(result.error || 'Test failed') }
    } catch (err: any) {
      console.error('Test error:', err)
      setTestResult({ success: false, serial_number: null, reading: null, confidence: 0, tokens_input: 0, tokens_output: 0, processing_time_ms: 0, raw_response: { error: err.message } })
    }
    setTesting(false)
  }

  async function validateTest() {
    if (!currentExperimentId) return
    await supabase.from('labs_experiments').update({ status: 'validated', validated_at: new Date().toISOString() }).eq('id', currentExperimentId)
    loadModelExperiments(selectedModel!.id)
    resetTest()
  }

  async function rejectTest() {
    if (!currentExperimentId) return
    await supabase.from('labs_experiments').update({ status: 'rejected' }).eq('id', currentExperimentId)
    loadModelExperiments(selectedModel!.id)
    resetTest()
  }

  function openCorrectionModal() {
    setCorrectionSerial(testResult?.serial_number || '')
    setCorrectionReading(testResult?.reading || '')
    setCorrectionNote('')
    setShowCorrectionModal(true)
  }

  async function submitCorrection() {
    if (!currentExperimentId) return
    await supabase.from('labs_experiments').update({
      status: 'corrected',
      corrected_data: { serial_number: correctionSerial, reading: correctionReading },
      correction_note: correctionNote,
      validated_at: new Date().toISOString()
    }).eq('id', currentExperimentId)
    setShowCorrectionModal(false)
    loadModelExperiments(selectedModel!.id)
    resetTest()
  }

  async function activateConfig() {
    if (!selectedModel || !configToActivate) return
    setActivating(true)
    try {
      const versionDefaults = activeVersion?.default_image_config || DEFAULT_CONFIG
      const overrides: Partial<ImageConfig> = {}
      Object.keys(configToActivate).forEach((key) => {
        const k = key as keyof ImageConfig
        if (configToActivate[k] !== versionDefaults[k]) { (overrides as any)[k] = configToActivate[k] }
      })
      await supabase.from('meter_models').update({ image_config_overrides: overrides }).eq('id', selectedModel.id)
      setModels(prev => prev.map(m => m.id === selectedModel.id ? { ...m, image_config_overrides: overrides as ImageConfig } : m))
      setSavedModelConfig({ ...configToActivate })
      setImageConfig({ ...configToActivate })
      setShowActivateModal(false)
      setConfigToActivate(null)
    } catch (err) { console.error('Error activating config:', err) }
    setActivating(false)
  }

  function getConfigStats(): ConfigStats[] {
    const configMap = new Map<string, LabExperiment[]>()
    experiments.forEach(exp => {
      if (!exp.image_config_used) return
      const key = getConfigKey(exp.image_config_used)
      if (!configMap.has(key)) configMap.set(key, [])
      configMap.get(key)!.push(exp)
    })
    const stats: ConfigStats[] = []
    configMap.forEach((exps, key) => {
      const config = exps[0].image_config_used
      const validated = exps.filter(e => e.status === 'validated').length
      const corrected = exps.filter(e => e.status === 'corrected').length
      const rejected = exps.filter(e => e.status === 'rejected').length
      const successCount = validated + corrected
      const totalDecided = validated + corrected + rejected
      stats.push({
        configKey: key, config, tests: exps.length, validated, corrected, rejected,
        successRate: totalDecided > 0 ? (successCount / totalDecided) * 100 : 0,
        avgConfidence: exps.length > 0 ? exps.reduce((sum, e) => sum + (e.confidence || 0), 0) / exps.length * 100 : 0,
        avgTokens: exps.length > 0 ? Math.round(exps.reduce((sum, e) => sum + (e.tokens_input || 0) + (e.tokens_output || 0), 0) / exps.length) : 0,
        isActive: configsEqual(config, savedModelConfig)
      })
    })
    stats.sort((a, b) => b.successRate !== a.successRate ? b.successRate - a.successRate : b.tests - a.tests)
    return stats
  }

  function getBestConfigSuggestion(stats: ConfigStats[]): ConfigStats | null {
    const validStats = stats.filter(s => s.tests >= 2 && (s.validated + s.corrected) >= 1)
    return validStats.length > 0 ? validStats[0] : null
  }

  const configStats = getConfigStats()
  const bestConfig = getBestConfigSuggestion(configStats)
  const modelStats = {
    total: experiments.length,
    validated: experiments.filter(e => e.status === 'validated').length,
    corrected: experiments.filter(e => e.status === 'corrected').length,
    rejected: experiments.filter(e => e.status === 'rejected').length,
  }
  const successRate = modelStats.total > 0 ? ((modelStats.validated + modelStats.corrected) / modelStats.total * 100).toFixed(1) : null

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Model selector */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <Label className="text-sm text-gray-500 mb-1 block">Modèle de compteur</Label>
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionnez un modèle..." /></SelectTrigger>
              <SelectContent>
                {models.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    <span className="flex items-center gap-2">
                      <span>{METER_TYPE_ICONS[model.meter_type] || '📊'}</span>
                      <span>{model.name}</span>
                      {model.manufacturer && <span className="text-gray-400">({model.manufacturer})</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {activeVersion && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{activeVersion.display_name}</Badge>
              <Badge variant="outline" className={activeVersion.status === 'stable' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}>{activeVersion.status}</Badge>
            </div>
          )}
          {selectedModel && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-gray-500"><Target className="h-4 w-4" /><span><strong className="text-gray-700">{modelStats.total}</strong> tests</span></div>
              {successRate && <div className="flex items-center gap-1 text-gray-500"><TrendingUp className="h-4 w-4" /><span><strong className="text-green-600">{successRate}%</strong> succès</span></div>}
            </div>
          )}
        </div>

        {selectedModel ? (
          <>
            {/* Tabs */}
            <div className="flex border-b">
              <button onClick={() => setActiveTab('test')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'test' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <FlaskConical className="h-4 w-4" />Tester
              </button>
              <button onClick={() => setActiveTab('analyze')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'analyze' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <BarChart3 className="h-4 w-4" />Analyser
              </button>
            </div>

            {activeTab === 'test' ? (
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Column 1: Photo */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4" />Photo de test</h3>
                  {originalPhotoUrl ? (
                    <div className="relative">
                      <img src={originalPhotoUrl} alt="Original" className="w-full rounded-lg border" />
                      <Badge className="absolute top-2 left-2 bg-gray-800">Original</Badge>
                      <Button variant="outline" size="icon" className="absolute top-2 right-2 bg-white/80 hover:bg-white" onClick={resetTest}><RotateCcw className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <label className="block">
                      <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50 cursor-pointer transition-colors">
                        <Upload className="h-10 w-10 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">Cliquez pour uploader</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  )}
                </Card>

                {/* Column 2: Processing */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Zap className="h-4 w-4" />Traitement d'image</h3>
                  {processedPhotoUrl ? (
                    <div className="relative mb-4">
                      <img src={processedPhotoUrl} alt="Processed" className="w-full rounded-lg border" />
                      <Badge className="absolute top-2 left-2 bg-purple-600">Traité</Badge>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed mb-4">
                      <p className="text-sm text-gray-400">Uploadez une photo</p>
                    </div>
                  )}
                  <div className="p-3 bg-gray-50 rounded-lg border text-xs mb-4">
                    <div className="flex items-center gap-1 mb-1"><Star className="h-3 w-3 text-yellow-500" /><span className="font-medium text-gray-700">Config active</span></div>
                    <div className="text-gray-500">{formatConfig(savedModelConfig)}</div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between"><Label className="text-sm">Noir & Blanc</Label><Switch checked={imageConfig.grayscale} onCheckedChange={(v) => updateConfig('grayscale', v)} /></div>
                    <div><div className="flex items-center justify-between mb-1"><Label className="text-sm">Contraste</Label><span className="text-xs text-gray-500 font-mono">{imageConfig.contrast > 0 ? '+' : ''}{imageConfig.contrast}%</span></div><input type="range" min="-50" max="100" value={imageConfig.contrast} onChange={(e) => updateConfig('contrast', parseInt(e.target.value))} className="w-full accent-purple-600" /></div>
                    <div><div className="flex items-center justify-between mb-1"><Label className="text-sm">Luminosité</Label><span className="text-xs text-gray-500 font-mono">{imageConfig.brightness > 0 ? '+' : ''}{imageConfig.brightness}%</span></div><input type="range" min="-50" max="50" value={imageConfig.brightness} onChange={(e) => updateConfig('brightness', parseInt(e.target.value))} className="w-full accent-purple-600" /></div>
                    <div><div className="flex items-center justify-between mb-1"><Label className="text-sm">Netteté</Label><span className="text-xs text-gray-500 font-mono">{imageConfig.sharpness}%</span></div><input type="range" min="0" max="100" value={imageConfig.sharpness} onChange={(e) => updateConfig('sharpness', parseInt(e.target.value))} className="w-full accent-purple-600" /></div>
                    <div className="flex items-center justify-between"><Label className="text-sm">Recadrage auto</Label><Switch checked={imageConfig.auto_crop} onCheckedChange={(v) => updateConfig('auto_crop', v)} /></div>
                    <div className="flex gap-2 pt-2">
                      <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={resetToOriginal} className="flex-1"><ImageIconLucide className="h-4 w-4 mr-1" />Original</Button></TooltipTrigger><TooltipContent>Image sans traitement</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={resetToAurora} className="flex-1"><RotateCcw className="h-4 w-4 mr-1" />Aurora</Button></TooltipTrigger><TooltipContent>Défauts Aurora</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={resetToActiveConfig} className="flex-1"><Star className="h-4 w-4 mr-1" />Active</Button></TooltipTrigger><TooltipContent>Config active</TooltipContent></Tooltip>
                    </div>
                  </div>
                </Card>

                {/* Column 3: Results */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Zap className="h-4 w-4" />Résultats</h3>
                  {processedPhotoUrl && !testResult && (
                    <Button onClick={runTest} disabled={testing} className="w-full mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                      {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Lancer l'analyse
                    </Button>
                  )}
                  {testResult && (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {testResult.success ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                          <span className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>{testResult.success ? 'Reconnu' : 'Échec'}</span>
                          <Badge variant="outline" className="ml-auto">{(testResult.confidence * 100).toFixed(0)}%</Badge>
                        </div>
                        {testResult.serial_number && <p className="text-sm"><strong>N° série:</strong> {testResult.serial_number}</p>}
                        {testResult.reading && <p className="text-sm"><strong>Index:</strong> {testResult.reading}</p>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Tokens</p><p className="font-semibold">{testResult.tokens_input + testResult.tokens_output}</p></div>
                        <div className="p-2 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Temps</p><p className="font-semibold">{testResult.processing_time_ms}ms</p></div>
                        <div className="p-2 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">Confiance</p><p className="font-semibold">{(testResult.confidence * 100).toFixed(0)}%</p></div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={validateTest} className="flex-1 bg-green-600 hover:bg-green-700"><Check className="h-4 w-4 mr-1" />Valider</Button>
                        <Button onClick={openCorrectionModal} variant="outline" className="flex-1"><Edit3 className="h-4 w-4 mr-1" />Corriger</Button>
                        <Button onClick={rejectTest} variant="outline" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"><X className="h-4 w-4 mr-1" />Rejeter</Button>
                      </div>
                      <Button onClick={resetTest} variant="ghost" className="w-full"><RotateCcw className="h-4 w-4 mr-2" />Nouveau test</Button>
                    </div>
                  )}
                  {!processedPhotoUrl && !testResult && <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Uploadez une photo pour commencer</div>}
                </Card>
              </div>
            ) : (
              /* ANALYZE TAB */
              <div className="space-y-6">
                <Card className="p-4 border-2 border-purple-200 bg-purple-50/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2"><Star className="h-5 w-5 text-yellow-500" />Config active</h3>
                      <p className="text-lg font-mono mt-1">{formatConfig(savedModelConfig)}</p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {configStats.find(s => s.isActive) && (<><p>{configStats.find(s => s.isActive)?.tests} tests</p><p className="text-green-600 font-medium">{configStats.find(s => s.isActive)?.successRate.toFixed(0)}% succès</p></>)}
                    </div>
                  </div>
                </Card>

                {bestConfig && !bestConfig.isActive && (
                  <Card className="p-4 border-2 border-blue-200 bg-blue-50/30">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900">Suggestion</h4>
                        <p className="text-sm text-blue-700 mt-1">La config <strong>{formatConfig(bestConfig.config)}</strong> a un meilleur taux de succès ({bestConfig.successRate.toFixed(0)}%) que la config active ({configStats.find(s => s.isActive)?.successRate.toFixed(0) || 0}%).</p>
                        <Button size="sm" className="mt-2 bg-blue-600 hover:bg-blue-700" onClick={() => { setConfigToActivate(bestConfig.config); setShowActivateModal(true) }}>Activer cette config</Button>
                      </div>
                    </div>
                  </Card>
                )}

                <Card className="p-4">
                  <h3 className="font-semibold mb-4">Configurations testées</h3>
                  {configStats.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b"><th className="text-left py-2 px-2">Configuration</th><th className="text-center py-2 px-2">Tests</th><th className="text-center py-2 px-2">Succès</th><th className="text-center py-2 px-2">Confiance</th><th className="text-center py-2 px-2">Tokens</th><th className="text-right py-2 px-2">Action</th></tr></thead>
                        <tbody>
                          {configStats.map((stat) => (
                            <tr key={stat.configKey} className={`border-b ${stat.isActive ? 'bg-purple-50' : ''}`}>
                              <td className="py-3 px-2"><span className="font-mono text-xs">{formatConfig(stat.config)}</span></td>
                              <td className="text-center py-3 px-2">{stat.tests}</td>
                              <td className="text-center py-3 px-2"><Badge variant="outline" className={stat.successRate >= 80 ? 'bg-green-50 text-green-700 border-green-200' : stat.successRate >= 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'}>{stat.successRate.toFixed(0)}%</Badge></td>
                              <td className="text-center py-3 px-2">{stat.avgConfidence.toFixed(0)}%</td>
                              <td className="text-center py-3 px-2">{stat.avgTokens}</td>
                              <td className="text-right py-3 px-2">
                                {stat.isActive ? <Badge className="bg-purple-600"><Star className="h-3 w-3 mr-1" />Active</Badge> : <Button size="sm" variant="outline" onClick={() => { setConfigToActivate(stat.config); setShowActivateModal(true) }}>Activer</Button>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="text-center py-8 text-gray-500"><p>Aucun test effectué.</p><p className="text-sm mt-1">Allez dans l'onglet "Tester".</p></div>}
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-4">Historique des tests récents</h3>
                  {experiments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b"><th className="text-left py-2 px-2">Date</th><th className="text-left py-2 px-2">Index</th><th className="text-center py-2 px-2">Confiance</th><th className="text-center py-2 px-2">Tokens</th><th className="text-left py-2 px-2">Config</th><th className="text-center py-2 px-2">Status</th></tr></thead>
                        <tbody>
                          {experiments.slice(0, 10).map((exp) => (
                            <tr key={exp.id} className="border-b">
                              <td className="py-2 px-2 text-gray-500">{new Date(exp.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="py-2 px-2 font-mono">{exp.corrected_data?.reading || exp.extracted_data?.reading?.value || '-'}</td>
                              <td className="text-center py-2 px-2"><Badge variant="outline" className="bg-green-50 text-green-700">{((exp.confidence || 0) * 100).toFixed(0)}%</Badge></td>
                              <td className="text-center py-2 px-2 text-gray-500">{(exp.tokens_input || 0) + (exp.tokens_output || 0)}</td>
                              <td className="py-2 px-2">{exp.image_config_used && <Badge variant="outline" className="text-xs">{exp.image_config_used.grayscale ? 'B&W' : 'Color'}{exp.image_config_used.contrast > 0 && ` +${exp.image_config_used.contrast}%`}</Badge>}</td>
                              <td className="text-center py-2 px-2"><Badge variant="outline" className={exp.status === 'validated' ? 'bg-green-50 text-green-700 border-green-200' : exp.status === 'corrected' ? 'bg-orange-50 text-orange-700 border-orange-200' : exp.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'}>{exp.status}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-center py-4 text-gray-500">Aucun test effectué</p>}
                </Card>
              </div>
            )}
          </>
        ) : <Card className="p-8 text-center"><p className="text-gray-500">Sélectionnez un modèle de compteur pour commencer</p></Card>}

        {/* Correction Modal */}
        <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Corriger le résultat</DialogTitle><DialogDescription>Entrez les valeurs correctes.</DialogDescription></DialogHeader>
            <div className="space-y-4 py-4">
              <div><Label>N° de série correct</Label><Input value={correctionSerial} onChange={(e) => setCorrectionSerial(e.target.value)} placeholder="Ex: 21042582" /></div>
              <div><Label>Index correct</Label><Input value={correctionReading} onChange={(e) => setCorrectionReading(e.target.value)} placeholder="Ex: 32453,720" /></div>
              <div><Label>Note (optionnel)</Label><Textarea value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)} placeholder="Pourquoi cette correction..." rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCorrectionModal(false)}>Annuler</Button>
              <Button onClick={submitCorrection} className="bg-purple-600 hover:bg-purple-700">Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Activate Config Modal */}
        <Dialog open={showActivateModal} onOpenChange={setShowActivateModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Activer cette configuration ?</DialogTitle><DialogDescription>Cette config sera utilisée pour toutes les futures reconnaissances.</DialogDescription></DialogHeader>
            <div className="py-4 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500 mb-1">Nouvelle config</p><p className="font-mono">{configToActivate && formatConfig(configToActivate)}</p></div>
              <div className="p-3 bg-purple-50 rounded-lg"><p className="text-sm text-gray-500 mb-1">Config actuelle</p><p className="font-mono">{formatConfig(savedModelConfig)}</p></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActivateModal(false)}>Annuler</Button>
              <Button onClick={activateConfig} disabled={activating} className="bg-purple-600 hover:bg-purple-700">{activating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}Activer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
