'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
  Upload, Play, Check, X, RotateCcw, Save, Loader2, 
  CheckCircle, XCircle, AlertCircle, Edit3, Zap, 
  ImageIcon, SlidersHorizontal, History, TrendingUp,
  Coins, Clock, Target, ChevronDown, ChevronUp
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
  meter_model?: MeterModel
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

const METER_TYPE_ICONS: Record<string, string> = {
  gas: '🔥',
  electricity: '⚡',
  water_general: '💧',
  water_passage: '🚿',
  oil_tank: '🛢️',
  calorimeter: '🌡️',
  other: '📊'
}

export default function LabsMetersPage() {
  // Data
  const [models, setModels] = useState<MeterModel[]>([])
  const [versions, setVersions] = useState<RecognitionVersion[]>([])
  const [experiments, setExperiments] = useState<LabExperiment[]>([])
  const [loading, setLoading] = useState(true)

  // Selection
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<MeterModel | null>(null)
  const [activeVersion, setActiveVersion] = useState<RecognitionVersion | null>(null)

  // Image & Config
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null)
  const [processedPhotoUrl, setProcessedPhotoUrl] = useState<string | null>(null)
  const [imageConfig, setImageConfig] = useState<ImageConfig>(DEFAULT_CONFIG)
  const [configModified, setConfigModified] = useState(false)

  // Testing
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [correctionSerial, setCorrectionSerial] = useState('')
  const [correctionReading, setCorrectionReading] = useState('')
  const [correctionNote, setCorrectionNote] = useState('')
  const [currentExperimentId, setCurrentExperimentId] = useState<string | null>(null)

  // UI
  const [savingConfig, setSavingConfig] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)

  // Load initial data
  useEffect(() => {
    loadData()
  }, [])

  // Update selected model when selection changes
  useEffect(() => {
    if (selectedModelId) {
      const model = models.find(m => m.id === selectedModelId)
      setSelectedModel(model || null)
      
      if (model) {
        // Load model's config (merged with version defaults)
        const version = versions.find(v => v.id === model.recognition_version_id) || versions.find(v => v.is_default)
        setActiveVersion(version || null)
        
        const baseConfig = version?.default_image_config || DEFAULT_CONFIG
        const mergedConfig = { ...baseConfig, ...(model.image_config_overrides || {}) }
        setImageConfig(mergedConfig)
        setConfigModified(false)
        
        // Load experiments for this model
        loadModelExperiments(model.id)
      }
    } else {
      setSelectedModel(null)
      setActiveVersion(null)
      setImageConfig(DEFAULT_CONFIG)
      setExperiments([])
    }
  }, [selectedModelId, models, versions])

  // Apply image processing when config changes
  useEffect(() => {
    if (originalImageRef.current && canvasRef.current) {
      applyImageProcessing()
    }
  }, [imageConfig])

  async function loadData() {
    setLoading(true)
    try {
      // Load meter models
      const { data: modelsData } = await supabase
        .from('meter_models')
        .select('*')
        .eq('is_active', true)
        .order('name')
      
      if (modelsData) setModels(modelsData)

      // Load recognition versions
      const { data: versionsData } = await supabase
        .from('recognition_versions')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (versionsData) setVersions(versionsData)
    } catch (err) {
      console.error('Error loading data:', err)
    }
    setLoading(false)
  }

  async function loadModelExperiments(modelId: string) {
    const { data } = await supabase
      .from('labs_experiments')
      .select('*')
      .eq('meter_model_id', modelId)
      .eq('experiment_type', 'meter_recognition')
      .order('created_at', { ascending: false })
      .limit(20)
    
    if (data) setExperiments(data)
  }

  // Image processing on canvas
  function applyImageProcessing() {
    const canvas = canvasRef.current
    const img = originalImageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const maxDim = imageConfig.max_dimension
    let width = img.naturalWidth
    let height = img.naturalHeight
    
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height)
      width *= ratio
      height *= ratio
    }
    
    canvas.width = width
    canvas.height = height

    // Draw original
    ctx.drawImage(img, 0, 0, width, height)

    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]

      // Grayscale
      if (imageConfig.grayscale) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b
        r = g = b = gray
      }

      // Brightness (-50 to +50)
      const brightness = imageConfig.brightness * 2.55
      r += brightness
      g += brightness
      b += brightness

      // Contrast (-50 to +100)
      const contrast = (imageConfig.contrast + 100) / 100
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
      r = factor * (r - 128) + 128
      g = factor * (g - 128) + 128
      b = factor * (b - 128) + 128

      // Clamp values
      data[i] = Math.max(0, Math.min(255, r))
      data[i + 1] = Math.max(0, Math.min(255, g))
      data[i + 2] = Math.max(0, Math.min(255, b))
    }

    ctx.putImageData(imageData, 0, 0)

    // Simple sharpening (unsharp mask approximation)
    if (imageConfig.sharpness > 0) {
      ctx.globalCompositeOperation = 'overlay'
      ctx.globalAlpha = imageConfig.sharpness / 200
      ctx.drawImage(canvas, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }

    // Update processed URL
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

    // Load image for processing
    const img = new Image()
    img.onload = () => {
      originalImageRef.current = img
      applyImageProcessing()
    }
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
    setImageConfig(prev => ({ ...prev, [key]: value }))
    setConfigModified(true)
  }

  async function runTest() {
    if (!processedPhotoUrl || !selectedModel) return

    setTesting(true)
    setTestResult(null)

    try {
      const startTime = Date.now()

      // Convert canvas to base64
      const base64 = processedPhotoUrl.split(',')[1]

      // Call test API
      const response = await fetch('/api/labs/test-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          model_id: selectedModel.id,
          image_config: imageConfig
        })
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

        // Refresh experiments
        loadModelExperiments(selectedModel.id)
      } else {
        throw new Error(result.error || 'Test failed')
      }
    } catch (err: any) {
      console.error('Test error:', err)
      setTestResult({
        success: false,
        serial_number: null,
        reading: null,
        confidence: 0,
        tokens_input: 0,
        tokens_output: 0,
        processing_time_ms: 0,
        raw_response: { error: err.message }
      })
    }

    setTesting(false)
  }

  async function validateTest() {
    if (!currentExperimentId) return

    await supabase
      .from('labs_experiments')
      .update({ status: 'validated', validated_at: new Date().toISOString() })
      .eq('id', currentExperimentId)

    loadModelExperiments(selectedModel!.id)
    resetTest()
  }

  async function rejectTest() {
    if (!currentExperimentId) return

    await supabase
      .from('labs_experiments')
      .update({ status: 'rejected' })
      .eq('id', currentExperimentId)

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

    await supabase
      .from('labs_experiments')
      .update({
        status: 'corrected',
        corrected_data: {
          serial_number: correctionSerial,
          reading: correctionReading
        },
        correction_note: correctionNote,
        validated_at: new Date().toISOString()
      })
      .eq('id', currentExperimentId)

    setShowCorrectionModal(false)
    loadModelExperiments(selectedModel!.id)
    resetTest()
  }

  async function saveConfigToModel() {
    if (!selectedModel) return

    setSavingConfig(true)

    try {
      // Get the difference from version defaults
      const versionDefaults = activeVersion?.default_image_config || DEFAULT_CONFIG
      const overrides: Partial<ImageConfig> = {}

      Object.keys(imageConfig).forEach((key) => {
        const k = key as keyof ImageConfig
        if (imageConfig[k] !== versionDefaults[k]) {
          (overrides as any)[k] = imageConfig[k]
        }
      })

      await supabase
        .from('meter_models')
        .update({ image_config_overrides: overrides })
        .eq('id', selectedModel.id)

      // Update local state
      setModels(prev => prev.map(m => 
        m.id === selectedModel.id 
          ? { ...m, image_config_overrides: overrides as ImageConfig }
          : m
      ))

      setConfigModified(false)
    } catch (err) {
      console.error('Error saving config:', err)
    }

    setSavingConfig(false)
  }

  function resetConfigToDefaults() {
    const versionDefaults = activeVersion?.default_image_config || DEFAULT_CONFIG
    setImageConfig(versionDefaults)
    setConfigModified(true)
    
    if (originalImageRef.current) {
      applyImageProcessing()
    }
  }

  // Stats for selected model
  const modelStats = {
    total: experiments.length,
    validated: experiments.filter(e => e.status === 'validated').length,
    corrected: experiments.filter(e => e.status === 'corrected').length,
    rejected: experiments.filter(e => e.status === 'rejected').length,
    avgConfidence: experiments.length > 0 
      ? (experiments.reduce((sum, e) => sum + (e.confidence || 0), 0) / experiments.length * 100).toFixed(1)
      : 0,
    avgTokens: experiments.length > 0
      ? Math.round(experiments.reduce((sum, e) => sum + (e.tokens_input || 0) + (e.tokens_output || 0), 0) / experiments.length)
      : 0
  }

  const successRate = modelStats.total > 0 
    ? ((modelStats.validated + modelStats.corrected) / modelStats.total * 100).toFixed(1)
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Top bar: Model selector + Version */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <Label className="text-sm text-gray-500 mb-1 block">Modèle de compteur</Label>
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionnez un modèle..." />
              </SelectTrigger>
              <SelectContent>
                {models.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    <span className="flex items-center gap-2">
                      <span>{METER_TYPE_ICONS[model.meter_type] || '📊'}</span>
                      <span>{model.name}</span>
                      {model.manufacturer && (
                        <span className="text-gray-400">({model.manufacturer})</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeVersion && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                {activeVersion.display_name}
              </Badge>
              <Badge 
                variant="outline" 
                className={
                  activeVersion.status === 'stable' 
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                }
              >
                {activeVersion.status}
              </Badge>
            </div>
          )}

          {selectedModel && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-gray-500">
                <Target className="h-4 w-4" />
                <span><strong className="text-gray-700">{modelStats.total}</strong> tests</span>
              </div>
              {successRate && (
                <div className="flex items-center gap-1 text-gray-500">
                  <TrendingUp className="h-4 w-4" />
                  <span><strong className="text-green-600">{successRate}%</strong> succès</span>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedModel ? (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Column 1: Upload & Original */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Photo de test
              </h3>

              {originalPhotoUrl ? (
                <div className="space-y-3">
                  <div className="relative">
                    <img 
                      src={originalPhotoUrl} 
                      alt="Original" 
                      className="w-full rounded-lg border"
                    />
                    <Badge className="absolute top-2 left-2 bg-gray-800/80">Original</Badge>
                    <button 
                      onClick={resetTest}
                      className="absolute top-2 right-2 p-1.5 bg-gray-800/80 text-white rounded-full hover:bg-gray-700"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Hidden canvas for processing */}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors">
                  <Upload className="h-10 w-10 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Cliquez ou glissez une photo</span>
                  <span className="text-xs text-gray-400 mt-1">JPG, PNG jusqu'à 10MB</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                    className="hidden" 
                  />
                </label>
              )}

              {/* Model reference photo */}
              {selectedModel.reference_photos?.[0] && !originalPhotoUrl && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500 mb-2">Photo de référence du modèle :</p>
                  <img 
                    src={selectedModel.reference_photos[0]} 
                    alt="Reference" 
                    className="w-full rounded-lg border opacity-60"
                  />
                </div>
              )}
            </Card>

            {/* Column 2: Processing & Controls */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Traitement d'image
              </h3>

              {processedPhotoUrl ? (
                <div className="relative mb-4">
                  <img 
                    src={processedPhotoUrl} 
                    alt="Processed" 
                    className="w-full rounded-lg border"
                  />
                  <Badge className="absolute top-2 left-2 bg-purple-600">Traité</Badge>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed mb-4">
                  <p className="text-sm text-gray-400">Uploadez une photo pour voir le traitement</p>
                </div>
              )}

              {/* Sliders */}
              <div className="space-y-4">
                {/* Grayscale toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Noir & Blanc</Label>
                  <Switch 
                    checked={imageConfig.grayscale}
                    onCheckedChange={(v) => updateConfig('grayscale', v)}
                  />
                </div>

                {/* Contrast */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm">Contraste</Label>
                    <span className="text-xs text-gray-500 font-mono">
                      {imageConfig.contrast > 0 ? '+' : ''}{imageConfig.contrast}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="-50" 
                    max="100" 
                    value={imageConfig.contrast}
                    onChange={(e) => updateConfig('contrast', parseInt(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                </div>

                {/* Brightness */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm">Luminosité</Label>
                    <span className="text-xs text-gray-500 font-mono">
                      {imageConfig.brightness > 0 ? '+' : ''}{imageConfig.brightness}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="-50" 
                    max="50" 
                    value={imageConfig.brightness}
                    onChange={(e) => updateConfig('brightness', parseInt(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                </div>

                {/* Sharpness */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-sm">Netteté</Label>
                    <span className="text-xs text-gray-500 font-mono">{imageConfig.sharpness}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={imageConfig.sharpness}
                    onChange={(e) => updateConfig('sharpness', parseInt(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                </div>

                {/* Auto crop toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Recadrage auto</Label>
                  <Switch 
                    checked={imageConfig.auto_crop}
                    onCheckedChange={(v) => updateConfig('auto_crop', v)}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={resetConfigToDefaults}
                    className="flex-1"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Défaut
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={saveConfigToModel}
                    disabled={!configModified || savingConfig}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {savingConfig ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Sauver
                  </Button>
                </div>

                {configModified && (
                  <p className="text-xs text-orange-600 text-center">
                    ⚠️ Config modifiée - non sauvegardée
                  </p>
                )}
              </div>
            </Card>

            {/* Column 3: Results */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Résultats
              </h3>

              {processedPhotoUrl && !testResult && (
                <Button 
                  onClick={runTest} 
                  disabled={testing}
                  className="w-full mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Lancer l'analyse
                </Button>
              )}

              {testResult && (
                <div className="space-y-4">
                  {/* Status */}
                  <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {testResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                        {testResult.success ? 'Reconnu' : 'Échec'}
                      </span>
                      <Badge variant="outline" className="ml-auto">
                        {(testResult.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>

                    {testResult.serial_number && (
                      <p className="text-sm">
                        N° série: <span className="font-mono font-medium">{testResult.serial_number}</span>
                      </p>
                    )}
                    {testResult.reading && (
                      <p className="text-sm">
                        Index: <span className="font-mono font-medium">{testResult.reading}</span>
                      </p>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <Coins className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                      <p className="text-xs text-gray-500">Tokens</p>
                      <p className="font-mono text-sm">{testResult.tokens_input + testResult.tokens_output}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <Clock className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                      <p className="text-xs text-gray-500">Temps</p>
                      <p className="font-mono text-sm">{testResult.processing_time_ms}ms</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <Target className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                      <p className="text-xs text-gray-500">Confiance</p>
                      <p className="font-mono text-sm">{(testResult.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button onClick={validateTest} size="sm" className="bg-green-600 hover:bg-green-700">
                      <Check className="h-4 w-4 mr-1" />
                      Valider
                    </Button>
                    <Button onClick={openCorrectionModal} size="sm" variant="outline">
                      <Edit3 className="h-4 w-4 mr-1" />
                      Corriger
                    </Button>
                    <Button onClick={rejectTest} size="sm" variant="outline" className="text-red-600 hover:bg-red-50">
                      <X className="h-4 w-4 mr-1" />
                      Rejeter
                    </Button>
                  </div>

                  <Button onClick={resetTest} variant="ghost" size="sm" className="w-full">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Nouveau test
                  </Button>
                </div>
              )}

              {!processedPhotoUrl && !testResult && (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm text-center">
                  <div>
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Uploadez une photo et lancez l'analyse pour voir les résultats</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <SlidersHorizontal className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Sélectionnez un modèle</h3>
              <p className="text-gray-500">
                Choisissez un modèle de compteur dans la liste ci-dessus pour commencer à tester 
                et optimiser les paramètres de reconnaissance.
              </p>
            </div>
          </Card>
        )}

        {/* History */}
        {selectedModel && experiments.length > 0 && (
          <Card className="p-4">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between mb-3"
            >
              <h3 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4" />
                Historique des tests ({experiments.length})
              </h3>
              {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showHistory && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium text-gray-500">Date</th>
                      <th className="pb-2 font-medium text-gray-500">Index</th>
                      <th className="pb-2 font-medium text-gray-500">Confiance</th>
                      <th className="pb-2 font-medium text-gray-500">Tokens</th>
                      <th className="pb-2 font-medium text-gray-500">Config</th>
                      <th className="pb-2 font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {experiments.map(exp => (
                      <tr key={exp.id} className="border-b last:border-0">
                        <td className="py-2 text-gray-600">
                          {new Date(exp.created_at).toLocaleDateString('fr-BE', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-2 font-mono">
                          {exp.status === 'corrected' && exp.corrected_data?.reading ? (
                            <span className="text-green-600">{exp.corrected_data.reading}</span>
                          ) : (
                            exp.extracted_data?.reading?.value || '-'
                          )}
                        </td>
                        <td className="py-2">
                          <Badge variant="outline" className={
                            (exp.confidence || 0) >= 0.8 ? 'bg-green-50 text-green-700' :
                            (exp.confidence || 0) >= 0.5 ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                          }>
                            {((exp.confidence || 0) * 100).toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="py-2 font-mono text-gray-500">
                          {(exp.tokens_input || 0) + (exp.tokens_output || 0)}
                        </td>
                        <td className="py-2">
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs">
                                {exp.image_config_used?.grayscale ? 'B&W' : 'Color'}
                                {exp.image_config_used?.contrast ? ` +${exp.image_config_used.contrast}%` : ''}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <pre className="text-xs">
                                {JSON.stringify(exp.image_config_used, null, 2)}
                              </pre>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="py-2">
                          <Badge className={
                            exp.status === 'validated' ? 'bg-green-100 text-green-700' :
                            exp.status === 'corrected' ? 'bg-orange-100 text-orange-700' :
                            exp.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }>
                            {exp.status === 'validated' && <Check className="h-3 w-3 mr-1" />}
                            {exp.status === 'corrected' && <Edit3 className="h-3 w-3 mr-1" />}
                            {exp.status === 'rejected' && <X className="h-3 w-3 mr-1" />}
                            {exp.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Correction Modal */}
        <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-orange-500" />
                Corriger le résultat
              </DialogTitle>
              <DialogDescription>
                Indiquez les valeurs correctes pour améliorer le modèle.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm">N° série lu</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input 
                    value={testResult?.serial_number || ''} 
                    disabled 
                    className="bg-gray-100 font-mono flex-1" 
                  />
                  <span className="text-gray-400">→</span>
                  <Input 
                    value={correctionSerial}
                    onChange={(e) => setCorrectionSerial(e.target.value)}
                    placeholder="Valeur correcte"
                    className="font-mono flex-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm">Index lu</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input 
                    value={testResult?.reading || ''} 
                    disabled 
                    className="bg-gray-100 font-mono flex-1" 
                  />
                  <span className="text-gray-400">→</span>
                  <Input 
                    value={correctionReading}
                    onChange={(e) => setCorrectionReading(e.target.value)}
                    placeholder="Valeur correcte"
                    className="font-mono flex-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm">Note (optionnel)</Label>
                <Textarea 
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="Ex: Décimales mal placées, reflet sur l'écran..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCorrectionModal(false)}>
                Annuler
              </Button>
              <Button onClick={submitCorrection} className="bg-orange-500 hover:bg-orange-600">
                <Check className="h-4 w-4 mr-1" />
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
