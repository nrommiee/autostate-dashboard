'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { 
  Upload, Play, Check, X, RotateCcw, Loader2, CheckCircle, XCircle, 
  Zap, ImageIcon, Target, Star, AlertTriangle,
  Activity, History, FileText, Pencil, 
  FolderInput, ArrowRight, ArrowLeft, Plus, Gauge, Eye, 
  LayoutDashboard, TestTube, GitBranch,
  Keyboard, Search, Settings2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface MeterModel {
  id: string
  name: string
  manufacturer: string | null
  meter_type: string
  unit: string
  status: 'draft' | 'active' | 'archived'
  ai_description: string | null
  reference_photos: string[]
  image_config_overrides: ImageConfig | null
  reading_zones: ReadingZone[]
  total_scans?: number
  success_count?: number
  created_at: string
}

interface ReadingZone {
  id: string
  label: string
  type: 'text' | 'number'
  format?: string
}

interface RecognitionVersion {
  id: string
  codename: string
  version_number: string
  display_name: string
  status: 'development' | 'stable' | 'legacy'
  is_default: boolean
  default_image_config: ImageConfig
  description?: string
  changelog?: string
  created_at: string
}

interface ImageConfig {
  grayscale: boolean
  contrast: number
  brightness: number
  sharpness: number
  auto_crop?: boolean
  max_dimension?: number
  jpeg_quality?: number
}

interface TestConfig {
  id: string
  model_id: string
  name: string | null
  grayscale: boolean
  contrast: number
  sharpness: number
  is_active: boolean
  created_at: string
  test_count?: number
  success_rate?: number | null
}

interface LabExperiment {
  id: string
  meter_model_id: string
  original_photo_url: string | null
  status: 'pending' | 'validated' | 'corrected' | 'rejected'
  extracted_data: Record<string, { value: string; confidence: number }> | null
  corrected_data: Record<string, string> | null
  confidence: number | null
  tokens_input: number | null
  tokens_output: number | null
  image_config_used: ImageConfig | null
  test_config_id: string | null
  created_at: string
}

interface ImportedPhoto {
  id: string
  file: File
  url: string
  status: 'pending' | 'analyzing' | 'done' | 'error'
  matchedModelId: string | null
  matchedModelName: string | null
  extractedData: Record<string, { value: string; confidence: number }> | null
  confidence: number
  error?: string
}

interface ReviewSession {
  modelId: string
  modelName: string
  photos: ImportedPhoto[]
  currentIndex: number
}

const DEFAULT_CONFIG: ImageConfig = {
  grayscale: true, contrast: 30, brightness: 0, sharpness: 20,
  auto_crop: true, max_dimension: 1024, jpeg_quality: 85
}

const METER_TYPE_ICONS: Record<string, string> = {
  gas: '🔥', electricity: '⚡', water_general: '💧', water_cold: '💧',
  water_hot: '🔴', oil_tank: '🛢️', calorimeter: '🌡️', other: '📊'
}

const METER_TYPE_LABELS: Record<string, string> = {
  gas: 'Gaz', electricity: 'Électricité', water_general: 'Eau',
  water_cold: 'Eau froide', water_hot: 'Eau chaude', 
  oil_tank: 'Cuve fioul', calorimeter: 'Calorimètre', other: 'Autre'
}

// PARTIE 1 FIN - Coller partie 2 ci-dessous
export default function LabsMetersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'tests' | 'versions'>('overview')
  const [loading, setLoading] = useState(true)
  const [models, setModels] = useState<MeterModel[]>([])
  const [versions, setVersions] = useState<RecognitionVersion[]>([])
  const [experiments, setExperiments] = useState<LabExperiment[]>([])
  
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedModelStats, setSelectedModelStats] = useState<{tests: number, success: number}>({tests: 0, success: 0})
  const [modelSearch, setModelSearch] = useState('')
  const [modelFilter, setModelFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all')
  
  const [testMode, setTestMode] = useState<'single' | 'bulk'>('single')
  const [testModelId, setTestModelId] = useState<string>('')
  const [importedPhotos, setImportedPhotos] = useState<ImportedPhoto[]>([])
  const [classifying, setClassifying] = useState(false)
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null)
  
  const [testPhotoFile, setTestPhotoFile] = useState<File | null>(null)
  const [testPhotoUrl, setTestPhotoUrl] = useState<string | null>(null)
  const [testConfig, setTestConfig] = useState<ImageConfig>(DEFAULT_CONFIG)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [validating, setValidating] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  
  // Config management - NEW
  const [testConfigs, setTestConfigs] = useState<TestConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>('custom')
  const [saveAsNewConfig, setSaveAsNewConfig] = useState(false)
  const [newConfigName, setNewConfigName] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [correctionData, setCorrectionData] = useState<Record<string, string>>({})
  const [correctionPhotoId, setCorrectionPhotoId] = useState<string | null>(null)
  
  const [showTestCorrectionModal, setShowTestCorrectionModal] = useState(false)
  const [testCorrectionSerial, setTestCorrectionSerial] = useState('')
  const [testCorrectionReading, setTestCorrectionReading] = useState('')

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const tab = searchParams.get('tab')
    const modelId = searchParams.get('model')
    if (tab === 'tests') setActiveTab('tests')
    if (modelId) { setTestModelId(modelId); setTestMode('single') }
  }, [searchParams])

  useEffect(() => {
    if (testModelId) {
      loadModelExperiments(testModelId)
      loadModelConfigs(testModelId)
    }
  }, [testModelId])

  useEffect(() => {
    if (selectedModelId) loadModelStats(selectedModelId)
  }, [selectedModelId])

  useEffect(() => {
    if (selectedConfigId === 'custom') return
    const config = testConfigs.find(c => c.id === selectedConfigId)
    if (config) {
      setTestConfig({ ...testConfig, grayscale: config.grayscale, contrast: config.contrast, sharpness: config.sharpness })
    }
  }, [selectedConfigId])

  useEffect(() => {
    if (testModelId) {
      const model = models.find(m => m.id === testModelId)
      if (model?.image_config_overrides) setTestConfig(model.image_config_overrides)
      else setTestConfig(DEFAULT_CONFIG)
    }
  }, [testModelId, models])

  async function loadModelConfigs(modelId: string) {
    const { data: configs } = await supabase.from('test_configs').select('*').eq('model_id', modelId).order('created_at', { ascending: false })
    if (configs) {
      const { data: allTests } = await supabase.from('labs_experiments').select('test_config_id, status').eq('meter_model_id', modelId)
      const configsWithStats = configs.map(config => {
        const configTests = (allTests || []).filter(t => t.test_config_id === config.id)
        const validated = configTests.filter(t => t.status === 'validated' || t.status === 'corrected').length
        return { ...config, test_count: configTests.length, success_rate: configTests.length > 0 ? Math.round((validated / configTests.length) * 100) : null }
      })
      setTestConfigs(configsWithStats)
      const activeConfig = configsWithStats.find(c => c.is_active)
      setSelectedConfigId(activeConfig ? activeConfig.id : 'custom')
    }
  }

  async function loadModelStats(modelId: string) {
    const { data } = await supabase.from('labs_experiments').select('status').eq('meter_model_id', modelId)
    setSelectedModelStats({ tests: data?.length || 0, success: data?.filter(e => e.status === 'validated' || e.status === 'corrected').length || 0 })
  }

  async function loadData() {
    setLoading(true)
    try {
      const [modelsRes, versionsRes, allExperimentsRes] = await Promise.all([
        supabase.from('meter_models').select('*').order('name'),
        supabase.from('recognition_versions').select('*').order('created_at', { ascending: false }),
        supabase.from('labs_experiments').select('*').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      ])
      if (modelsRes.data) setModels(modelsRes.data)
      if (versionsRes.data) setVersions(versionsRes.data)
      if (allExperimentsRes.data && !testModelId) setExperiments(allExperimentsRes.data)
    } catch (err) { console.error('Error loading data:', err) }
    setLoading(false)
  }

  async function loadModelExperiments(modelId: string) {
    const { data } = await supabase.from('labs_experiments').select('*').eq('meter_model_id', modelId).order('created_at', { ascending: false }).limit(50)
    if (data) setExperiments(data)
  }

  function formatImageConfig(config: ImageConfig | null): string {
    if (!config) return 'Par défaut'
    const parts = [config.grayscale ? 'N&B' : 'Couleur']
    if (config.contrast !== 0) parts.push(`C:${config.contrast > 0 ? '+' : ''}${config.contrast}%`)
    if (config.sharpness !== 0) parts.push(`N:${config.sharpness}%`)
    return parts.join(' • ')
  }

  function formatTestConfig(config: TestConfig): string {
    const parts = [config.grayscale ? 'N&B' : 'Couleur']
    if (config.contrast !== 0) parts.push(`C:${config.contrast > 0 ? '+' : ''}${config.contrast}%`)
    if (config.sharpness !== 0) parts.push(`N:${config.sharpness}%`)
    return parts.join(' ')
  }

  function getConfigLabel(configId: string | null): string {
    if (!configId) return 'Personnalisé'
    const config = testConfigs.find(c => c.id === configId)
    return config ? (config.name || formatTestConfig(config)) : 'Inconnu'
  }

  async function saveNewConfig(): Promise<string | null> {
    if (!testModelId) return null
    setSavingConfig(true)
    try {
      const { data, error } = await supabase.from('test_configs').insert({
        model_id: testModelId, name: newConfigName || null,
        grayscale: testConfig.grayscale, contrast: testConfig.contrast, sharpness: testConfig.sharpness, is_active: false
      }).select().single()
      if (error) throw error
      await loadModelConfigs(testModelId)
      setSaveAsNewConfig(false); setNewConfigName('')
      return data.id
    } catch (err) { console.error('Error saving config:', err); return null }
    finally { setSavingConfig(false) }
  }

  async function resizeImage(file: File, maxSize: number = 1600): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { URL.revokeObjectURL(objectUrl); reject(new Error('No context')); return }
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(objectUrl)
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed')) }
      img.src = objectUrl
    })
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => { const r = reader.result as string; r ? resolve(r.split(',')[1]) : reject(new Error('Empty')) }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  async function applyFiltersToImage(file: File, maxSize: number = 1600): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize }
          else { width = Math.round((width * maxSize) / height); height = maxSize }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { URL.revokeObjectURL(objectUrl); reject(new Error('No context')); return }
        const filters: string[] = []
        if (testConfig.grayscale) filters.push('grayscale(100%)')
        if (testConfig.contrast !== 0) filters.push(`contrast(${100 + testConfig.contrast}%)`)
        if (testConfig.brightness !== 0) filters.push(`brightness(${100 + testConfig.brightness}%)`)
        ctx.filter = filters.length > 0 ? filters.join(' ') : 'none'
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(objectUrl)
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed')) }
      img.src = objectUrl
    })
  }

  const stats = {
    total: models.length, draft: models.filter(m => m.status === 'draft').length,
    active: models.filter(m => m.status === 'active').length, archived: models.filter(m => m.status === 'archived').length
  }

  const filteredModels = models.filter(m => {
    if (modelFilter !== 'all' && m.status !== modelFilter) return false
    if (modelSearch) { const s = modelSearch.toLowerCase(); return m.name.toLowerCase().includes(s) || m.manufacturer?.toLowerCase().includes(s) }
    return true
  })

  const selectedModel = models.find(m => m.id === selectedModelId)
  const activeVersion = versions.find(v => v.is_default)

  const classifiedGroups = importedPhotos.reduce((acc, photo) => {
    if (photo.status !== 'done') return acc
    const key = photo.matchedModelId || 'unrecognized'
    if (!acc[key]) acc[key] = { modelId: photo.matchedModelId, modelName: photo.matchedModelName || 'Non reconnus', photos: [] }
    acc[key].photos.push(photo)
    return acc
  }, {} as Record<string, { modelId: string | null; modelName: string; photos: ImportedPhoto[] }>)

// PARTIE 2 FIN - Coller partie 3 ci-dessous
  async function processBulkFiles(files: File[]) {
    if (!files.length) return
    const newPhotos: ImportedPhoto[] = files.map(file => ({
      id: crypto.randomUUID(), file, url: URL.createObjectURL(file), status: 'pending' as const,
      matchedModelId: null, matchedModelName: null, extractedData: null, confidence: 0
    }))
    setImportedPhotos(newPhotos)
    setClassifying(true)
    for (let i = 0; i < newPhotos.length; i++) {
      const photo = newPhotos[i]
      try {
        photo.status = 'analyzing'; setImportedPhotos([...newPhotos])
        const base64 = await resizeImage(photo.file, 1600)
        const response = await fetch('/api/labs/classify-meter', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: base64 })
        })
        if (response.ok) {
          const result = await response.json()
          photo.matchedModelId = result.matchedModel?.id || null
          photo.matchedModelName = result.matchedModel?.name || 'Non reconnu'
          photo.extractedData = result.extractedData || null
          photo.confidence = result.confidence || 0
          photo.status = 'done'
        } else { photo.status = 'error'; photo.error = `Erreur: ${response.status}` }
      } catch (err: any) { photo.status = 'error'; photo.error = err.message }
      setImportedPhotos([...newPhotos])
    }
    setClassifying(false)
  }

  function startReview(modelId: string | null, modelName: string, photos: ImportedPhoto[]) {
    setReviewSession({ modelId: modelId || 'unrecognized', modelName, photos, currentIndex: 0 })
  }

  function reviewNext() {
    if (reviewSession && reviewSession.currentIndex < reviewSession.photos.length - 1)
      setReviewSession({ ...reviewSession, currentIndex: reviewSession.currentIndex + 1 })
  }

  function reviewPrev() {
    if (reviewSession && reviewSession.currentIndex > 0)
      setReviewSession({ ...reviewSession, currentIndex: reviewSession.currentIndex - 1 })
  }

  async function reviewValidate() {
    if (!reviewSession) return
    const photo = reviewSession.photos[reviewSession.currentIndex]
    if (!photo.matchedModelId) { alert('Assignez d\'abord à un modèle.'); return }
    try {
      const base64 = await fileToBase64(photo.file)
      await fetch('/api/labs/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_model_id: photo.matchedModelId, photo_base64: base64, extracted_data: photo.extractedData,
          corrected_data: null, confidence: photo.confidence, status: 'validated', image_config_used: testConfig,
          test_config_id: selectedConfigId !== 'custom' ? selectedConfigId : null
        })
      })
    } catch (err) { console.error('Error:', err) }
    if (reviewSession.currentIndex >= reviewSession.photos.length - 1) { setReviewSession(null); loadData() }
    else reviewNext()
  }

  async function reviewReject() {
    if (!reviewSession) return
    const photo = reviewSession.photos[reviewSession.currentIndex]
    if (!photo.matchedModelId) {
      const updated = reviewSession.photos.filter(p => p.id !== photo.id)
      if (updated.length === 0) setReviewSession(null)
      else setReviewSession({ ...reviewSession, photos: updated, currentIndex: Math.min(reviewSession.currentIndex, updated.length - 1) })
      return
    }
    try {
      const base64 = await fileToBase64(photo.file)
      await fetch('/api/labs/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_model_id: photo.matchedModelId, photo_base64: base64, extracted_data: photo.extractedData,
          corrected_data: null, confidence: photo.confidence, status: 'rejected', image_config_used: testConfig,
          test_config_id: selectedConfigId !== 'custom' ? selectedConfigId : null
        })
      })
    } catch (err) { console.error('Error:', err) }
    if (reviewSession.currentIndex >= reviewSession.photos.length - 1) { setReviewSession(null); loadData() }
    else reviewNext()
  }

  function reviewOpenCorrection() {
    if (!reviewSession) return
    const photo = reviewSession.photos[reviewSession.currentIndex]
    const data: Record<string, string> = {}
    if (photo.extractedData) Object.entries(photo.extractedData).forEach(([k, v]) => { data[k] = v.value })
    setCorrectionData(data); setCorrectionPhotoId(photo.id); setShowCorrectionModal(true)
  }

  async function submitCorrection() {
    if (!correctionPhotoId || !reviewSession) return
    const photo = reviewSession.photos.find(p => p.id === correctionPhotoId)
    if (!photo) return
    try {
      const base64 = await fileToBase64(photo.file)
      await fetch('/api/labs/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_model_id: photo.matchedModelId, photo_base64: base64, extracted_data: photo.extractedData,
          corrected_data: correctionData, confidence: photo.confidence, status: 'corrected', image_config_used: testConfig,
          test_config_id: selectedConfigId !== 'custom' ? selectedConfigId : null
        })
      })
    } catch (err) { console.error('Error:', err) }
    setShowCorrectionModal(false); setCorrectionPhotoId(null)
    if (reviewSession.currentIndex >= reviewSession.photos.length - 1) { setReviewSession(null); loadData() }
    else reviewNext()
  }

  useEffect(() => {
    if (!reviewSession) return
    function handleKeyDown(e: KeyboardEvent) {
      if (showCorrectionModal) return
      switch (e.key) {
        case 'ArrowLeft': case 'a': reviewPrev(); break
        case 'ArrowRight': case 'd': reviewNext(); break
        case 'v': reviewValidate(); break
        case 'c': reviewOpenCorrection(); break
        case 'r': reviewReject(); break
        case 'Escape': setReviewSession(null); break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [reviewSession, showCorrectionModal])

  async function handleSingleTestPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (testPhotoUrl) URL.revokeObjectURL(testPhotoUrl)
    setTestPhotoFile(file); setTestPhotoUrl(URL.createObjectURL(file)); setTestResult(null)
  }

  async function runSingleTest() {
    if (!testPhotoFile || !testModelId) return
    setTesting(true)
    try {
      const photoToAnalyze = await applyFiltersToImage(testPhotoFile)
      const model = models.find(m => m.id === testModelId)
      const response = await fetch('/api/test-meter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testPhoto: photoToAnalyze, modelId: testModelId, imageConfig: testConfig, promptRules: model?.ai_description })
      })
      setTestResult(await response.json())
    } catch (err) { console.error('Test error:', err) }
    setTesting(false)
  }

  async function handleValidateSingleTest() {
    if (!testPhotoFile || !testModelId || !testResult) return
    setValidating(true)
    try {
      let configIdToUse = selectedConfigId !== 'custom' ? selectedConfigId : null
      if (saveAsNewConfig && selectedConfigId === 'custom') {
        const newId = await saveNewConfig()
        if (newId) configIdToUse = newId
      }
      const base64 = await fileToBase64(testPhotoFile)
      const wasCorrected = testResult.wasCorrected === true
      await fetch('/api/labs/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_model_id: testModelId, photo_base64: base64,
          extracted_data: {
            serial: { value: testResult.originalSerial || testResult.extractedSerial, confidence: testResult.confidence },
            reading: { value: testResult.originalReading || testResult.extractedReading, confidence: testResult.confidence }
          },
          corrected_data: wasCorrected ? { serial: testResult.extractedSerial, reading: testResult.extractedReading } : null,
          confidence: testResult.confidence, status: wasCorrected ? 'corrected' : 'validated',
          image_config_used: testConfig, test_config_id: configIdToUse
        })
      })
      setTestPhotoUrl(null); setTestPhotoFile(null); setTestResult(null)
      await loadModelExperiments(testModelId)
      await loadModelConfigs(testModelId)
    } catch (err) { console.error('Error:', err) }
    setValidating(false)
  }

  async function handleRejectSingleTest() {
    if (!testPhotoFile || !testModelId) return
    setRejecting(true)
    try {
      let configIdToUse = selectedConfigId !== 'custom' ? selectedConfigId : null
      if (saveAsNewConfig && selectedConfigId === 'custom') {
        const newId = await saveNewConfig()
        if (newId) configIdToUse = newId
      }
      const base64 = await fileToBase64(testPhotoFile)
      await fetch('/api/labs/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_model_id: testModelId, photo_base64: base64,
          extracted_data: testResult ? {
            serial: { value: testResult.extractedSerial, confidence: testResult.confidence },
            reading: { value: testResult.extractedReading, confidence: testResult.confidence }
          } : {},
          corrected_data: null, confidence: testResult?.confidence || 0, status: 'rejected',
          image_config_used: testConfig, test_config_id: configIdToUse
        })
      })
      setTestPhotoUrl(null); setTestPhotoFile(null); setTestResult(null)
      await loadModelExperiments(testModelId)
      await loadModelConfigs(testModelId)
    } catch (err) { console.error('Error:', err) }
    setRejecting(false)
  }

  function openTestCorrectionModal() {
    setTestCorrectionSerial(testResult?.extractedSerial || '')
    setTestCorrectionReading(testResult?.extractedReading || '')
    setShowTestCorrectionModal(true)
  }

  function applyTestCorrection() {
    setTestResult({
      ...testResult, extractedSerial: testCorrectionSerial, extractedReading: testCorrectionReading,
      wasCorrected: true, originalSerial: testResult?.originalSerial || testResult?.extractedSerial,
      originalReading: testResult?.originalReading || testResult?.extractedReading
    })
    setShowTestCorrectionModal(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>

// PARTIE 3 FIN - Coller partie 4 ci-dessous
  // Review session UI
  if (reviewSession) {
    const currentPhoto = reviewSession.photos[reviewSession.currentIndex]
    const model = models.find(m => m.id === reviewSession.modelId)
    const zones = model?.reading_zones || [{ id: 'serial', label: 'N° série', type: 'text' }, { id: 'reading', label: 'Index', type: 'number' }]

    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setReviewSession(null)}><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
          <div className="text-center">
            <h2 className="font-semibold">Review - {reviewSession.modelName}</h2>
            <p className="text-sm text-gray-500">{reviewSession.currentIndex + 1} / {reviewSession.photos.length}</p>
          </div>
          <div className="flex items-center gap-1">
            {reviewSession.photos.map((p, i) => (
              <div key={p.id} className={`w-3 h-3 rounded-full cursor-pointer ${i === reviewSession.currentIndex ? 'bg-purple-600' : i < reviewSession.currentIndex ? 'bg-green-500' : 'bg-gray-300'}`}
                onClick={() => setReviewSession({ ...reviewSession, currentIndex: i })} />
            ))}
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-6 flex items-center justify-center bg-gray-100">
            <img src={currentPhoto.url} alt="Test" className="max-h-full max-w-full object-contain rounded-lg shadow-lg" />
          </div>
          <div className="w-96 border-l p-6 flex flex-col">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Zap className="h-5 w-5" />Résultat IA</h3>
            {currentPhoto.extractedData && Object.keys(currentPhoto.extractedData).length > 0 ? (
              <div className="space-y-4 flex-1">
                {currentPhoto.extractedData.serial && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-600 font-medium mb-1">N° SÉRIE</p>
                    <p className="text-2xl font-mono font-bold text-blue-900">{currentPhoto.extractedData.serial.value}</p>
                  </div>
                )}
                {currentPhoto.extractedData.reading && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs text-green-600 font-medium mb-1">INDEX</p>
                    <p className="text-2xl font-mono font-bold text-green-900">{currentPhoto.extractedData.reading.value}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <AlertTriangle className="h-12 w-12 mb-3 text-orange-400" />
                <p className="font-medium text-gray-600">Aucune donnée</p>
              </div>
            )}
            <div className="space-y-3 pt-4 border-t">
              {currentPhoto.matchedModelId ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="text-red-600" onClick={reviewReject}><X className="h-4 w-4 mr-1" />Rejeter</Button>
                    <Button variant="outline" onClick={reviewOpenCorrection}><Pencil className="h-4 w-4 mr-1" />Corriger</Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={reviewValidate}><Check className="h-4 w-4 mr-1" />Valider</Button>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                    <span><Keyboard className="h-3 w-3 inline mr-1" />←→</span>
                    <span>V Valider</span><span>C Corriger</span><span>R Rejeter</span>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 bg-orange-50 rounded-lg text-sm text-orange-700">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />Non reconnu
                  </div>
                  <Select onValueChange={(id) => {
                    const sel = models.find(m => m.id === id)
                    if (sel) { currentPhoto.matchedModelId = id; currentPhoto.matchedModelName = sel.name; setImportedPhotos([...importedPhotos]) }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Assigner à un modèle..." /></SelectTrigger>
                    <SelectContent>
                      {models.filter(m => m.status === 'active').map(m => <SelectItem key={m.id} value={m.id}>{METER_TYPE_ICONS[m.meter_type]} {m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="w-full text-red-600" onClick={reviewReject}><X className="h-4 w-4 mr-2" />Ignorer</Button>
                </div>
              )}
            </div>
          </div>
        </div>
        <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Corriger les valeurs</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              {zones.map(zone => (
                <div key={zone.id}><Label>{zone.label}</Label><Input value={correctionData[zone.id] || ''} onChange={(e) => setCorrectionData({ ...correctionData, [zone.id]: e.target.value })} className="font-mono" /></div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCorrectionModal(false)}>Annuler</Button>
              <Button onClick={submitCorrection} className="bg-purple-600">Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 -mx-6 -mt-6 p-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><Gauge className="h-6 w-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold text-white">Vision Compteurs</h1><p className="text-purple-200">Reconnaissance automatique des index</p></div>
        </div>
      </div>

      <div className="flex border-b">
        {(['overview', 'models', 'tests', 'versions'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === tab ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}>
            {tab === 'overview' && <LayoutDashboard className="h-4 w-4" />}
            {tab === 'models' && <Gauge className="h-4 w-4" />}
            {tab === 'tests' && <TestTube className="h-4 w-4" />}
            {tab === 'versions' && <GitBranch className="h-4 w-4" />}
            {tab === 'overview' ? "Vue d'ensemble" : tab === 'models' ? 'Modèles' : tab === 'tests' ? 'Tests' : 'Versions'}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Total</p><p className="text-2xl font-bold">{stats.total}</p></Card>
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Brouillons</p><p className="text-2xl font-bold text-yellow-600">{stats.draft}</p></Card>
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Actifs</p><p className="text-2xl font-bold text-green-600">{stats.active}</p></Card>
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Archivés</p><p className="text-2xl font-bold text-gray-400">{stats.archived}</p></Card>
          </div>
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><FolderInput className="h-5 w-5" />Import rapide</h3>
            <label className="block">
              <div className="h-32 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed hover:border-purple-400 cursor-pointer">
                <Upload className="h-8 w-8 text-gray-400 mb-2" /><p className="text-gray-600 text-sm">Glissez vos photos</p>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => processBulkFiles(Array.from(e.target.files || []))} />
            </label>
            {classifying && <div className="mt-4 p-4 bg-purple-50 rounded-lg flex items-center justify-center gap-3 text-purple-600"><Loader2 className="h-5 w-5 animate-spin" /><span>Classification... {importedPhotos.filter(p => p.status === 'done').length}/{importedPhotos.length}</span></div>}
            {Object.keys(classifiedGroups).length > 0 && !classifying && (
              <div className="mt-4 space-y-3">
                {Object.values(classifiedGroups).map((group, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${group.modelId ? 'border-green-200 bg-green-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {group.modelId ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-orange-600" />}
                        <span className="font-medium">{group.modelName}</span>
                        <Badge variant="outline">{group.photos.length}</Badge>
                      </div>
                      <Button size="sm" onClick={() => startReview(group.modelId, group.modelName, group.photos)}>Reviewer <ArrowRight className="h-4 w-4 ml-1" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODELS */}
      {activeTab === 'models' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Rechercher..." value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} className="pl-10" /></div>
            <Select value={modelFilter} onValueChange={(v: any) => setModelFilter(v)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="draft">Brouillons</SelectItem><SelectItem value="active">Actifs</SelectItem><SelectItem value="archived">Archivés</SelectItem></SelectContent></Select>
            <Button onClick={() => router.push('/dashboard/meters/create')}><Plus className="h-4 w-4 mr-2" />Créer</Button>
          </div>
          <Card>
            {filteredModels.length === 0 ? <div className="p-12 text-center text-gray-500"><Gauge className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>Aucun modèle</p></div> : (
              <div className="divide-y">
                {filteredModels.map(model => (
                  <div key={model.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedModelId(model.id)}>
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-2xl overflow-hidden">
                      {model.reference_photos?.[0] ? <img src={model.reference_photos[0]} className="w-full h-full object-cover" /> : METER_TYPE_ICONS[model.meter_type]}
                    </div>
                    <div className="flex-1"><p className="font-medium">{model.name}</p><p className="text-sm text-gray-500">{model.manufacturer || 'Inconnu'}</p></div>
                    <Badge variant="outline">{METER_TYPE_LABELS[model.meter_type]}</Badge>
                    {model.status === 'active' && <Badge className="bg-green-100 text-green-700">Actif</Badge>}
                    {model.status === 'draft' && <Badge className="bg-yellow-100 text-yellow-700">Brouillon</Badge>}
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Dialog open={!!selectedModelId} onOpenChange={(o) => !o && setSelectedModelId(null)}>
            <DialogContent className="max-w-2xl">
              {selectedModel && (
                <>
                  <DialogHeader><DialogTitle>{selectedModel.name}</DialogTitle><DialogDescription>{selectedModel.manufacturer}</DialogDescription></DialogHeader>
                  <div className="grid grid-cols-3 gap-2 py-4">
                    <div className="text-center p-2 bg-gray-50 rounded"><p className="text-lg font-bold">{selectedModelStats.tests}</p><p className="text-xs text-gray-500">Tests</p></div>
                    <div className="text-center p-2 bg-gray-50 rounded"><p className="text-lg font-bold text-green-600">{selectedModelStats.success}</p><p className="text-xs text-gray-500">Réussis</p></div>
                    <div className="text-center p-2 bg-gray-50 rounded"><p className="text-lg font-bold text-purple-600">{selectedModelStats.tests > 0 ? Math.round((selectedModelStats.success / selectedModelStats.tests) * 100) : 0}%</p><p className="text-xs text-gray-500">Succès</p></div>
                  </div>
                  <DialogFooter>
                    {selectedModel.status === 'active' && <Button variant="outline" onClick={() => { setSelectedModelId(null); setTestModelId(selectedModel.id); setActiveTab('tests') }}><TestTube className="h-4 w-4 mr-2" />Tester</Button>}
                    <Button onClick={() => router.push(`/dashboard/meters/${selectedModel.id}`)}><Pencil className="h-4 w-4 mr-2" />Modifier</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* TESTS */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <Card className={`flex-1 p-4 cursor-pointer ${testMode === 'single' ? 'border-purple-500 bg-purple-50' : 'hover:bg-gray-50'}`} onClick={() => setTestMode('single')}>
              <div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${testMode === 'single' ? 'bg-purple-100' : 'bg-gray-100'}`}><ImageIcon className="h-5 w-5" /></div><div><p className="font-medium">Test unitaire</p><p className="text-sm text-gray-500">Une photo à la fois</p></div></div>
            </Card>
            <Card className={`flex-1 p-4 cursor-pointer ${testMode === 'bulk' ? 'border-purple-500 bg-purple-50' : 'hover:bg-gray-50'}`} onClick={() => setTestMode('bulk')}>
              <div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${testMode === 'bulk' ? 'bg-purple-100' : 'bg-gray-100'}`}><FolderInput className="h-5 w-5" /></div><div><p className="font-medium">Import multiple</p><p className="text-sm text-gray-500">En masse</p></div></div>
            </Card>
          </div>

          {testMode === 'single' && (
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1"><Label>Modèle</Label><Select value={testModelId} onValueChange={setTestModelId}><SelectTrigger><SelectValue placeholder="Sélectionnez..." /></SelectTrigger><SelectContent>{models.filter(m => m.status === 'active').map(m => <SelectItem key={m.id} value={m.id}>{METER_TYPE_ICONS[m.meter_type]} {m.name}</SelectItem>)}</SelectContent></Select></div>
                {testModelId && <Button variant="outline" onClick={() => router.push(`/dashboard/meters/${testModelId}`)}><Eye className="h-4 w-4 mr-2" />Voir</Button>}
              </div>

              {testModelId && (
                <>
                  {/* CONFIG SELECTOR - NEW */}
                  <Card className="p-4 border-purple-200 bg-purple-50/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4" />Configuration</h3>
                      {testConfigs.length > 0 && <Badge variant="outline">{testConfigs.length} config(s)</Badge>}
                    </div>
                    <div className="space-y-3">
                      <Select value={selectedConfigId} onValueChange={(v) => { setSelectedConfigId(v); setSaveAsNewConfig(false) }}>
                        <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom"><span className="flex items-center gap-2"><Zap className="h-4 w-4" />Personnalisé</span></SelectItem>
                          {testConfigs.map((c, i) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-2">
                                {c.is_active && <Star className="h-3 w-3 text-yellow-500" />}
                                #{i + 1} - {c.name || formatTestConfig(c)}
                                {c.success_rate !== null && c.success_rate !== undefined && <span className={`ml-2 text-xs ${c.success_rate >= 70 ? 'text-green-600' : 'text-red-600'}`}>({c.success_rate}%)</span>}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedConfigId !== 'custom' ? (
                        <div className="p-3 bg-white rounded-lg border text-sm">
                          {(() => { const c = testConfigs.find(x => x.id === selectedConfigId); return c ? <div className="flex items-center gap-4"><span className={`px-2 py-1 rounded text-xs ${c.grayscale ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>{c.grayscale ? 'N&B' : 'Couleur'}</span><span>C:{c.contrast}%</span><span>N:{c.sharpness}%</span>{c.is_active && <Badge className="bg-green-100 text-green-700 ml-auto">Active</Badge>}</div> : null })()}
                        </div>
                      ) : (
                        <div className="p-3 bg-white rounded-lg border space-y-3">
                          <div className="flex items-center justify-between"><Label className="text-sm">Noir & Blanc</Label><Switch checked={testConfig.grayscale} onCheckedChange={(v) => setTestConfig({ ...testConfig, grayscale: v })} /></div>
                          <div><div className="flex justify-between mb-1"><Label className="text-sm">Contraste</Label><span className="text-xs text-gray-500">{testConfig.contrast}%</span></div><input type="range" min="-50" max="100" value={testConfig.contrast} onChange={(e) => setTestConfig({ ...testConfig, contrast: +e.target.value })} className="w-full accent-purple-600" /></div>
                          <div><div className="flex justify-between mb-1"><Label className="text-sm">Netteté</Label><span className="text-xs text-gray-500">{testConfig.sharpness}%</span></div><input type="range" min="0" max="100" value={testConfig.sharpness} onChange={(e) => setTestConfig({ ...testConfig, sharpness: +e.target.value })} className="w-full accent-purple-600" /></div>
                          <div className="pt-2 border-t">
                            <div className="flex items-center gap-2"><Checkbox id="saveConfig" checked={saveAsNewConfig} onCheckedChange={(v) => setSaveAsNewConfig(v === true)} /><Label htmlFor="saveConfig" className="text-sm cursor-pointer">Sauvegarder cette config</Label></div>
                            {saveAsNewConfig && <Input placeholder="Nom (optionnel)" value={newConfigName} onChange={(e) => setNewConfigName(e.target.value)} className="mt-2" />}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4" />Photo originale</h3>
                      {testPhotoUrl ? (
                        <div className="relative"><img src={testPhotoUrl} alt="Original" className="w-full rounded-lg border" /><Button variant="outline" size="icon" className="absolute top-2 right-2 bg-white/80" onClick={() => { setTestPhotoUrl(null); setTestPhotoFile(null); setTestResult(null) }}><RotateCcw className="h-4 w-4" /></Button></div>
                      ) : (
                        <label className="block"><div className="h-48 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed hover:border-purple-400 cursor-pointer"><Upload className="h-8 w-8 text-gray-400 mb-2" /><p className="text-sm text-gray-500">Cliquez pour uploader</p></div><input type="file" accept="image/*" className="hidden" onChange={handleSingleTestPhoto} /></label>
                      )}
                      {testPhotoUrl && <Button onClick={runSingleTest} disabled={testing} className="w-full mt-3 bg-purple-600">{testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Analyser</Button>}
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2"><Zap className="h-4 w-4" />Photo traitée<Badge variant="outline" className="ml-auto text-xs">{testConfig.grayscale ? 'N&B' : 'Couleur'} C:{testConfig.contrast}%</Badge></h3>
                      {testPhotoUrl ? <img src={testPhotoUrl} alt="Traitée" className="w-full rounded-lg border" style={{ filter: [testConfig.grayscale ? 'grayscale(100%)' : '', testConfig.contrast !== 0 ? `contrast(${100 + testConfig.contrast}%)` : ''].filter(Boolean).join(' ') || 'none' }} /> : <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg border text-gray-400 text-sm">Uploadez d'abord</div>}
                    </Card>
                  </div>

                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4" />Résultats</h3>
                    {testResult ? (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-lg ${testResult.wasCorrected ? 'bg-yellow-50 border border-yellow-200' : testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <div className="flex items-center gap-2 mb-3">
                            {testResult.wasCorrected ? <Pencil className="h-5 w-5 text-yellow-600" /> : testResult.success ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                            <span className="font-medium">{testResult.wasCorrected ? 'Corrigé' : testResult.success ? 'OK' : 'Échec'}</span>
                            <Badge variant="outline" className="ml-auto">{(testResult.confidence * 100).toFixed(0)}%</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-white rounded border"><p className="text-xs text-gray-500">N° série</p><p className="font-mono font-semibold">{testResult.extractedSerial || '-'}</p></div>
                            <div className="p-2 bg-white rounded border"><p className="text-xs text-gray-500">Index</p><p className="font-mono font-semibold">{testResult.extractedReading || '-'}</p></div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Button className="bg-green-600 hover:bg-green-700" onClick={handleValidateSingleTest} disabled={validating || rejecting}>{validating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}Valider</Button>
                          <Button variant="outline" onClick={openTestCorrectionModal} disabled={validating || rejecting}><Pencil className="h-4 w-4 mr-1" />Corriger</Button>
                          <Button variant="outline" className="text-red-600" onClick={handleRejectSingleTest} disabled={validating || rejecting}>{rejecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}Rejeter</Button>
                        </div>
                      </div>
                    ) : testPhotoUrl ? <div className="h-32 flex flex-col items-center justify-center text-gray-400"><Target className="h-8 w-8 mb-2" />Lancez l'analyse</div> : <div className="h-32 flex items-center justify-center text-gray-400">Uploadez une photo</div>}
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-4"><h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" />Historique ({experiments.length})</h3>{experiments.length > 0 && <Badge variant="outline">{experiments.filter(e => e.status === 'validated' || e.status === 'corrected').length} validés</Badge>}</div>
                    {experiments.length === 0 ? <div className="text-center py-8 text-gray-400"><TestTube className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Aucun test</p></div> : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {experiments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(exp => (
                          <div key={exp.id} className={`flex items-center gap-3 p-3 rounded-lg border ${exp.status === 'validated' ? 'bg-green-50 border-green-200' : exp.status === 'corrected' ? 'bg-yellow-50 border-yellow-200' : exp.status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}>
                            {exp.original_photo_url ? <img src={exp.original_photo_url} className="w-12 h-12 object-cover rounded" /> : <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center"><ImageIcon className="h-5 w-5 text-gray-400" /></div>}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {exp.status === 'validated' && <CheckCircle className="h-4 w-4 text-green-600" />}
                                {exp.status === 'corrected' && <Pencil className="h-4 w-4 text-yellow-600" />}
                                {exp.status === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                                <span className="font-mono text-sm">{exp.extracted_data?.serial?.value || '-'} / {exp.extracted_data?.reading?.value || '-'}</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">Config: {exp.test_config_id ? getConfigLabel(exp.test_config_id) : formatImageConfig(exp.image_config_used)}</p>
                            </div>
                            <div className="text-right text-sm"><Badge variant="outline">{((exp.confidence || 0) * 100).toFixed(0)}%</Badge><p className="text-xs text-gray-400 mt-1">{new Date(exp.created_at).toLocaleDateString('fr-FR')}</p></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </>
              )}
            </div>
          )}

          {testMode === 'bulk' && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><FolderInput className="h-5 w-5" />Import multiple</h3>
              <div className="h-48 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed hover:border-purple-400 cursor-pointer"
                onClick={() => document.getElementById('bulk-input')?.click()}
                onDragOver={(e) => { e.preventDefault() }}
                onDrop={async (e) => { e.preventDefault(); await processBulkFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))) }}>
                <Upload className="h-12 w-12 text-gray-400 mb-3" /><p className="text-gray-600">Glissez vos photos</p>
              </div>
              <input id="bulk-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => processBulkFiles(Array.from(e.target.files || []))} />
              {classifying && <div className="mt-4 p-4 bg-purple-50 rounded-lg flex items-center justify-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-purple-600" /><span>Classification... {importedPhotos.filter(p => p.status === 'done').length}/{importedPhotos.length}</span></div>}
              {Object.keys(classifiedGroups).length > 0 && !classifying && (
                <div className="mt-4 space-y-3">
                  {Object.values(classifiedGroups).map((g, i) => (
                    <div key={i} className={`p-4 rounded-lg border ${g.modelId ? 'border-green-200 bg-green-50/30' : 'border-orange-200 bg-orange-50/30'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">{g.modelId ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-orange-600" />}<span className="font-medium">{g.modelName}</span><Badge variant="outline">{g.photos.length}</Badge></div>
                        {g.modelId && <Button onClick={() => startReview(g.modelId, g.modelName, g.photos)}>Reviewer <ArrowRight className="h-4 w-4 ml-1" /></Button>}
                      </div>
                      <div className="flex gap-2 overflow-x-auto">{g.photos.slice(0,8).map(p => <img key={p.id} src={p.url} className="h-16 w-16 object-cover rounded-lg border shrink-0" />)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* VERSIONS */}
      {activeTab === 'versions' && (
        <div className="space-y-6">
          {activeVersion && (
            <Card className="p-6 border-2 border-purple-200 bg-purple-50/30">
              <div className="flex items-start justify-between">
                <div><h3 className="font-semibold flex items-center gap-2 text-lg"><Star className="h-5 w-5 text-yellow-500" />Version active</h3><p className="text-2xl font-bold mt-2">{activeVersion.display_name}</p></div>
                <Badge className={activeVersion.status === 'stable' ? 'bg-green-600' : 'bg-yellow-600'}>{activeVersion.status}</Badge>
              </div>
            </Card>
          )}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><History className="h-5 w-5" />Historique</h3>
            {versions.length > 0 ? (
              <div className="space-y-3">
                {versions.map(v => (
                  <div key={v.id} className={`p-4 rounded-lg border ${v.is_default ? 'border-purple-200 bg-purple-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div><p className="font-semibold">{v.display_name}</p><p className="text-sm text-gray-500">{new Date(v.created_at).toLocaleDateString('fr-FR')}</p></div>
                      {v.is_default ? <Badge className="bg-purple-600">Active</Badge> : <Button size="sm" variant="outline">Activer</Button>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-8 text-gray-500">Aucune version</p>}
          </Card>
        </div>
      )}

      {/* Correction Modal */}
      <Dialog open={showTestCorrectionModal} onOpenChange={setShowTestCorrectionModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Corriger les valeurs</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>N° série</Label><Input value={testCorrectionSerial} onChange={(e) => setTestCorrectionSerial(e.target.value)} className="font-mono" /></div>
            <div><Label>Index</Label><Input value={testCorrectionReading} onChange={(e) => setTestCorrectionReading(e.target.value)} className="font-mono" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowTestCorrectionModal(false)}>Annuler</Button><Button onClick={applyTestCorrection} className="bg-purple-600"><Check className="h-4 w-4 mr-2" />Appliquer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
