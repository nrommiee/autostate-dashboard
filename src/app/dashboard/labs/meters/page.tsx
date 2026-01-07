'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  Upload, Play, Check, X, RotateCcw, Loader2, CheckCircle, XCircle, Edit3, Zap, 
  ImageIcon, TrendingUp, FlaskConical, BarChart3, Target, Star, Lightbulb, 
  Image as ImageIconLucide, Rocket, DollarSign, AlertTriangle, Camera,
  Sun, Aperture, Clock, Smartphone, MapPin, Activity, History, FileText,
  CheckCircle2, AlertCircle, Pencil, FolderInput, Trash2, ArrowRight, Plus, Gauge
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { 
  extractExifData, analyzeImage, getQualityPrediction, calculateCost, formatCost,
  type ExifData, type ImageAnalysis, type QualityPrediction 
} from '@/lib/image-analysis'

// Types
interface MeterModel {
  id: string; name: string; manufacturer: string | null; meter_type: string
  unit: string; recognition_version_id: string | null
  image_config_overrides: ImageConfig; reference_photos: string[]
  status: 'draft' | 'active' | 'archived'; ai_description: string | null
}

interface RecognitionVersion {
  id: string; codename: string; version_number: string; display_name: string
  status: string; is_default: boolean; default_image_config: ImageConfig
}

interface ImageConfig {
  grayscale: boolean; contrast: number; brightness: number; sharpness: number
  auto_crop: boolean; max_dimension: number; jpeg_quality: number
}

interface TestResult {
  success: boolean; serial_number: string | null; reading: string | null
  confidence: number; tokens_input: number; tokens_output: number
  processing_time_ms: number; raw_response: any
}

interface LabExperiment {
  id: string; meter_model_id: string; status: string; extracted_data: any
  confidence: number; tokens_input: number; tokens_output: number
  processing_time_ms: number; image_config_used: ImageConfig
  created_at: string; corrected_data: any
  exif_data?: ExifData; image_analysis?: ImageAnalysis
  cost_input?: number; cost_output?: number
}

interface ConfigHistory {
  id: string; meter_model_id: string; image_config: ImageConfig
  activated_at: string; deactivated_at: string | null; activated_by: string | null
  tests_count: number; success_rate: number; avg_confidence: number; notes: string | null
}

interface ConfigStats {
  configKey: string; config: ImageConfig; tests: number
  validated: number; corrected: number; rejected: number
  successRate: number; avgConfidence: number; avgTokens: number
  totalCost: number; isActive: boolean
}

interface AIPricing { cost_per_1m_input: number; cost_per_1m_output: number }

const DEFAULT_CONFIG: ImageConfig = {
  grayscale: true, contrast: 30, brightness: 0, sharpness: 20,
  auto_crop: true, max_dimension: 1024, jpeg_quality: 85
}

const NEUTRAL_CONFIG: ImageConfig = {
  grayscale: false, contrast: 0, brightness: 0, sharpness: 0,
  auto_crop: false, max_dimension: 1024, jpeg_quality: 85
}

const METER_TYPE_ICONS: Record<string, string> = {
  gas: '🔥', electricity: '⚡', water_general: '💧', water_passage: '🚿',
  oil_tank: '🛢️', calorimeter: '🌡️', other: '📊'
}

function getConfigKey(c: ImageConfig): string {
  return `${c.grayscale?'bw':'color'}_c${c.contrast}_b${c.brightness}_s${c.sharpness}_ac${c.auto_crop}`
}

function formatConfig(c: ImageConfig): string {
  const p = [c.grayscale ? 'N&B' : 'Couleur']
  if (c.contrast !== 0) p.push(`C:${c.contrast > 0 ? '+' : ''}${c.contrast}%`)
  if (c.brightness !== 0) p.push(`L:${c.brightness > 0 ? '+' : ''}${c.brightness}%`)
  if (c.sharpness !== 0) p.push(`N:${c.sharpness}%`)
  return p.join(' • ')
}

function configsEqual(a: ImageConfig, b: ImageConfig): boolean {
  return a.grayscale === b.grayscale && a.contrast === b.contrast &&
    a.brightness === b.brightness && a.sharpness === b.sharpness && a.auto_crop === b.auto_crop
}

export default function LabsMetersPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // State
  const [models, setModels] = useState<MeterModel[]>([])
  const [versions, setVersions] = useState<RecognitionVersion[]>([])
  const [experiments, setExperiments] = useState<LabExperiment[]>([])
  const [configHistory, setConfigHistory] = useState<ConfigHistory[]>([])
  const [pricing, setPricing] = useState<AIPricing>({ cost_per_1m_input: 3.00, cost_per_1m_output: 15.00 })
  const [loading, setLoading] = useState(true)
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<MeterModel | null>(null)
  const [activeVersion, setActiveVersion] = useState<RecognitionVersion | null>(null)
  const [activeTab, setActiveTab] = useState<'import' | 'test' | 'analyze' | 'production'>('import')
  
  // Import & Tri
  const [importedPhotos, setImportedPhotos] = useState<File[]>([])
  const [classifiedPhotos, setClassifiedPhotos] = useState<{
    modelId: string | null
    modelName: string | null
    photos: { file: File; url: string }[]
  }[]>([])
  const [classifying, setClassifying] = useState(false)
  
  // Prompt editing
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)
  
  // Model activation
  const [showActivateModelModal, setShowActivateModelModal] = useState(false)
  const [activatingModel, setActivatingModel] = useState(false)
  
  // Test tab
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null)
  const [processedPhotoUrl, setProcessedPhotoUrl] = useState<string | null>(null)
  const [imageConfig, setImageConfig] = useState<ImageConfig>(DEFAULT_CONFIG)
  const [savedModelConfig, setSavedModelConfig] = useState<ImageConfig>(DEFAULT_CONFIG)
  const [exifData, setExifData] = useState<ExifData | null>(null)
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null)
  const [qualityPrediction, setQualityPrediction] = useState<QualityPrediction | null>(null)
  const [analyzingImage, setAnalyzingImage] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [currentExperimentId, setCurrentExperimentId] = useState<string | null>(null)
  
  // Modals
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [correctionSerial, setCorrectionSerial] = useState('')
  const [correctionReading, setCorrectionReading] = useState('')
  const [correctionNote, setCorrectionNote] = useState('')
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [configToActivate, setConfigToActivate] = useState<ImageConfig | null>(null)
  const [activating, setActivating] = useState(false)
  const [activationNotes, setActivationNotes] = useState('')
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)

  // Effects
  useEffect(() => { loadData() }, [])

  // Auto-select model from URL parameter
  useEffect(() => {
    const modelId = searchParams.get('model')
    if (modelId && models.length > 0 && !selectedModelId) {
      const modelExists = models.find(m => m.id === modelId)
      if (modelExists) {
        setSelectedModelId(modelId)
      }
    }
  }, [searchParams, models, selectedModelId])

  useEffect(() => {
    if (selectedModelId) {
      const model = models.find(m => m.id === selectedModelId)
      setSelectedModel(model || null)
      if (model) {
        setActiveTab('test') // Switch to test tab when model selected
        const version = versions.find(v => v.id === model.recognition_version_id) || versions.find(v => v.is_default)
        setActiveVersion(version || null)
        const baseConfig = version?.default_image_config || DEFAULT_CONFIG
        const mergedConfig = { ...baseConfig, ...(model.image_config_overrides || {}) }
        setImageConfig(mergedConfig)
        setSavedModelConfig(mergedConfig)
        loadModelExperiments(model.id)
        loadConfigHistory(model.id)
      }
    } else {
      setSelectedModel(null); setActiveVersion(null)
      setImageConfig(DEFAULT_CONFIG); setSavedModelConfig(DEFAULT_CONFIG)
      setExperiments([]); setConfigHistory([])
    }
  }, [selectedModelId, models, versions])

  useEffect(() => {
    if (originalImageRef.current && canvasRef.current) applyImageProcessing()
  }, [imageConfig])

  // Data loading
  async function loadData() {
    setLoading(true)
    try {
      const [modelsRes, versionsRes, pricingRes] = await Promise.all([
        supabase.from('meter_models').select('*').order('name'),
        supabase.from('recognition_versions').select('*').order('created_at', { ascending: false }),
        supabase.from('ai_pricing').select('*').eq('provider', 'anthropic').is('effective_until', null).limit(1)
      ])
      if (modelsRes.data) setModels(modelsRes.data)
      if (versionsRes.data) setVersions(versionsRes.data)
      if (pricingRes.data && pricingRes.data[0]) {
        setPricing({ cost_per_1m_input: pricingRes.data[0].cost_per_1m_input, cost_per_1m_output: pricingRes.data[0].cost_per_1m_output })
      }
    } catch (err) { console.error('Error:', err) }
    setLoading(false)
  }

  async function loadModelExperiments(modelId: string) {
    const { data } = await supabase.from('labs_experiments').select('*')
      .eq('meter_model_id', modelId).eq('experiment_type', 'meter_recognition')
      .order('created_at', { ascending: false }).limit(100)
    if (data) setExperiments(data)
  }

  async function loadConfigHistory(modelId: string) {
    const { data } = await supabase.from('meter_config_history').select('*')
      .eq('meter_model_id', modelId).order('activated_at', { ascending: false }).limit(20)
    if (data) setConfigHistory(data)
  }

  // Image processing
  function applyImageProcessing() {
    const canvas = canvasRef.current, img = originalImageRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const maxDim = imageConfig.max_dimension
    let w = img.naturalWidth, h = img.naturalHeight
    if (w > maxDim || h > maxDim) { const r = Math.min(maxDim/w, maxDim/h); w *= r; h *= r }
    canvas.width = w; canvas.height = h
    ctx.drawImage(img, 0, 0, w, h)
    const imageData = ctx.getImageData(0, 0, w, h), d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i+1], b = d[i+2]
      if (imageConfig.grayscale) { const gray = 0.299*r + 0.587*g + 0.114*b; r = g = b = gray }
      const br = imageConfig.brightness * 2.55; r += br; g += br; b += br
      const ct = (imageConfig.contrast + 100) / 100
      const f = (259 * (ct * 255 + 255)) / (255 * (259 - ct * 255))
      r = f * (r - 128) + 128; g = f * (g - 128) + 128; b = f * (b - 128) + 128
      d[i] = Math.max(0, Math.min(255, r))
      d[i+1] = Math.max(0, Math.min(255, g))
      d[i+2] = Math.max(0, Math.min(255, b))
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file); setTestResult(null); setCurrentExperimentId(null); setAnalyzingImage(true)
    const exif = await extractExifData(file)
    setExifData(exif)
    const url = URL.createObjectURL(file)
    setOriginalPhotoUrl(url)
    const img = new Image()
    img.onload = async () => {
      originalImageRef.current = img
      applyImageProcessing()
      const analysis = await analyzeImage(img)
      setImageAnalysis(analysis)
      setQualityPrediction(getQualityPrediction(analysis, exif))
      setAnalyzingImage(false)
    }
    img.src = url
  }

  function resetTest() {
    setPhotoFile(null); setOriginalPhotoUrl(null); setProcessedPhotoUrl(null)
    setTestResult(null); setCurrentExperimentId(null)
    setExifData(null); setImageAnalysis(null); setQualityPrediction(null)
    originalImageRef.current = null
  }

  function updateConfig(key: keyof ImageConfig, value: any) { setImageConfig({ ...imageConfig, [key]: value }) }
  function resetToOriginal() { setImageConfig({ ...NEUTRAL_CONFIG }) }
  function resetToAurora() { setImageConfig({ ...(activeVersion?.default_image_config || DEFAULT_CONFIG) }) }
  function resetToActiveConfig() { setImageConfig({ ...savedModelConfig }) }

  async function runTest() {
    if (!processedPhotoUrl || !selectedModel) return
    setTesting(true); setTestResult(null)
    try {
      const startTime = Date.now()
      const base64 = processedPhotoUrl.split(',')[1]
      const response = await fetch('/api/labs/test-meter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, model_id: selectedModel.id, image_config: imageConfig, exif_data: exifData, image_analysis: imageAnalysis })
      })
      const result = await response.json()
      if (response.ok) {
        setTestResult({
          success: result.success,
          serial_number: result.extracted_data?.serial_number || null,
          reading: result.extracted_data?.reading?.value || null,
          confidence: result.extracted_data?.confidence?.overall || 0,
          tokens_input: result.tokens_input || 0,
          tokens_output: result.tokens_output || 0,
          processing_time_ms: Date.now() - startTime,
          raw_response: result.raw_response
        })
        setCurrentExperimentId(result.experiment_id)
        loadModelExperiments(selectedModel.id)
      } else throw new Error(result.error)
    } catch (err: any) {
      setTestResult({ success: false, serial_number: null, reading: null, confidence: 0, tokens_input: 0, tokens_output: 0, processing_time_ms: 0, raw_response: { error: err.message } })
    }
    setTesting(false)
  }

  async function validateTest() {
    if (!currentExperimentId) return
    await supabase.from('labs_experiments').update({ status: 'validated', validated_at: new Date().toISOString() }).eq('id', currentExperimentId)
    loadModelExperiments(selectedModel!.id); resetTest()
  }

  async function rejectTest() {
    if (!currentExperimentId) return
    await supabase.from('labs_experiments').update({ status: 'rejected' }).eq('id', currentExperimentId)
    loadModelExperiments(selectedModel!.id); resetTest()
  }

  async function submitCorrection() {
    if (!currentExperimentId) return
    await supabase.from('labs_experiments').update({
      status: 'corrected', corrected_data: { serial_number: correctionSerial, reading: correctionReading },
      correction_note: correctionNote, validated_at: new Date().toISOString()
    }).eq('id', currentExperimentId)
    setShowCorrectionModal(false); loadModelExperiments(selectedModel!.id); resetTest()
  }

  async function activateConfig() {
    if (!selectedModel || !configToActivate) return
    setActivating(true)
    try {
      const versionDefaults = activeVersion?.default_image_config || DEFAULT_CONFIG
      const overrides: Partial<ImageConfig> = {}
      Object.keys(configToActivate).forEach((key) => {
        const k = key as keyof ImageConfig
        if (configToActivate[k] !== versionDefaults[k]) (overrides as any)[k] = configToActivate[k]
      })
      await supabase.from('meter_models').update({ image_config_overrides: overrides }).eq('id', selectedModel.id)
      setModels(prev => prev.map(m => m.id === selectedModel.id ? { ...m, image_config_overrides: overrides as ImageConfig } : m))
      setSavedModelConfig({ ...configToActivate }); setImageConfig({ ...configToActivate })
      setShowActivateModal(false); setConfigToActivate(null); setActivationNotes('')
      loadConfigHistory(selectedModel.id)
    } catch (err) { console.error('Error:', err) }
    setActivating(false)
  }

  async function savePrompt() {
    if (!selectedModel) return
    setSavingPrompt(true)
    try {
      await supabase.from('meter_models').update({ ai_description: editedPrompt }).eq('id', selectedModel.id)
      setModels(prev => prev.map(m => m.id === selectedModel.id ? { ...m, ai_description: editedPrompt } : m))
      setSelectedModel({ ...selectedModel, ai_description: editedPrompt })
      setShowPromptModal(false)
    } catch (err) { console.error('Error:', err) }
    setSavingPrompt(false)
  }

  async function activateModel() {
    if (!selectedModel) return
    setActivatingModel(true)
    try {
      await supabase.from('meter_models').update({ status: 'active' }).eq('id', selectedModel.id)
      setModels(prev => prev.map(m => m.id === selectedModel.id ? { ...m, status: 'active' as const } : m))
      setSelectedModel({ ...selectedModel, status: 'active' })
      setShowActivateModelModal(false)
    } catch (err) { console.error('Error:', err) }
    setActivatingModel(false)
  }

  // Bulk photo import and classification
  async function handleBulkPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    setImportedPhotos(files)
    setClassifying(true)
    setClassifiedPhotos([])
    
    try {
      // Group photos by detected model
      const groups = new Map<string | null, { file: File; url: string }[]>()
      
      for (const file of files) {
        const url = URL.createObjectURL(file)
        const base64 = await fileToBase64(file)
        
        // Call API to detect meter type
        const response = await fetch('/api/analyze-meter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: base64 })
        })
        
        let matchedModelId: string | null = null
        let matchedModelName: string | null = null
        
        if (response.ok) {
          const result = await response.json()
          if (result.matchedModel) {
            matchedModelId = result.matchedModel.id
            matchedModelName = result.matchedModel.name
          }
        }
        
        const key = matchedModelId || 'unrecognized'
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push({ file, url })
        
        // Update state incrementally
        const currentGroups: typeof classifiedPhotos = []
        groups.forEach((photos, modelId) => {
          const model = models.find(m => m.id === modelId)
          currentGroups.push({
            modelId: modelId === 'unrecognized' ? null : modelId,
            modelName: model?.name || null,
            photos
          })
        })
        setClassifiedPhotos(currentGroups)
      }
    } catch (err) {
      console.error('Classification error:', err)
    }
    
    setClassifying(false)
  }

  function removeClassifiedGroup(index: number) {
    setClassifiedPhotos(prev => {
      const newGroups = [...prev]
      // Revoke URLs
      newGroups[index].photos.forEach(p => URL.revokeObjectURL(p.url))
      newGroups.splice(index, 1)
      return newGroups
    })
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve((reader.result as string).split(',')[1])
      reader.readAsDataURL(file)
    })
  }

  // Stats
  function getConfigStats(): ConfigStats[] {
    const map = new Map<string, LabExperiment[]>()
    experiments.forEach(exp => {
      if (!exp.image_config_used) return
      const key = getConfigKey(exp.image_config_used)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(exp)
    })
    const stats: ConfigStats[] = []
    map.forEach((exps, key) => {
      const config = exps[0].image_config_used
      const validated = exps.filter(e => e.status === 'validated').length
      const corrected = exps.filter(e => e.status === 'corrected').length
      const rejected = exps.filter(e => e.status === 'rejected').length
      const decided = validated + corrected + rejected
      const cost = exps.reduce((s, e) => s + (e.cost_input || 0) + (e.cost_output || 0), 0)
      stats.push({
        configKey: key, config, tests: exps.length, validated, corrected, rejected,
        successRate: decided > 0 ? ((validated + corrected) / decided) * 100 : 0,
        avgConfidence: exps.length > 0 ? exps.reduce((s, e) => s + (e.confidence || 0), 0) / exps.length * 100 : 0,
        avgTokens: exps.length > 0 ? Math.round(exps.reduce((s, e) => s + (e.tokens_input || 0) + (e.tokens_output || 0), 0) / exps.length) : 0,
        totalCost: cost, isActive: configsEqual(config, savedModelConfig)
      })
    })
    stats.sort((a, b) => b.successRate !== a.successRate ? b.successRate - a.successRate : b.tests - a.tests)
    return stats
  }

  const configStats = getConfigStats()
  const bestConfig = configStats.find(s => s.tests >= 2 && (s.validated + s.corrected) >= 1 && !s.isActive)
  const modelStats = {
    total: experiments.length,
    validated: experiments.filter(e => e.status === 'validated').length,
    corrected: experiments.filter(e => e.status === 'corrected').length,
    rejected: experiments.filter(e => e.status === 'rejected').length,
    totalCost: experiments.reduce((s, e) => s + (e.cost_input || 0) + (e.cost_output || 0), 0),
    totalTokens: experiments.reduce((s, e) => s + (e.tokens_input || 0) + (e.tokens_output || 0), 0)
  }
  const successRate = modelStats.total > 0 ? ((modelStats.validated + modelStats.corrected) / modelStats.total * 100).toFixed(1) : null
  const testCost = testResult ? calculateCost(testResult.tokens_input, testResult.tokens_output, pricing) : null

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <Label className="text-sm text-gray-500 mb-1 block">Modèle de compteur</Label>
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger><SelectValue placeholder="Sélectionnez un modèle..." /></SelectTrigger>
              <SelectContent>
                {models.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <span>{METER_TYPE_ICONS[m.meter_type] || '📊'}</span>
                      <span>{m.name}</span>
                      {m.manufacturer && <span className="text-gray-400">({m.manufacturer})</span>}
                      {m.status === 'draft' && <Badge variant="outline" className="ml-2 text-xs bg-yellow-50 text-yellow-700">Brouillon</Badge>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedModel && (
            <div className="flex items-center gap-2">
              {selectedModel.status === 'draft' ? (
                <Badge className="bg-yellow-500 text-white"><AlertCircle className="h-3 w-3 mr-1" />Brouillon</Badge>
              ) : selectedModel.status === 'active' ? (
                <Badge className="bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Actif</Badge>
              ) : (
                <Badge variant="outline" className="text-gray-500">Archivé</Badge>
              )}
            </div>
          )}
          {activeVersion && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-purple-50 text-purple-700">{activeVersion.display_name}</Badge>
              <Badge variant="outline" className={activeVersion.status === 'stable' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}>{activeVersion.status}</Badge>
            </div>
          )}
          {selectedModel && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500"><Target className="h-4 w-4 inline mr-1" /><strong>{modelStats.total}</strong> tests</span>
              {successRate && <span className="text-green-600"><TrendingUp className="h-4 w-4 inline mr-1" /><strong>{successRate}%</strong></span>}
              {modelStats.totalCost > 0 && <span className="text-gray-500"><DollarSign className="h-4 w-4 inline mr-1" /><strong>{formatCost(modelStats.totalCost)}</strong></span>}
            </div>
          )}
        </div>

        {/* Prompt section - only for selected model */}
        {selectedModel && (
          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />
                  Prompt de reconnaissance
                  {selectedModel.status === 'draft' && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Modifiable</Badge>
                  )}
                </h3>
                <div className="p-3 bg-gray-50 rounded-lg text-sm font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {selectedModel.ai_description || 'Aucun prompt défini'}
                </div>
              </div>
              {selectedModel.status === 'draft' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-4"
                  onClick={() => { setEditedPrompt(selectedModel.ai_description || ''); setShowPromptModal(true) }}
                >
                  <Pencil className="h-4 w-4 mr-1" />Modifier
                </Button>
              )}
            </div>
            
            {/* Activate model button for drafts */}
            {selectedModel.status === 'draft' && modelStats.total >= 1 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Ce modèle est en brouillon et n'est pas utilisable dans l'app.</p>
                    <p className="text-xs text-gray-500 mt-1">Activez-le pour le rendre disponible au scan.</p>
                  </div>
                  <Button onClick={() => setShowActivateModelModal(true)} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-4 w-4 mr-2" />Activer ce modèle
                  </Button>
                </div>
              </div>
            )}
            {selectedModel.status === 'draft' && modelStats.total === 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-3 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Effectuez au moins un test avant d'activer ce modèle.</span>
                </div>
              </div>
            )}
          </Card>
        )}

        {selectedModel ? (
          <>
            {/* Tabs - sans Import quand modèle sélectionné */}
            <div className="flex border-b">
              <button onClick={() => setActiveTab('test')} className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'test' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}>
                <FlaskConical className="h-4 w-4" />Tester
              </button>
              <button onClick={() => setActiveTab('analyze')} className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'analyze' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}>
                <BarChart3 className="h-4 w-4" />Analyser
              </button>
              {selectedModel.status === 'active' && (
                <button onClick={() => setActiveTab('production')} className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'production' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}>
                  <Rocket className="h-4 w-4" />Production
                </button>
              )}
            </div>

            {/* TEST TAB */}
            {activeTab === 'test' && (
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Photo column */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4" />Photo de test</h3>
                  {originalPhotoUrl ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <img src={originalPhotoUrl} alt="Original" className="w-full rounded-lg border" />
                        <Badge className="absolute top-2 left-2 bg-gray-800">Original</Badge>
                        <Button variant="outline" size="icon" className="absolute top-2 right-2 bg-white/80" onClick={resetTest}><RotateCcw className="h-4 w-4" /></Button>
                      </div>
                      {exifData && Object.keys(exifData).length > 0 && (
                        <div className="p-3 bg-blue-50 rounded-lg text-xs">
                          <p className="font-medium text-blue-800 flex items-center gap-1 mb-1"><Camera className="h-3 w-3" />Métadonnées EXIF</p>
                          <div className="grid grid-cols-2 gap-1 text-blue-700">
                            {exifData.iso && <span><Sun className="h-3 w-3 inline" /> ISO: {exifData.iso}</span>}
                            {exifData.aperture && <span><Aperture className="h-3 w-3 inline" /> {exifData.aperture}</span>}
                            {exifData.shutter_speed && <span><Clock className="h-3 w-3 inline" /> {exifData.shutter_speed}</span>}
                            {exifData.flash !== undefined && <span>{exifData.flash ? '⚡ Flash' : '📷 Sans flash'}</span>}
                            {exifData.device_model && <span><Smartphone className="h-3 w-3 inline" /> {exifData.device_model}</span>}
                          </div>
                        </div>
                      )}
                      {qualityPrediction && (
                        <div className={`p-3 rounded-lg text-xs ${qualityPrediction.level === 'excellent' ? 'bg-green-50' : qualityPrediction.level === 'good' ? 'bg-blue-50' : qualityPrediction.level === 'fair' ? 'bg-yellow-50' : 'bg-red-50'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium flex items-center gap-1"><Activity className="h-3 w-3" />Score qualité</span>
                            <Badge variant="outline">{qualityPrediction.score}%</Badge>
                          </div>
                          <Progress value={qualityPrediction.score} className="h-2 mb-2" />
                          {qualityPrediction.issues.map((issue, i) => <p key={i} className="text-orange-700 flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5" />{issue}</p>)}
                          {qualityPrediction.suggestions.map((sug, i) => <p key={i} className="text-blue-700 flex items-start gap-1 mt-1"><Lightbulb className="h-3 w-3 mt-0.5" />{sug}</p>)}
                        </div>
                      )}
                      {analyzingImage && <div className="flex items-center justify-center p-4 text-gray-500"><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyse...</div>}
                    </div>
                  ) : (
                    <label className="block">
                      <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed hover:border-purple-400 hover:bg-purple-50 cursor-pointer">
                        <Upload className="h-10 w-10 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">Cliquez pour uploader</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  )}
                </Card>

                {/* Processing column */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Zap className="h-4 w-4" />Traitement</h3>
                  {processedPhotoUrl ? (
                    <div className="relative mb-4"><img src={processedPhotoUrl} alt="Traité" className="w-full rounded-lg border" /><Badge className="absolute top-2 left-2 bg-purple-600">Traité</Badge></div>
                  ) : (
                    <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed mb-4"><p className="text-sm text-gray-400">Uploadez une photo</p></div>
                  )}
                  <div className="p-3 bg-gray-50 rounded-lg border text-xs mb-4">
                    <div className="flex items-center gap-1 mb-1"><Star className="h-3 w-3 text-yellow-500" /><span className="font-medium">Config active</span></div>
                    <div className="text-gray-500">{formatConfig(savedModelConfig)}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><Label className="text-sm">Noir & Blanc</Label><Switch checked={imageConfig.grayscale} onCheckedChange={(v) => updateConfig('grayscale', v)} /></div>
                    <div><div className="flex justify-between mb-1"><Label className="text-sm">Contraste</Label><span className="text-xs text-gray-500">{imageConfig.contrast > 0 ? '+' : ''}{imageConfig.contrast}%</span></div><input type="range" min="-50" max="100" value={imageConfig.contrast} onChange={(e) => updateConfig('contrast', +e.target.value)} className="w-full accent-purple-600" /></div>
                    <div><div className="flex justify-between mb-1"><Label className="text-sm">Luminosité</Label><span className="text-xs text-gray-500">{imageConfig.brightness > 0 ? '+' : ''}{imageConfig.brightness}%</span></div><input type="range" min="-50" max="50" value={imageConfig.brightness} onChange={(e) => updateConfig('brightness', +e.target.value)} className="w-full accent-purple-600" /></div>
                    <div><div className="flex justify-between mb-1"><Label className="text-sm">Netteté</Label><span className="text-xs text-gray-500">{imageConfig.sharpness}%</span></div><input type="range" min="0" max="100" value={imageConfig.sharpness} onChange={(e) => updateConfig('sharpness', +e.target.value)} className="w-full accent-purple-600" /></div>
                    <div className="flex items-center justify-between"><Label className="text-sm">Recadrage auto</Label><Switch checked={imageConfig.auto_crop} onCheckedChange={(v) => updateConfig('auto_crop', v)} /></div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={resetToOriginal} className="flex-1"><ImageIconLucide className="h-4 w-4 mr-1" />Original</Button>
                      <Button variant="outline" size="sm" onClick={resetToAurora} className="flex-1"><RotateCcw className="h-4 w-4 mr-1" />Aurora</Button>
                      <Button variant="outline" size="sm" onClick={resetToActiveConfig} className="flex-1"><Star className="h-4 w-4 mr-1" />Active</Button>
                    </div>
                  </div>
                </Card>

                {/* Results column */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Zap className="h-4 w-4" />Résultats</h3>
                  {processedPhotoUrl && !testResult && (
                    <Button onClick={runTest} disabled={testing} className="w-full mb-4 bg-gradient-to-r from-purple-600 to-indigo-600">
                      {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Lancer l'analyse
                    </Button>
                  )}
                  {testResult && (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {testResult.success ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                          <span className={testResult.success ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{testResult.success ? 'Reconnu' : 'Échec'}</span>
                          <Badge variant="outline" className="ml-auto">{(testResult.confidence * 100).toFixed(0)}%</Badge>
                        </div>
                        {testResult.serial_number && <p className="text-sm"><strong>N° série:</strong> {testResult.serial_number}</p>}
                        {testResult.reading && <p className="text-sm"><strong>Index:</strong> {testResult.reading}</p>}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Tokens</p><p className="font-semibold">{testResult.tokens_input + testResult.tokens_output}</p></div>
                        <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Temps</p><p className="font-semibold">{(testResult.processing_time_ms/1000).toFixed(1)}s</p></div>
                        <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Confiance</p><p className="font-semibold">{(testResult.confidence*100).toFixed(0)}%</p></div>
                        <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Coût</p><p className="font-semibold">{testCost ? formatCost(testCost.total) : '-'}</p></div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={validateTest} className="flex-1 bg-green-600 hover:bg-green-700"><Check className="h-4 w-4 mr-1" />Valider</Button>
                        <Button onClick={() => { setCorrectionSerial(testResult.serial_number || ''); setCorrectionReading(testResult.reading || ''); setShowCorrectionModal(true) }} variant="outline" className="flex-1"><Edit3 className="h-4 w-4 mr-1" />Corriger</Button>
                        <Button onClick={rejectTest} variant="outline" className="flex-1 text-red-600"><X className="h-4 w-4 mr-1" />Rejeter</Button>
                      </div>
                      <Button onClick={resetTest} variant="ghost" className="w-full"><RotateCcw className="h-4 w-4 mr-2" />Nouveau test</Button>
                    </div>
                  )}
                  {!processedPhotoUrl && !testResult && <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Uploadez une photo</div>}
                </Card>
              </div>
            )}

            {/* ANALYZE TAB */}
            {activeTab === 'analyze' && (
              <div className="space-y-6">
                {/* Cost header */}
                <div className="grid grid-cols-4 gap-4">
                  <Card className="p-4"><p className="text-xs text-gray-500">Coût total</p><p className="text-2xl font-bold">{formatCost(modelStats.totalCost)}</p></Card>
                  <Card className="p-4"><p className="text-xs text-gray-500">Coût moy/test</p><p className="text-2xl font-bold">{modelStats.total > 0 ? formatCost(modelStats.totalCost / modelStats.total) : '-'}</p></Card>
                  <Card className="p-4"><p className="text-xs text-gray-500">Tokens totaux</p><p className="text-2xl font-bold">{modelStats.totalTokens.toLocaleString()}</p></Card>
                  <Card className="p-4"><p className="text-xs text-gray-500">Succès</p><p className="text-2xl font-bold text-green-600">{successRate || 0}%</p></Card>
                </div>

                {/* Suggestion */}
                {bestConfig && (
                  <Card className="p-4 border-2 border-blue-200 bg-blue-50/30">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-blue-600" />
                      <div>
                        <h4 className="font-medium text-blue-900">Suggestion</h4>
                        <p className="text-sm text-blue-700">La config <strong>{formatConfig(bestConfig.config)}</strong> a {bestConfig.successRate.toFixed(0)}% de succès sur {bestConfig.tests} tests.</p>
                        <Button size="sm" className="mt-2 bg-blue-600" onClick={() => { setConfigToActivate(bestConfig.config); setShowActivateModal(true) }}>Activer</Button>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Config table */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-4">Performance par configuration</h3>
                  {configStats.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b"><th className="text-left py-2">Config</th><th className="text-center py-2">Tests</th><th className="text-center py-2">Succès</th><th className="text-center py-2">Confiance</th><th className="text-center py-2">Coût</th><th className="text-right py-2">Action</th></tr></thead>
                      <tbody>
                        {configStats.map(s => (
                          <tr key={s.configKey} className={`border-b ${s.isActive ? 'bg-purple-50' : ''}`}>
                            <td className="py-2 font-mono text-xs">{formatConfig(s.config)}</td>
                            <td className="text-center py-2">{s.tests}</td>
                            <td className="text-center py-2"><Badge variant="outline" className={s.successRate >= 80 ? 'bg-green-50 text-green-700' : s.successRate >= 50 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}>{s.successRate.toFixed(0)}%</Badge></td>
                            <td className="text-center py-2">{s.avgConfidence.toFixed(0)}%</td>
                            <td className="text-center py-2">{formatCost(s.totalCost)}</td>
                            <td className="text-right py-2">{s.isActive ? <Badge className="bg-purple-600"><Star className="h-3 w-3 mr-1" />Active</Badge> : <Button size="sm" variant="outline" onClick={() => { setConfigToActivate(s.config); setShowActivateModal(true) }}>Activer</Button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="text-center py-8 text-gray-500">Aucun test</p>}
                </Card>

                {/* History */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-4">Derniers tests</h3>
                  {experiments.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b"><th className="text-left py-2">Date</th><th className="text-left py-2">Index</th><th className="text-center py-2">Confiance</th><th className="text-center py-2">Tokens</th><th className="text-left py-2">Config</th><th className="text-center py-2">Status</th></tr></thead>
                      <tbody>
                        {experiments.slice(0, 10).map(e => (
                          <tr key={e.id} className="border-b">
                            <td className="py-2 text-gray-500">{new Date(e.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="py-2 font-mono">{e.corrected_data?.reading || e.extracted_data?.reading?.value || '-'}</td>
                            <td className="text-center py-2"><Badge variant="outline" className="bg-green-50 text-green-700">{((e.confidence || 0) * 100).toFixed(0)}%</Badge></td>
                            <td className="text-center py-2 text-gray-500">{(e.tokens_input || 0) + (e.tokens_output || 0)}</td>
                            <td className="py-2">{e.image_config_used && <Badge variant="outline" className="text-xs">{e.image_config_used.grayscale ? 'B&W' : 'Color'}</Badge>}</td>
                            <td className="text-center py-2"><Badge variant="outline" className={e.status === 'validated' ? 'bg-green-50 text-green-700' : e.status === 'corrected' ? 'bg-orange-50 text-orange-700' : e.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-gray-50'}>{e.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="text-center py-4 text-gray-500">Aucun test</p>}
                </Card>
              </div>
            )}

            {/* PRODUCTION TAB */}
            {activeTab === 'production' && (
              <div className="space-y-6">
                {/* Active config */}
                <Card className="p-6 border-2 border-purple-200 bg-purple-50/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 text-lg"><Star className="h-5 w-5 text-yellow-500" />Configuration active</h3>
                      <p className="text-2xl font-mono mt-2">{formatConfig(savedModelConfig)}</p>
                      <div className="flex gap-4 mt-3 text-sm text-gray-600">
                        {configStats.find(s => s.isActive) && (
                          <>
                            <span><Target className="h-4 w-4 inline mr-1" />{configStats.find(s => s.isActive)?.tests} tests</span>
                            <span><TrendingUp className="h-4 w-4 inline mr-1" />{configStats.find(s => s.isActive)?.successRate.toFixed(0)}% succès</span>
                            <span><Activity className="h-4 w-4 inline mr-1" />{configStats.find(s => s.isActive)?.avgConfidence.toFixed(0)}% confiance</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-green-600 text-lg px-3 py-1">En production</Badge>
                  </div>
                </Card>

                {/* History */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2"><History className="h-4 w-4" />Historique des versions</h3>
                  {configHistory.length > 0 ? (
                    <div className="space-y-3">
                      {configHistory.map((h, i) => (
                        <div key={h.id} className={`p-4 rounded-lg border ${i === 0 ? 'border-purple-200 bg-purple-50' : 'border-gray-200'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-mono">{formatConfig(h.image_config)}</p>
                              <p className="text-sm text-gray-500 mt-1">
                                Activée le {new Date(h.activated_at).toLocaleDateString('fr-FR')}
                                {h.deactivated_at && ` • Désactivée le ${new Date(h.deactivated_at).toLocaleDateString('fr-FR')}`}
                              </p>
                            </div>
                            <div className="text-right">
                              {i === 0 ? (
                                <Badge className="bg-purple-600">Active</Badge>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => { setConfigToActivate(h.image_config); setShowActivateModal(true) }}>Réactiver</Button>
                              )}
                              <div className="text-sm text-gray-500 mt-1">
                                {h.tests_count} tests • {h.success_rate?.toFixed(0) || 0}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-gray-500">Aucun historique. Activez une config depuis l'onglet Analyser.</p>
                  )}
                </Card>
              </div>
            )}
          </>
        ) : (
          /* DASHBOARD - Vue racine sans modèle sélectionné */
          <div className="space-y-6">
            {/* Stats globales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-1">Total modèles</p>
                <p className="text-2xl font-bold">{models.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-1">Brouillons</p>
                <p className="text-2xl font-bold text-yellow-600">{models.filter(m => m.status === 'draft').length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-1">Actifs</p>
                <p className="text-2xl font-bold text-green-600">{models.filter(m => m.status === 'active').length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-1">Archivés</p>
                <p className="text-2xl font-bold text-gray-400">{models.filter(m => m.status === 'archived').length}</p>
              </Card>
            </div>

            {/* Liste des modèles */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Modèles de compteurs
                </h3>
                <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/meters')}>
                  Voir tous <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              
              {models.length > 0 ? (
                <div className="space-y-2">
                  {models.slice(0, 5).map(model => (
                    <div 
                      key={model.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => { setSelectedModelId(model.id); setActiveTab('test') }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{METER_TYPE_ICONS[model.meter_type] || '📊'}</span>
                        <div>
                          <p className="font-medium">{model.name}</p>
                          <p className="text-sm text-gray-500">{model.manufacturer || 'Fabricant inconnu'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {model.status === 'draft' && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Brouillon</Badge>
                        )}
                        {model.status === 'active' && (
                          <Badge variant="outline" className="bg-green-50 text-green-700">Actif</Badge>
                        )}
                        {model.status === 'archived' && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-500">Archivé</Badge>
                        )}
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Gauge className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Aucun modèle de compteur</p>
                  <Button size="sm" className="mt-3" onClick={() => router.push('/dashboard/meters/create')}>
                    <Plus className="h-4 w-4 mr-1" />Créer un modèle
                  </Button>
                </div>
              )}
            </Card>

            {/* Import & Tri rapide */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FolderInput className="h-5 w-5" />
                Import & Tri rapide
              </h3>
              <label className="block">
                <div className="h-32 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed hover:border-purple-400 hover:bg-purple-50 cursor-pointer transition-colors">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-gray-600 text-sm">Glissez-déposez vos photos de compteurs</p>
                  <p className="text-xs text-gray-400 mt-1">L'IA les triera automatiquement par modèle</p>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  onChange={handleBulkPhotoUpload}
                />
              </label>

              {/* Classification en cours */}
              {classifying && (
                <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-center gap-3 text-purple-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="font-medium">Classification en cours...</span>
                  </div>
                </div>
              )}

              {/* Résultats du tri */}
              {classifiedPhotos.length > 0 && !classifying && (
                <div className="mt-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Résultats ({classifiedPhotos.reduce((acc, g) => acc + g.photos.length, 0)} photos)
                  </h4>
                  
                  {classifiedPhotos.map((group, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${group.modelId ? 'border-green-200 bg-green-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {group.modelId ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-sm">{group.modelName}</span>
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-700">{group.photos.length}</Badge>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-4 w-4 text-orange-600" />
                              <span className="font-medium text-sm text-orange-700">Non reconnus</span>
                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700">{group.photos.length}</Badge>
                            </>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {group.modelId ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setSelectedModelId(group.modelId!)
                                setActiveTab('test')
                              }}
                            >
                              Tester <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => router.push('/dashboard/meters/create')}>
                                <Plus className="h-3 w-3 mr-1" />Créer
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeClassifiedGroup(idx)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 overflow-x-auto">
                        {group.photos.slice(0, 6).map((photo, photoIdx) => (
                          <img 
                            key={photoIdx}
                            src={photo.url}
                            alt={`Photo ${photoIdx + 1}`}
                            className="h-12 w-12 object-cover rounded border flex-shrink-0"
                          />
                        ))}
                        {group.photos.length > 6 && (
                          <div className="h-12 w-12 flex items-center justify-center bg-gray-100 rounded border text-xs text-gray-500">
                            +{group.photos.length - 6}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setClassifiedPhotos([]); setImportedPhotos([]) }}
                    className="w-full text-gray-500"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />Effacer les résultats
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Correction Modal */}
        <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Corriger le résultat</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><Label>N° série</Label><Input value={correctionSerial} onChange={(e) => setCorrectionSerial(e.target.value)} /></div>
              <div><Label>Index</Label><Input value={correctionReading} onChange={(e) => setCorrectionReading(e.target.value)} /></div>
              <div><Label>Note</Label><Textarea value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCorrectionModal(false)}>Annuler</Button>
              <Button onClick={submitCorrection} className="bg-purple-600">Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Activate Modal */}
        <Dialog open={showActivateModal} onOpenChange={setShowActivateModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Activer cette configuration ?</DialogTitle><DialogDescription>Cette config sera utilisée en production.</DialogDescription></DialogHeader>
            <div className="py-4 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">Nouvelle</p><p className="font-mono">{configToActivate && formatConfig(configToActivate)}</p></div>
              <div className="p-3 bg-purple-50 rounded-lg"><p className="text-sm text-gray-500">Actuelle</p><p className="font-mono">{formatConfig(savedModelConfig)}</p></div>
              <div><Label>Notes (optionnel)</Label><Textarea value={activationNotes} onChange={(e) => setActivationNotes(e.target.value)} rows={2} placeholder="Raison de ce changement..." /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActivateModal(false)}>Annuler</Button>
              <Button onClick={activateConfig} disabled={activating} className="bg-purple-600">{activating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}Activer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Prompt Edit Modal */}
        <Dialog open={showPromptModal} onOpenChange={setShowPromptModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Modifier le prompt</DialogTitle>
              <DialogDescription>Ce prompt sera utilisé par l'IA pour reconnaître ce type de compteur.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea 
                value={editedPrompt} 
                onChange={(e) => setEditedPrompt(e.target.value)} 
                rows={12}
                className="font-mono text-sm"
                placeholder="Instructions pour Claude..."
              />
              <p className="text-xs text-gray-500 mt-2">
                Décrivez les règles de lecture : nombre de décimales, couleur des chiffres, format attendu, etc.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPromptModal(false)}>Annuler</Button>
              <Button onClick={savePrompt} disabled={savingPrompt} className="bg-purple-600">
                {savingPrompt ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Activate Model Modal */}
        <Dialog open={showActivateModelModal} onOpenChange={setShowActivateModelModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" />Activer ce modèle ?</DialogTitle>
              <DialogDescription>Une fois activé, ce modèle sera disponible pour le scan dans l'application iOS.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{selectedModel && METER_TYPE_ICONS[selectedModel.meter_type]}</span>
                  <span className="font-semibold">{selectedModel?.name}</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>{modelStats.total}</strong> tests effectués</p>
                  {successRate && <p><strong>{successRate}%</strong> de succès</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <span>Cette action est réversible. Vous pourrez archiver ce modèle si nécessaire.</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowActivateModelModal(false)}>Annuler</Button>
              <Button onClick={activateModel} disabled={activatingModel} className="bg-green-600 hover:bg-green-700">
                {activatingModel ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Activer le modèle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
