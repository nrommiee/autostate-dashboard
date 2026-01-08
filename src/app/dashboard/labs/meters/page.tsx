'use client'

import { useEffect, useState, useCallback } from 'react'
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
  Upload, Play, Check, X, RotateCcw, Loader2, CheckCircle, XCircle, 
  Zap, ImageIcon, TrendingUp, FlaskConical, BarChart3, Target, Star, Lightbulb, 
  Image as ImageIconLucide, Rocket, DollarSign, AlertTriangle, Camera,
  Activity, History, FileText, CheckCircle2, AlertCircle, Pencil, 
  FolderInput, Trash2, ArrowRight, ArrowLeft, Plus, Gauge, Eye, 
  LayoutDashboard, Box, TestTube, GitBranch, ChevronLeft, ChevronRight,
  Keyboard, Search, Filter
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { calculateCost, formatCost } from '@/lib/image-analysis'

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
  auto_crop: boolean
  max_dimension: number
  jpeg_quality: number
}

interface LabExperiment {
  id: string
  meter_model_id: string
  photo_url: string | null
  status: 'pending' | 'validated' | 'corrected' | 'rejected'
  extracted_data: Record<string, { value: string; confidence: number }>
  corrected_data: Record<string, string> | null
  confidence: number
  tokens_input: number
  tokens_output: number
  image_config_used: ImageConfig
  created_at: string
  expires_at: string
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
    if (testModelId) loadModelExperiments(testModelId)
  }, [testModelId])

  useEffect(() => {
    if (selectedModelId) loadModelStats(selectedModelId)
  }, [selectedModelId])

  async function loadModelStats(modelId: string) {
    const { data } = await supabase
      .from('labs_experiments')
      .select('status')
      .eq('meter_model_id', modelId)
    
    setSelectedModelStats({
      tests: data?.length || 0,
      success: data?.filter(e => e.status === 'validated' || e.status === 'corrected').length || 0
    })
  }

  async function loadData() {
    setLoading(true)
    try {
      const [modelsRes, versionsRes, allExperimentsRes] = await Promise.all([
        supabase.from('meter_models').select('*').order('name'),
        supabase.from('recognition_versions').select('*').order('created_at', { ascending: false }),
        supabase.from('labs_experiments')
          .select('*')
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      ])
      if (modelsRes.data) setModels(modelsRes.data)
      if (versionsRes.data) setVersions(versionsRes.data)
      if (allExperimentsRes.data && !testModelId) setExperiments(allExperimentsRes.data)
    } catch (err) { console.error('Error loading data:', err) }
    setLoading(false)
  }

  async function loadModelExperiments(modelId: string) {
    const { data } = await supabase
      .from('labs_experiments')
      .select('*')
      .eq('meter_model_id', modelId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setExperiments(data)
  }

  const stats = {
    total: models.length,
    draft: models.filter(m => m.status === 'draft').length,
    active: models.filter(m => m.status === 'active').length,
    archived: models.filter(m => m.status === 'archived').length,
    totalScans: models.reduce((acc, m) => acc + (m.total_scans || 0), 0),
    successRate: models.reduce((acc, m) => acc + (m.success_count || 0), 0) / 
      Math.max(models.reduce((acc, m) => acc + (m.total_scans || 0), 0), 1) * 100
  }

  const filteredModels = models.filter(m => {
    if (modelFilter !== 'all' && m.status !== modelFilter) return false
    if (modelSearch) {
      const search = modelSearch.toLowerCase()
      return m.name.toLowerCase().includes(search) || m.manufacturer?.toLowerCase().includes(search)
    }
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

  function formatImageConfig(config: ImageConfig | null): string {
    if (!config) return 'Configuration par défaut'
    const parts = []
    parts.push(config.grayscale ? 'N&B' : 'Couleur')
    if (config.contrast !== undefined && config.contrast !== 0) parts.push(`C:${config.contrast > 0 ? '+' : ''}${config.contrast}%`)
    if (config.sharpness !== undefined && config.sharpness !== 0) parts.push(`N:${config.sharpness}%`)
    return parts.join(' • ')
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
        if (!ctx) { URL.revokeObjectURL(objectUrl); reject(new Error('Could not get canvas context')); return }
        ctx.drawImage(img, 0, 0, width, height)
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
        URL.revokeObjectURL(objectUrl)
        resolve(base64)
      }
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')) }
      img.src = objectUrl
    })
  }

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
        } else {
          photo.status = 'error'
          photo.error = response.status === 413 ? 'Photo trop grande' : `Erreur API: ${response.status}`
        }
      } catch (err: any) { photo.status = 'error'; photo.error = err.message || 'Erreur inconnue' }
      setImportedPhotos([...newPhotos])
    }
    setClassifying(false)
  }

  async function handleBulkImport(e: React.ChangeEvent<HTMLInputElement>) {
    await processBulkFiles(Array.from(e.target.files || []))
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

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        if (result) resolve(result.split(',')[1])
        else reject(new Error('FileReader returned empty result'))
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  async function reviewValidate() {
    if (!reviewSession) return
    const photo = reviewSession.photos[reviewSession.currentIndex]
    if (!photo.matchedModelId) { alert('Veuillez d\'abord assigner cette photo à un modèle.'); return }
    try {
      const base64 = await fileToBase64(photo.file)
      await fetch('/api/labs/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_model_id: photo.matchedModelId, photo_base64: base64, extracted_data: photo.extractedData,
          corrected_data: null, confidence: photo.confidence, status: 'validated', image_config_used: testConfig
        })
      })
      photo.status = 'done'; setImportedPhotos([...importedPhotos])
    } catch (err) { console.error('Error saving validation:', err) }
    if (reviewSession.currentIndex >= reviewSession.photos.length - 1) { setReviewSession(null); loadData() }
    else reviewNext()
  }

  async function reviewReject() {
    if (!reviewSession) return
    const photo = reviewSession.photos[reviewSession.currentIndex]
    if (!photo.matchedModelId) {
      const updatedPhotos = reviewSession.photos.filter(p => p.id !== photo.id)
      if (updatedPhotos.length === 0) setReviewSession(null)
      else setReviewSession({ ...reviewSession, photos: updatedPhotos, currentIndex: Math.min(reviewSession.currentIndex, updatedPhotos.length - 1) })
      return
    }
    try {
      const base64 = await fileToBase64(photo.file)
      await fetch('/api/labs/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_model_id: photo.matchedModelId, photo_base64: base64, extracted_data: photo.extractedData,
          corrected_data: null, confidence: photo.confidence, status: 'rejected', image_config_used: testConfig
        })
      })
    } catch (err) { console.error('Error saving rejection:', err) }
    if (reviewSession.currentIndex >= reviewSession.photos.length - 1) { setReviewSession(null); loadData() }
    else reviewNext()
  }

  function reviewOpenCorrection() {
    if (!reviewSession) return
    const photo = reviewSession.photos[reviewSession.currentIndex]
    const data: Record<string, string> = {}
    if (photo.extractedData) Object.entries(photo.extractedData).forEach(([key, val]) => { data[key] = val.value })
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
          corrected_data: correctionData, confidence: photo.confidence, status: 'corrected', image_config_used: testConfig
        })
      })
    } catch (err) { console.error('Error saving correction:', err) }
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

  useEffect(() => {
    if (testModelId) {
      const model = models.find(m => m.id === testModelId)
      if (model?.image_config_overrides) setTestConfig(model.image_config_overrides)
      else setTestConfig(DEFAULT_CONFIG)
    }
  }, [testModelId, models])

  async function handleSingleTestPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (testPhotoUrl) URL.revokeObjectURL(testPhotoUrl)
    setTestPhotoFile(file); setTestPhotoUrl(URL.createObjectURL(file)); setTestResult(null)
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
        if (!ctx) { URL.revokeObjectURL(objectUrl); reject(new Error('Could not get canvas context')); return }
        const filters: string[] = []
        if (testConfig.grayscale) filters.push('grayscale(100%)')
        if (testConfig.contrast !== 0) filters.push(`contrast(${100 + testConfig.contrast}%)`)
        if (testConfig.brightness !== 0) filters.push(`brightness(${100 + testConfig.brightness}%)`)
        ctx.filter = filters.length > 0 ? filters.join(' ') : 'none'
        ctx.drawImage(img, 0, 0, width, height)
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
        URL.revokeObjectURL(objectUrl)
        resolve(base64)
      }
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')) }
      img.src = objectUrl
    })
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
          confidence: testResult.confidence, status: wasCorrected ? 'corrected' : 'validated', image_config_used: testConfig
        })
      })
      setTestPhotoUrl(null); setTestPhotoFile(null); setTestResult(null)
      await loadModelExperiments(testModelId)
    } catch (err) { console.error('Error validating test:', err) }
    setValidating(false)
  }

  async function handleRejectSingleTest() {
    if (!testPhotoFile || !testModelId) return
    setRejecting(true)
    try {
      const base64 = await fileToBase64(testPhotoFile)
      await fetch('/api/labs/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_model_id: testModelId, photo_base64: base64,
          extracted_data: testResult ? {
            serial: { value: testResult.extractedSerial, confidence: testResult.confidence },
            reading: { value: testResult.extractedReading, confidence: testResult.confidence }
          } : {},
          corrected_data: null, confidence: testResult?.confidence || 0, status: 'rejected', image_config_used: testConfig
        })
      })
      setTestPhotoUrl(null); setTestPhotoFile(null); setTestResult(null)
      await loadModelExperiments(testModelId)
    } catch (err) { console.error('Error rejecting test:', err) }
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
            <p className="text-sm text-gray-500">{reviewSession.currentIndex + 1} / {reviewSession.photos.length} photos</p>
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
            <img src={currentPhoto.url} alt="Photo de test" className="max-h-full max-w-full object-contain rounded-lg shadow-lg" />
          </div>
          <div className="w-96 border-l p-6 flex flex-col">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Zap className="h-5 w-5" />Résultat IA</h3>
            {currentPhoto.extractedData && Object.keys(currentPhoto.extractedData).length > 0 ? (
              <div className="space-y-4 flex-1">
                {currentPhoto.extractedData.serial && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-600 font-medium mb-1">N° SÉRIE</p>
                    <p className="text-2xl font-mono font-bold text-blue-900">{currentPhoto.extractedData.serial.value}</p>
                    <p className="text-xs text-blue-500 mt-1">Confiance: {(currentPhoto.extractedData.serial.confidence * 100).toFixed(0)}%</p>
                  </div>
                )}
                {currentPhoto.extractedData.reading && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs text-green-600 font-medium mb-1">INDEX</p>
                    <p className="text-2xl font-mono font-bold text-green-900">{currentPhoto.extractedData.reading.value}</p>
                    <p className="text-xs text-green-500 mt-1">Confiance: {(currentPhoto.extractedData.reading.confidence * 100).toFixed(0)}%</p>
                  </div>
                )}
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Confiance globale</p>
                  <div className="flex items-center gap-2">
                    <Progress value={currentPhoto.confidence * 100} className="flex-1" />
                    <span className="font-semibold">{(currentPhoto.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <AlertTriangle className="h-12 w-12 mb-3 text-orange-400" />
                <p className="font-medium text-gray-600">Aucune donnée extraite</p>
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
                    <span><Keyboard className="h-3 w-3 inline mr-1" />←→ Navigation</span>
                    <span>V Valider</span><span>C Corriger</span><span>R Rejeter</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-orange-50 rounded-lg text-sm text-orange-700 mb-3">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />Ce compteur n'a pas été reconnu.
                  </div>
                  <div className="space-y-2">
                    <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => { sessionStorage.setItem('newModelPhoto', currentPhoto.url); router.push('/dashboard/meters/create') }}>
                      <Plus className="h-4 w-4 mr-2" />Créer un nouveau modèle
                    </Button>
                    <Select onValueChange={(modelId) => {
                      const sel = models.find(m => m.id === modelId)
                      if (sel) { currentPhoto.matchedModelId = modelId; currentPhoto.matchedModelName = sel.name; setImportedPhotos([...importedPhotos]) }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Ou assigner à un modèle existant..." /></SelectTrigger>
                      <SelectContent>
                        {models.filter(m => m.status === 'active').map(m => <SelectItem key={m.id} value={m.id}>{METER_TYPE_ICONS[m.meter_type]} {m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" className="w-full text-red-600" onClick={reviewReject}><X className="h-4 w-4 mr-2" />Ignorer</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Corriger les valeurs</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              {zones.map(zone => (
                <div key={zone.id}>
                  <Label>{zone.label}</Label>
                  <Input value={correctionData[zone.id] || ''} onChange={(e) => setCorrectionData({ ...correctionData, [zone.id]: e.target.value })} className="font-mono" />
                </div>
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
          <div>
            <h1 className="text-2xl font-bold text-white">Vision Compteurs</h1>
            <p className="text-purple-200">Reconnaissance automatique des index de compteurs</p>
          </div>
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

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Total modèles</p><p className="text-2xl font-bold">{stats.total}</p></Card>
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Brouillons</p><p className="text-2xl font-bold text-yellow-600">{stats.draft}</p></Card>
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Actifs</p><p className="text-2xl font-bold text-green-600">{stats.active}</p></Card>
            <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Archivés</p><p className="text-2xl font-bold text-gray-400">{stats.archived}</p></Card>
            <Card className="p-4 bg-purple-50 border-purple-200"><p className="text-xs text-purple-600 mb-1">Coût Labs (mois)</p>
              <p className="text-2xl font-bold text-purple-700">${((experiments.reduce((acc, e) => acc + (e.tokens_input || 0) + (e.tokens_output || 0), 0) / 1000000) * 3).toFixed(2)}</p>
            </Card>
          </div>
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><FolderInput className="h-5 w-5" />Import & Tri rapide</h3>
            <label className="block">
              <div className="h-32 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed hover:border-purple-400 hover:bg-purple-50 cursor-pointer">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <p className="text-gray-600 text-sm">Glissez-déposez vos photos de compteurs</p>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleBulkImport} />
            </label>
            {classifying && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg flex items-center justify-center gap-3 text-purple-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Classification... {importedPhotos.filter(p => p.status === 'done').length}/{importedPhotos.length}</span>
              </div>
            )}
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
                    <div className="flex gap-1 overflow-x-auto">
                      {group.photos.slice(0, 8).map(photo => <img key={photo.id} src={photo.url} className="h-12 w-12 object-cover rounded" />)}
                      {group.photos.length > 8 && <div className="h-12 w-12 flex items-center justify-center bg-gray-200 rounded text-xs">+{group.photos.length - 8}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="h-5 w-5" />Activité récente</h3>
            <div className="text-center py-8 text-gray-500"><Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>Aucune activité récente</p></div>
          </Card>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Rechercher un modèle..." value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={modelFilter} onValueChange={(v: any) => setModelFilter(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="archived">Archivés</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => router.push('/dashboard/meters/create')}><Plus className="h-4 w-4 mr-2" />Créer un modèle</Button>
          </div>
          <Card>
            {filteredModels.length === 0 ? (
              <div className="p-12 text-center text-gray-500"><Gauge className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>Aucun modèle trouvé</p></div>
            ) : (
              <div className="divide-y">
                {filteredModels.map(model => (
                  <div key={model.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedModelId(model.id)}>
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                      {model.reference_photos?.[0] ? <img src={model.reference_photos[0]} className="w-full h-full object-cover rounded-lg" /> : METER_TYPE_ICONS[model.meter_type] || '📊'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{model.name}</p>
                      <p className="text-sm text-gray-500">{model.manufacturer || 'Fabricant inconnu'}</p>
                    </div>
                    <Badge variant="outline" className="gap-1">{METER_TYPE_ICONS[model.meter_type]} {METER_TYPE_LABELS[model.meter_type]}</Badge>
                    {model.status === 'draft' && <Badge className="bg-yellow-100 text-yellow-700">Brouillon</Badge>}
                    {model.status === 'active' && <Badge className="bg-green-100 text-green-700">Actif</Badge>}
                    {model.status === 'archived' && <Badge className="bg-gray-100 text-gray-600">Archivé</Badge>}
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Dialog open={!!selectedModelId} onOpenChange={(open) => !open && setSelectedModelId(null)}>
            <DialogContent className="max-w-2xl">
              {selectedModel && (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{METER_TYPE_ICONS[selectedModel.meter_type]}</span>
                      <div>
                        <DialogTitle>{selectedModel.name}</DialogTitle>
                        <DialogDescription>{selectedModel.manufacturer} • {METER_TYPE_LABELS[selectedModel.meter_type]}</DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex gap-4">
                      <div className="w-32 h-32 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                        {selectedModel.reference_photos?.[0] ? <img src={selectedModel.reference_photos[0]} className="w-full h-full object-cover" alt={selectedModel.name} />
                          : <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400">{METER_TYPE_ICONS[selectedModel.meter_type] || '📊'}</div>}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          {selectedModel.status === 'draft' && <Badge className="bg-yellow-100 text-yellow-700">Brouillon</Badge>}
                          {selectedModel.status === 'active' && <Badge className="bg-green-100 text-green-700">Actif</Badge>}
                          {selectedModel.status === 'archived' && <Badge className="bg-gray-100 text-gray-600">Archivé</Badge>}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-lg font-bold">{selectedModelStats.tests}</p>
                            <p className="text-xs text-gray-500">Tests</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-lg font-bold text-green-600">{selectedModelStats.success}</p>
                            <p className="text-xs text-gray-500">Réussis</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-lg font-bold text-purple-600">{selectedModelStats.tests > 0 ? Math.round((selectedModelStats.success / selectedModelStats.tests) * 100) : 0}%</p>
                            <p className="text-xs text-gray-500">Succès</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="flex items-center gap-2"><FileText className="h-4 w-4" />Prompt de reconnaissance</Label>
                        <Badge variant="outline" className="text-xs">Auto-généré</Badge>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg text-sm font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">{selectedModel.ai_description || 'Aucun prompt défini'}</div>
                    </div>
                    <div>
                      <Label className="flex items-center gap-2 mb-2"><Zap className="h-4 w-4" />Configuration image active</Label>
                      <div className="p-3 bg-gray-50 rounded-lg"><p className="font-mono text-sm">{formatImageConfig(selectedModel.image_config_overrides)}</p></div>
                    </div>
                  </div>
                  <DialogFooter>
                    {selectedModel.status === 'active' ? (
                      <Button variant="outline" onClick={() => { setSelectedModelId(null); setTestModelId(selectedModel.id); setTestMode('single'); setActiveTab('tests') }}>
                        <TestTube className="h-4 w-4 mr-2" />Tester dans Labs
                      </Button>
                    ) : <p className="text-sm text-gray-500 mr-auto">Activez ce modèle pour le tester</p>}
                    <Button onClick={() => router.push(`/dashboard/meters/${selectedModel.id}`)}><Pencil className="h-4 w-4 mr-2" />Modifier</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <Card className={`flex-1 p-4 cursor-pointer transition-colors ${testMode === 'single' ? 'border-purple-500 bg-purple-50' : 'hover:bg-gray-50'}`} onClick={() => setTestMode('single')}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${testMode === 'single' ? 'bg-purple-100' : 'bg-gray-100'}`}><ImageIcon className="h-5 w-5" /></div>
                <div><p className="font-medium">Test unitaire</p><p className="text-sm text-gray-500">Tester une photo à la fois</p></div>
              </div>
            </Card>
            <Card className={`flex-1 p-4 cursor-pointer transition-colors ${testMode === 'bulk' ? 'border-purple-500 bg-purple-50' : 'hover:bg-gray-50'}`} onClick={() => setTestMode('bulk')}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${testMode === 'bulk' ? 'bg-purple-100' : 'bg-gray-100'}`}><FolderInput className="h-5 w-5" /></div>
                <div><p className="font-medium">Import multiple</p><p className="text-sm text-gray-500">Importer et reviewer en masse</p></div>
              </div>
            </Card>
          </div>

          {testMode === 'single' && (
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>Modèle de compteur (actifs uniquement)</Label>
                  <Select value={testModelId} onValueChange={setTestModelId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionnez un modèle actif..." /></SelectTrigger>
                    <SelectContent>
                      {models.filter(m => m.status === 'active').map(m => <SelectItem key={m.id} value={m.id}>{METER_TYPE_ICONS[m.meter_type]} {m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {testModelId && <Button variant="outline" onClick={() => router.push(`/dashboard/meters/${testModelId}`)} className="shrink-0"><Eye className="h-4 w-4 mr-2" />Voir le modèle</Button>}
              </div>

              {testModelId && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4" />Photo originale</h3>
                      {testPhotoUrl ? (
                        <div className="relative">
                          <img src={testPhotoUrl} alt="Original" className="w-full rounded-lg border" />
                          <Button variant="outline" size="icon" className="absolute top-2 right-2 bg-white/80" onClick={() => { setTestPhotoUrl(null); setTestPhotoFile(null); setTestResult(null) }}><RotateCcw className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <label className="block">
                          <div className="h-48 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed hover:border-purple-400 cursor-pointer">
                            <Upload className="h-8 w-8 text-gray-400 mb-2" /><p className="text-sm text-gray-500">Cliquez pour uploader</p>
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={handleSingleTestPhoto} />
                        </label>
                      )}
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4" />Photo traitée
                        {(testConfig.grayscale || testConfig.contrast !== 0 || testConfig.brightness !== 0) && (
                          <Badge variant="outline" className="ml-auto text-xs">
                            {[testConfig.grayscale && 'N&B', testConfig.contrast !== 0 && `C:${testConfig.contrast > 0 ? '+' : ''}${testConfig.contrast}%`, testConfig.brightness !== 0 && `L:${testConfig.brightness > 0 ? '+' : ''}${testConfig.brightness}%`].filter(Boolean).join(' ')}
                          </Badge>
                        )}
                      </h3>
                      {testPhotoUrl ? (
                        <img src={testPhotoUrl} alt="Traitée" className="w-full rounded-lg border"
                          style={{ filter: [testConfig.grayscale ? 'grayscale(100%)' : '', testConfig.contrast !== 0 ? `contrast(${100 + testConfig.contrast}%)` : '', testConfig.brightness !== 0 ? `brightness(${100 + testConfig.brightness}%)` : ''].filter(Boolean).join(' ') || 'none' }} />
                      ) : <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg border text-gray-400 text-sm">Uploadez d'abord une photo</div>}
                    </Card>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2"><Zap className="h-4 w-4" />Traitement image</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between"><Label>Noir & Blanc</Label><Switch checked={testConfig.grayscale} onCheckedChange={(v) => setTestConfig({ ...testConfig, grayscale: v })} /></div>
                        <div>
                          <div className="flex justify-between mb-1"><Label className="text-sm">Contraste</Label><span className="text-xs text-gray-500">{testConfig.contrast > 0 ? '+' : ''}{testConfig.contrast}%</span></div>
                          <input type="range" min="-50" max="100" value={testConfig.contrast} onChange={(e) => setTestConfig({ ...testConfig, contrast: +e.target.value })} className="w-full accent-purple-600" />
                        </div>
                        <div>
                          <div className="flex justify-between mb-1"><Label className="text-sm">Netteté</Label><span className="text-xs text-gray-500">{testConfig.sharpness}%</span></div>
                          <input type="range" min="0" max="100" value={testConfig.sharpness} onChange={(e) => setTestConfig({ ...testConfig, sharpness: +e.target.value })} className="w-full accent-purple-600" />
                        </div>
                        {testPhotoUrl && <Button onClick={runSingleTest} disabled={testing} className="w-full mt-2 bg-purple-600">{testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Lancer l'analyse</Button>}
                      </div>
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4" />Résultats IA</h3>
                      {testResult ? (
                        <div className="space-y-4">
                          <div className={`p-4 rounded-lg ${testResult.wasCorrected ? 'bg-yellow-50 border border-yellow-200' : testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-center gap-2 mb-3">
                              {testResult.wasCorrected ? <Pencil className="h-5 w-5 text-yellow-600" /> : testResult.success ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                              <span className="font-medium">{testResult.wasCorrected ? 'Corrigé' : testResult.success ? 'Reconnu' : 'Échec'}</span>
                              <Badge variant="outline" className="ml-auto">{(testResult.confidence * 100).toFixed(0)}%</Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="p-2 bg-white rounded border">
                                <p className="text-xs text-gray-500">N° série {testResult.wasCorrected && '(corrigé)'}</p>
                                <p className="font-mono font-semibold">{testResult.extractedSerial || '-'}</p>
                                {testResult.wasCorrected && testResult.originalSerial && <p className="text-xs text-gray-400 line-through">{testResult.originalSerial}</p>}
                              </div>
                              <div className="p-2 bg-white rounded border">
                                <p className="text-xs text-gray-500">Index {testResult.wasCorrected && '(corrigé)'}</p>
                                <p className="font-mono font-semibold">{testResult.extractedReading || '-'}</p>
                                {testResult.wasCorrected && testResult.originalReading && <p className="text-xs text-gray-400 line-through">{testResult.originalReading}</p>}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Button className="bg-green-600 hover:bg-green-700" onClick={handleValidateSingleTest} disabled={validating || rejecting}>
                              {validating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}{testResult.wasCorrected ? 'Valider' : 'Valider'}
                            </Button>
                            <Button variant="outline" onClick={openTestCorrectionModal} disabled={validating || rejecting}><Pencil className="h-4 w-4 mr-1" />Corriger</Button>
                            <Button variant="outline" className="text-red-600" onClick={handleRejectSingleTest} disabled={validating || rejecting}>
                              {rejecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}Rejeter
                            </Button>
                          </div>
                        </div>
                      ) : testPhotoUrl ? (
                        <div className="h-32 flex flex-col items-center justify-center text-gray-400 text-sm"><Target className="h-8 w-8 mb-2" />Lancez l'analyse</div>
                      ) : <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Uploadez une photo</div>}
                    </Card>
                  </div>
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" />Historique des tests ({experiments.length})</h3>
                      {experiments.length > 0 && <Badge variant="outline">{experiments.filter(e => e.status === 'validated' || e.status === 'corrected').length} validés / {experiments.filter(e => e.status === 'rejected').length} rejetés</Badge>}
                    </div>
                    {experiments.length === 0 ? (
                      <div className="text-center py-8 text-gray-400"><TestTube className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Aucun test pour ce modèle</p></div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {[...experiments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(exp => (
                          <div key={exp.id} className={`flex items-center gap-3 p-3 rounded-lg border ${exp.status === 'validated' ? 'bg-green-50 border-green-200' : exp.status === 'corrected' ? 'bg-yellow-50 border-yellow-200' : exp.status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                            {exp.photo_url ? <img src={exp.photo_url} className="w-12 h-12 object-cover rounded" /> : <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center"><ImageIcon className="h-5 w-5 text-gray-400" /></div>}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {exp.status === 'validated' && <CheckCircle className="h-4 w-4 text-green-600" />}
                                {exp.status === 'corrected' && <Pencil className="h-4 w-4 text-yellow-600" />}
                                {exp.status === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                                <span className="font-mono text-sm">{exp.extracted_data?.serial?.value || '-'} / {exp.extracted_data?.reading?.value || '-'}</span>
                              </div>
                              {exp.corrected_data && <p className="text-xs text-yellow-600 mt-1">Corrigé: {exp.corrected_data.serial || '-'} / {exp.corrected_data.reading || '-'}</p>}
                            </div>
                            <div className="text-right text-sm">
                              <Badge variant="outline" className="mb-1">{(exp.confidence * 100).toFixed(0)}%</Badge>
                              <p className="text-xs text-gray-400">{new Date(exp.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </div>
          )}

          {testMode === 'bulk' && (
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><FolderInput className="h-5 w-5" />Import multiple</h3>
                <div className="h-48 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed hover:border-purple-400 hover:bg-purple-50 cursor-pointer"
                  onClick={() => document.getElementById('bulk-file-input')?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={async (e) => { e.preventDefault(); e.stopPropagation(); await processBulkFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))) }}>
                  <Upload className="h-12 w-12 text-gray-400 mb-3" /><p className="text-gray-600 font-medium">Glissez-déposez vos photos</p>
                </div>
                <input id="bulk-file-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => processBulkFiles(Array.from(e.target.files || []))} />
              </Card>
              {classifying && (
                <Card className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><span className="font-medium">Classification...</span><span className="text-purple-600 font-semibold">{importedPhotos.filter(p => p.status === 'done' || p.status === 'error').length}/{importedPhotos.length}</span></div>
                    <Progress value={(importedPhotos.filter(p => p.status === 'done' || p.status === 'error').length / importedPhotos.length) * 100} className="h-2" />
                  </div>
                </Card>
              )}
              {Object.keys(classifiedGroups).length > 0 && !classifying && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" />Résultats ({importedPhotos.length} photos)</h3>
                  {Object.values(classifiedGroups).map((group, idx) => (
                    <Card key={idx} className={`p-4 ${group.modelId ? 'border-green-200 bg-green-50/30' : 'border-orange-200 bg-orange-50/30'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {group.modelId ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-orange-600" />}
                          <span className="font-medium">{group.modelName}</span><Badge variant="outline">{group.photos.length} photos</Badge>
                        </div>
                        {group.modelId && <Button onClick={() => startReview(group.modelId, group.modelName, group.photos)}>Reviewer <ArrowRight className="h-4 w-4 ml-1" /></Button>}
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {group.photos.map(photo => <img key={photo.id} src={photo.url} className="h-16 w-16 object-cover rounded-lg border shrink-0" />)}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'versions' && (
        <div className="space-y-6">
          {activeVersion && (
            <Card className="p-6 border-2 border-purple-200 bg-purple-50/30">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2 text-lg"><Star className="h-5 w-5 text-yellow-500" />Version active</h3>
                  <p className="text-2xl font-bold mt-2">{activeVersion.display_name}</p>
                  <p className="text-sm text-gray-500 mt-1">{activeVersion.description || 'Aucune description'}</p>
                </div>
                <Badge className={activeVersion.status === 'stable' ? 'bg-green-600' : activeVersion.status === 'development' ? 'bg-yellow-600' : 'bg-gray-600'}>{activeVersion.status}</Badge>
              </div>
              <div className="mt-4 p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Configuration par défaut</p>
                <p className="font-mono">{formatImageConfig(activeVersion.default_image_config)}</p>
              </div>
            </Card>
          )}
          {stats.draft > 0 && (
            <Card className="p-4 border-yellow-200 bg-yellow-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div><p className="font-medium text-yellow-800">{stats.draft} modèle(s) en brouillon</p><p className="text-sm text-yellow-700 mt-1">Ces modèles ne sont pas encore inclus dans la version active.</p></div>
              </div>
            </Card>
          )}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><History className="h-5 w-5" />Historique des versions</h3>
            {versions.length > 0 ? (
              <div className="space-y-3">
                {versions.map((v) => (
                  <div key={v.id} className={`p-4 rounded-lg border ${v.is_default ? 'border-purple-200 bg-purple-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div><p className="font-semibold">{v.display_name}</p><p className="text-sm text-gray-500">{new Date(v.created_at).toLocaleDateString('fr-FR')}</p></div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={v.status === 'stable' ? 'bg-green-50 text-green-700' : v.status === 'development' ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50'}>{v.status}</Badge>
                        {v.is_default ? <Badge className="bg-purple-600">Active</Badge> : <Button size="sm" variant="outline">Activer</Button>}
                      </div>
                    </div>
                    {v.changelog && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{v.changelog}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-center py-8 text-gray-500">Aucune version</p>}
          </Card>
        </div>
      )}

      <Dialog open={showTestCorrectionModal} onOpenChange={setShowTestCorrectionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corriger les valeurs extraites</DialogTitle>
            <DialogDescription>Modifiez les valeurs puis cliquez sur Appliquer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>N° série</Label>
              <Input value={testCorrectionSerial} onChange={(e) => setTestCorrectionSerial(e.target.value)} className="font-mono" placeholder="Ex: 22004338530" />
              {testResult?.originalSerial && <p className="text-xs text-gray-400 mt-1">Valeur IA: {testResult.originalSerial}</p>}
            </div>
            <div>
              <Label>Index</Label>
              <Input value={testCorrectionReading} onChange={(e) => setTestCorrectionReading(e.target.value)} className="font-mono" placeholder="Ex: 00374.805" />
              {testResult?.originalReading && <p className="text-xs text-gray-400 mt-1">Valeur IA: {testResult.originalReading}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestCorrectionModal(false)}>Annuler</Button>
            <Button onClick={applyTestCorrection} className="bg-purple-600 hover:bg-purple-700"><Check className="h-4 w-4 mr-2" />Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
