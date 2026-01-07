'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// CONSTANTS
// ============================================================================

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LabsMetersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Main state
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'tests' | 'versions'>('overview')
  const [loading, setLoading] = useState(true)
  const [models, setModels] = useState<MeterModel[]>([])
  const [versions, setVersions] = useState<RecognitionVersion[]>([])
  const [experiments, setExperiments] = useState<LabExperiment[]>([])
  
  // Models tab
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [modelSearch, setModelSearch] = useState('')
  const [modelFilter, setModelFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all')
  
  // Tests tab
  const [testMode, setTestMode] = useState<'single' | 'bulk'>('single')
  const [testModelId, setTestModelId] = useState<string>('')
  const [importedPhotos, setImportedPhotos] = useState<ImportedPhoto[]>([])
  const [classifying, setClassifying] = useState(false)
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null)
  
  // Single test state
  const [testPhotoFile, setTestPhotoFile] = useState<File | null>(null)
  const [testPhotoUrl, setTestPhotoUrl] = useState<string | null>(null)
  const [testProcessedUrl, setTestProcessedUrl] = useState<string | null>(null)
  const [testConfig, setTestConfig] = useState<ImageConfig>(DEFAULT_CONFIG)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  
  // Correction modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [correctionData, setCorrectionData] = useState<Record<string, string>>({})
  const [correctionPhotoId, setCorrectionPhotoId] = useState<string | null>(null)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [modelsRes, versionsRes] = await Promise.all([
        supabase.from('meter_models').select('*').order('name'),
        supabase.from('recognition_versions').select('*').order('created_at', { ascending: false })
      ])
      
      if (modelsRes.data) setModels(modelsRes.data)
      if (versionsRes.data) setVersions(versionsRes.data)
    } catch (err) {
      console.error('Error loading data:', err)
    }
    setLoading(false)
  }

  async function loadModelExperiments(modelId: string) {
    const { data } = await supabase
      .from('lab_experiments')
      .select('*')
      .eq('meter_model_id', modelId)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (data) setExperiments(data)
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

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
      return m.name.toLowerCase().includes(search) || 
             m.manufacturer?.toLowerCase().includes(search)
    }
    return true
  })

  const selectedModel = models.find(m => m.id === selectedModelId)
  const activeVersion = versions.find(v => v.is_default)

  // Group imported photos by model
  const classifiedGroups = importedPhotos.reduce((acc, photo) => {
    if (photo.status !== 'done') return acc
    const key = photo.matchedModelId || 'unrecognized'
    if (!acc[key]) {
      acc[key] = {
        modelId: photo.matchedModelId,
        modelName: photo.matchedModelName || 'Non reconnus',
        photos: []
      }
    }
    acc[key].photos.push(photo)
    return acc
  }, {} as Record<string, { modelId: string | null; modelName: string; photos: ImportedPhoto[] }>)

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // Bulk import
  async function handleBulkImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const newPhotos: ImportedPhoto[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
      status: 'pending' as const,
      matchedModelId: null,
      matchedModelName: null,
      extractedData: null,
      confidence: 0
    }))

    setImportedPhotos(newPhotos)
    setClassifying(true)

    // Analyze each photo
    for (const photo of newPhotos) {
      try {
        photo.status = 'analyzing'
        setImportedPhotos([...newPhotos])

        const base64 = await fileToBase64(photo.file)
        const response = await fetch('/api/analyze-meter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: base64 })
        })

        if (response.ok) {
          const result = await response.json()
          photo.matchedModelId = result.matchedModel?.id || null
          photo.matchedModelName = result.matchedModel?.name || null
          photo.extractedData = result.extractedData || null
          photo.confidence = result.confidence || 0
          photo.status = 'done'
        } else {
          photo.status = 'error'
          photo.error = 'Échec de l\'analyse'
        }
      } catch (err) {
        photo.status = 'error'
        photo.error = 'Erreur réseau'
      }
      setImportedPhotos([...newPhotos])
    }

    setClassifying(false)
  }

  // Start review session
  function startReview(modelId: string | null, modelName: string, photos: ImportedPhoto[]) {
    setReviewSession({
      modelId: modelId || 'unrecognized',
      modelName,
      photos,
      currentIndex: 0
    })
  }

  // Review navigation
  function reviewNext() {
    if (!reviewSession) return
    if (reviewSession.currentIndex < reviewSession.photos.length - 1) {
      setReviewSession({ ...reviewSession, currentIndex: reviewSession.currentIndex + 1 })
    }
  }

  function reviewPrev() {
    if (!reviewSession) return
    if (reviewSession.currentIndex > 0) {
      setReviewSession({ ...reviewSession, currentIndex: reviewSession.currentIndex - 1 })
    }
  }

  // Validate/Correct/Reject in review
  async function reviewValidate() {
    if (!reviewSession) return
    const photo = reviewSession.photos[reviewSession.currentIndex]
    
    // TODO: Save to lab_experiments with status 'validated'
    console.log('Validate:', photo.id)
    
    reviewNext()
  }

  async function reviewReject() {
    if (!reviewSession) return
    const photo = reviewSession.photos[reviewSession.currentIndex]
    
    // TODO: Save to lab_experiments with status 'rejected'
    console.log('Reject:', photo.id)
    
    reviewNext()
  }

  function reviewOpenCorrection() {
    if (!reviewSession) return
    const photo = reviewSession.photos[reviewSession.currentIndex]
    
    // Prepare correction data from extracted data
    const data: Record<string, string> = {}
    if (photo.extractedData) {
      Object.entries(photo.extractedData).forEach(([key, val]) => {
        data[key] = val.value
      })
    }
    
    setCorrectionData(data)
    setCorrectionPhotoId(photo.id)
    setShowCorrectionModal(true)
  }

  async function submitCorrection() {
    if (!correctionPhotoId || !reviewSession) return
    
    // TODO: Save to lab_experiments with status 'corrected' and corrected_data
    console.log('Correct:', correctionPhotoId, correctionData)
    
    setShowCorrectionModal(false)
    setCorrectionPhotoId(null)
    reviewNext()
  }

  // Keyboard shortcuts for review
  useEffect(() => {
    if (!reviewSession) return

    function handleKeyDown(e: KeyboardEvent) {
      if (showCorrectionModal) return
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
          reviewPrev()
          break
        case 'ArrowRight':
        case 'd':
          reviewNext()
          break
        case 'v':
          reviewValidate()
          break
        case 'c':
          reviewOpenCorrection()
          break
        case 'r':
          reviewReject()
          break
        case 'Escape':
          setReviewSession(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [reviewSession, showCorrectionModal])

  // Single test
  async function handleSingleTestPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (testPhotoUrl) URL.revokeObjectURL(testPhotoUrl)
    setTestPhotoFile(file)
    setTestPhotoUrl(URL.createObjectURL(file))
    setTestResult(null)
  }

  async function runSingleTest() {
    if (!testPhotoFile || !testModelId) return
    
    setTesting(true)
    try {
      const base64 = await fileToBase64(testPhotoFile)
      const model = models.find(m => m.id === testModelId)
      
      const response = await fetch('/api/test-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testPhoto: base64,
          modelId: testModelId,
          imageConfig: testConfig,
          promptRules: model?.ai_description
        })
      })
      
      const result = await response.json()
      setTestResult(result)
    } catch (err) {
      console.error('Test error:', err)
    }
    setTesting(false)
  }

  // Utility
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve((reader.result as string).split(',')[1])
      reader.readAsDataURL(file)
    })
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  // Review mode - full screen
  if (reviewSession) {
    const currentPhoto = reviewSession.photos[reviewSession.currentIndex]
    const model = models.find(m => m.id === reviewSession.modelId)
    const zones = model?.reading_zones || [
      { id: 'serial', label: 'N° série', type: 'text' },
      { id: 'reading', label: 'Index', type: 'number' }
    ]

    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setReviewSession(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Retour
          </Button>
          <div className="text-center">
            <h2 className="font-semibold">Review - {reviewSession.modelName}</h2>
            <p className="text-sm text-gray-500">
              {reviewSession.currentIndex + 1} / {reviewSession.photos.length} photos
            </p>
          </div>
          <div className="flex items-center gap-1">
            {reviewSession.photos.map((p, i) => (
              <div
                key={p.id}
                className={`w-3 h-3 rounded-full cursor-pointer ${
                  i === reviewSession.currentIndex ? 'bg-purple-600' :
                  i < reviewSession.currentIndex ? 'bg-green-500' : 'bg-gray-300'
                }`}
                onClick={() => setReviewSession({ ...reviewSession, currentIndex: i })}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Photo */}
          <div className="flex-1 p-6 flex items-center justify-center bg-gray-100">
            <img
              src={currentPhoto.url}
              alt="Photo de test"
              className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
            />
          </div>

          {/* Results panel */}
          <div className="w-96 border-l p-6 flex flex-col">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Résultat IA
            </h3>

            {currentPhoto.extractedData ? (
              <div className="space-y-4 flex-1">
                {zones.map(zone => {
                  const data = currentPhoto.extractedData?.[zone.id]
                  return (
                    <div key={zone.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">{zone.label}</p>
                      <p className="text-xl font-mono font-semibold">
                        {data?.value || '-'}
                      </p>
                      {data?.confidence && (
                        <p className="text-xs text-gray-400 mt-1">
                          Confiance: {(data.confidence * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  )
                })}

                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Confiance globale</p>
                  <div className="flex items-center gap-2">
                    <Progress value={currentPhoto.confidence * 100} className="flex-1" />
                    <span className="font-semibold">{(currentPhoto.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                Aucune donnée extraite
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t">
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="text-red-600" onClick={reviewReject}>
                  <X className="h-4 w-4 mr-1" />Rejeter
                </Button>
                <Button variant="outline" onClick={reviewOpenCorrection}>
                  <Pencil className="h-4 w-4 mr-1" />Corriger
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={reviewValidate}>
                  <Check className="h-4 w-4 mr-1" />Valider
                </Button>
              </div>
              
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <span><Keyboard className="h-3 w-3 inline mr-1" />←→ Navigation</span>
                <span>V Valider</span>
                <span>C Corriger</span>
                <span>R Rejeter</span>
              </div>
            </div>
          </div>
        </div>

        {/* Correction Modal */}
        <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Corriger les valeurs</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {zones.map(zone => (
                <div key={zone.id}>
                  <Label>{zone.label}</Label>
                  <Input
                    value={correctionData[zone.id] || ''}
                    onChange={(e) => setCorrectionData({ ...correctionData, [zone.id]: e.target.value })}
                    className="font-mono"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCorrectionModal(false)}>Annuler</Button>
              <Button onClick={submitCorrection} className="bg-purple-600">
                Enregistrer et suivant
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Vision Compteurs</h1>
        <p className="text-gray-500">Reconnaissance automatique des index de compteurs</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${
            activeTab === 'overview' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />Vue d'ensemble
        </button>
        <button
          onClick={() => setActiveTab('models')}
          className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${
            activeTab === 'models' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'
          }`}
        >
          <Gauge className="h-4 w-4" />Modèles
        </button>
        <button
          onClick={() => setActiveTab('tests')}
          className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${
            activeTab === 'tests' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'
          }`}
        >
          <TestTube className="h-4 w-4" />Tests
        </button>
        <button
          onClick={() => setActiveTab('versions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${
            activeTab === 'versions' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'
          }`}
        >
          <GitBranch className="h-4 w-4" />Versions
        </button>
      </div>

      {/* ================================================================== */}
      {/* TAB: VUE D'ENSEMBLE */}
      {/* ================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-xs text-gray-500 mb-1">Total modèles</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500 mb-1">Brouillons</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.draft}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500 mb-1">Actifs</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500 mb-1">Taux de succès</p>
              <p className="text-2xl font-bold text-purple-600">{stats.successRate.toFixed(0)}%</p>
            </Card>
          </div>

          {/* Import global */}
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
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleBulkImport} />
            </label>

            {/* Classification results */}
            {classifying && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg flex items-center justify-center gap-3 text-purple-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Classification en cours... {importedPhotos.filter(p => p.status === 'done').length}/{importedPhotos.length}</span>
              </div>
            )}

            {Object.keys(classifiedGroups).length > 0 && !classifying && (
              <div className="mt-4 space-y-3">
                {Object.values(classifiedGroups).map((group, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${group.modelId ? 'border-green-200 bg-green-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {group.modelId ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                        )}
                        <span className="font-medium">{group.modelName}</span>
                        <Badge variant="outline">{group.photos.length}</Badge>
                      </div>
                      <Button size="sm" onClick={() => startReview(group.modelId, group.modelName, group.photos)}>
                        Reviewer <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                    <div className="flex gap-1 overflow-x-auto">
                      {group.photos.slice(0, 8).map(photo => (
                        <img key={photo.id} src={photo.url} className="h-12 w-12 object-cover rounded" />
                      ))}
                      {group.photos.length > 8 && (
                        <div className="h-12 w-12 flex items-center justify-center bg-gray-200 rounded text-xs">
                          +{group.photos.length - 8}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent activity */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activité récente
            </h3>
            <div className="text-center py-8 text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Aucune activité récente</p>
            </div>
          </Card>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: MODÈLES */}
      {/* ================================================================== */}
      {activeTab === 'models' && (
        <div className="space-y-6">
          {/* Toolbar */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un modèle..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={modelFilter} onValueChange={(v: any) => setModelFilter(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="archived">Archivés</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => router.push('/dashboard/meters/create')}>
              <Plus className="h-4 w-4 mr-2" />Créer un modèle
            </Button>
          </div>

          {/* Models list */}
          <Card>
            {filteredModels.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Gauge className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Aucun modèle trouvé</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredModels.map(model => (
                  <div
                    key={model.id}
                    className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedModelId(model.id)}
                  >
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                      {model.reference_photos?.[0] ? (
                        <img src={model.reference_photos[0]} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        METER_TYPE_ICONS[model.meter_type] || '📊'
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{model.name}</p>
                      <p className="text-sm text-gray-500">{model.manufacturer || 'Fabricant inconnu'}</p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      {METER_TYPE_ICONS[model.meter_type]} {METER_TYPE_LABELS[model.meter_type]}
                    </Badge>
                    {model.status === 'draft' && (
                      <Badge className="bg-yellow-100 text-yellow-700">Brouillon</Badge>
                    )}
                    {model.status === 'active' && (
                      <Badge className="bg-green-100 text-green-700">Actif</Badge>
                    )}
                    {model.status === 'archived' && (
                      <Badge className="bg-gray-100 text-gray-600">Archivé</Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Model detail modal */}
          <Dialog open={!!selectedModelId} onOpenChange={(open) => !open && setSelectedModelId(null)}>
            <DialogContent className="max-w-2xl">
              {selectedModel && (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{METER_TYPE_ICONS[selectedModel.meter_type]}</span>
                      <div>
                        <DialogTitle>{selectedModel.name}</DialogTitle>
                        <DialogDescription>
                          {selectedModel.manufacturer} • {METER_TYPE_LABELS[selectedModel.meter_type]}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {/* Status */}
                    <div className="flex items-center gap-2">
                      {selectedModel.status === 'draft' && <Badge className="bg-yellow-100 text-yellow-700">Brouillon</Badge>}
                      {selectedModel.status === 'active' && <Badge className="bg-green-100 text-green-700">Actif</Badge>}
                      {selectedModel.status === 'archived' && <Badge className="bg-gray-100 text-gray-600">Archivé</Badge>}
                    </div>

                    {/* Prompt */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Prompt de reconnaissance
                        </Label>
                        <Badge variant="outline" className="text-xs">Auto-généré</Badge>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg text-sm font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {selectedModel.ai_description || 'Aucun prompt défini'}
                      </div>
                    </div>

                    {/* Config */}
                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4" />
                        Configuration image active
                      </Label>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        {selectedModel.image_config_overrides ? (
                          <p className="font-mono text-sm">
                            {selectedModel.image_config_overrides.grayscale ? 'N&B' : 'Couleur'} • 
                            C:{selectedModel.image_config_overrides.contrast > 0 ? '+' : ''}{selectedModel.image_config_overrides.contrast}% • 
                            N:{selectedModel.image_config_overrides.sharpness}%
                          </p>
                        ) : (
                          <p className="text-gray-500 text-sm">Configuration par défaut</p>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <p className="text-2xl font-bold">{selectedModel.total_scans || 0}</p>
                        <p className="text-xs text-gray-500">Tests</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600">{selectedModel.success_count || 0}</p>
                        <p className="text-xs text-gray-500">Réussis</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {selectedModel.total_scans ? ((selectedModel.success_count || 0) / selectedModel.total_scans * 100).toFixed(0) : 0}%
                        </p>
                        <p className="text-xs text-gray-500">Succès</p>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setSelectedModelId(null)
                      setTestModelId(selectedModel.id)
                      setActiveTab('tests')
                    }}>
                      <TestTube className="h-4 w-4 mr-2" />Tester
                    </Button>
                    <Button onClick={() => router.push(`/dashboard/meters/${selectedModel.id}`)}>
                      <Pencil className="h-4 w-4 mr-2" />Modifier
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: TESTS */}
      {/* ================================================================== */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          {/* Mode selector */}
          <div className="flex gap-4">
            <Card
              className={`flex-1 p-4 cursor-pointer transition-colors ${testMode === 'single' ? 'border-purple-500 bg-purple-50' : 'hover:bg-gray-50'}`}
              onClick={() => setTestMode('single')}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${testMode === 'single' ? 'bg-purple-100' : 'bg-gray-100'}`}>
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Test unitaire</p>
                  <p className="text-sm text-gray-500">Tester une photo à la fois</p>
                </div>
              </div>
            </Card>
            <Card
              className={`flex-1 p-4 cursor-pointer transition-colors ${testMode === 'bulk' ? 'border-purple-500 bg-purple-50' : 'hover:bg-gray-50'}`}
              onClick={() => setTestMode('bulk')}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${testMode === 'bulk' ? 'bg-purple-100' : 'bg-gray-100'}`}>
                  <FolderInput className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Import multiple</p>
                  <p className="text-sm text-gray-500">Importer et reviewer en masse</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Single test mode */}
          {testMode === 'single' && (
            <div className="space-y-4">
              {/* Model selector */}
              <div>
                <Label>Modèle de compteur</Label>
                <Select value={testModelId} onValueChange={setTestModelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un modèle..." />
                  </SelectTrigger>
                  <SelectContent>
                    {models.filter(m => m.status !== 'archived').map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {METER_TYPE_ICONS[m.meter_type]} {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {testModelId && (
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Photo */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />Photo de test
                    </h3>
                    {testPhotoUrl ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <img src={testPhotoUrl} alt="Test" className="w-full rounded-lg border" />
                          <Button
                            variant="outline"
                            size="icon"
                            className="absolute top-2 right-2 bg-white/80"
                            onClick={() => { setTestPhotoUrl(null); setTestPhotoFile(null); setTestResult(null) }}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="block">
                        <div className="h-48 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed hover:border-purple-400 cursor-pointer">
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">Cliquez pour uploader</p>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handleSingleTestPhoto} />
                      </label>
                    )}
                  </Card>

                  {/* Config */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />Traitement
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Noir & Blanc</Label>
                        <Switch
                          checked={testConfig.grayscale}
                          onCheckedChange={(v) => setTestConfig({ ...testConfig, grayscale: v })}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <Label className="text-sm">Contraste</Label>
                          <span className="text-xs text-gray-500">{testConfig.contrast > 0 ? '+' : ''}{testConfig.contrast}%</span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="100"
                          value={testConfig.contrast}
                          onChange={(e) => setTestConfig({ ...testConfig, contrast: +e.target.value })}
                          className="w-full accent-purple-600"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <Label className="text-sm">Netteté</Label>
                          <span className="text-xs text-gray-500">{testConfig.sharpness}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={testConfig.sharpness}
                          onChange={(e) => setTestConfig({ ...testConfig, sharpness: +e.target.value })}
                          className="w-full accent-purple-600"
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Results */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4" />Résultats
                    </h3>
                    {testPhotoUrl && !testResult && (
                      <Button onClick={runSingleTest} disabled={testing} className="w-full mb-4 bg-purple-600">
                        {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                        Lancer l'analyse
                      </Button>
                    )}
                    {testResult && (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {testResult.success ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <span className="font-medium">{testResult.success ? 'Reconnu' : 'Échec'}</span>
                            <Badge variant="outline" className="ml-auto">{(testResult.confidence * 100).toFixed(0)}%</Badge>
                          </div>
                          {testResult.serialNumber && <p className="text-sm"><strong>N° série:</strong> {testResult.serialNumber}</p>}
                          {testResult.reading && <p className="text-sm"><strong>Index:</strong> {testResult.reading}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1 bg-green-600">
                            <Check className="h-4 w-4 mr-1" />Valider
                          </Button>
                          <Button variant="outline" className="flex-1">
                            <Pencil className="h-4 w-4 mr-1" />Corriger
                          </Button>
                          <Button variant="outline" className="flex-1 text-red-600">
                            <X className="h-4 w-4 mr-1" />Rejeter
                          </Button>
                        </div>
                      </div>
                    )}
                    {!testPhotoUrl && (
                      <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                        Uploadez une photo
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Bulk test mode */}
          {testMode === 'bulk' && (
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <FolderInput className="h-5 w-5" />
                  Import multiple
                </h3>
                <label className="block">
                  <div className="h-48 flex flex-col items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed hover:border-purple-400 hover:bg-purple-50 cursor-pointer transition-colors">
                    <Upload className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-gray-600 font-medium">Glissez-déposez vos photos de compteurs</p>
                    <p className="text-sm text-gray-400 mt-1">ou cliquez pour sélectionner</p>
                  </div>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleBulkImport} />
                </label>
              </Card>

              {/* Same classification results as overview */}
              {classifying && (
                <Card className="p-6">
                  <div className="flex items-center justify-center gap-3 text-purple-600">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Classification en cours... {importedPhotos.filter(p => p.status === 'done').length}/{importedPhotos.length}</span>
                  </div>
                </Card>
              )}

              {Object.keys(classifiedGroups).length > 0 && !classifying && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Résultats ({importedPhotos.length} photos)
                  </h3>
                  {Object.values(classifiedGroups).map((group, idx) => (
                    <Card key={idx} className={`p-4 ${group.modelId ? 'border-green-200 bg-green-50/30' : 'border-orange-200 bg-orange-50/30'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {group.modelId ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                          )}
                          <span className="font-medium">{group.modelName}</span>
                          <Badge variant="outline">{group.photos.length} photos</Badge>
                        </div>
                        <Button onClick={() => startReview(group.modelId, group.modelName, group.photos)}>
                          Reviewer <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {group.photos.map(photo => (
                          <img key={photo.id} src={photo.url} className="h-16 w-16 object-cover rounded-lg border" />
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB: VERSIONS */}
      {/* ================================================================== */}
      {activeTab === 'versions' && (
        <div className="space-y-6">
          {/* Active version */}
          {activeVersion && (
            <Card className="p-6 border-2 border-purple-200 bg-purple-50/30">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2 text-lg">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Version active
                  </h3>
                  <p className="text-2xl font-bold mt-2">{activeVersion.display_name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {activeVersion.description || 'Aucune description'}
                  </p>
                </div>
                <Badge className={
                  activeVersion.status === 'stable' ? 'bg-green-600' :
                  activeVersion.status === 'development' ? 'bg-yellow-600' : 'bg-gray-600'
                }>
                  {activeVersion.status}
                </Badge>
              </div>
              <div className="mt-4 p-3 bg-white rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Configuration par défaut</p>
                <p className="font-mono">
                  {activeVersion.default_image_config.grayscale ? 'N&B' : 'Couleur'} • 
                  C:{activeVersion.default_image_config.contrast > 0 ? '+' : ''}{activeVersion.default_image_config.contrast}% • 
                  N:{activeVersion.default_image_config.sharpness}%
                </p>
              </div>
            </Card>
          )}

          {/* Alert for changes */}
          {stats.draft > 0 && (
            <Card className="p-4 border-yellow-200 bg-yellow-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">{stats.draft} modèle(s) en brouillon</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Ces modèles ne sont pas encore inclus dans la version active.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Versions history */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique des versions
            </h3>
            {versions.length > 0 ? (
              <div className="space-y-3">
                {versions.map((v, i) => (
                  <div key={v.id} className={`p-4 rounded-lg border ${v.is_default ? 'border-purple-200 bg-purple-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{v.display_name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(v.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={
                          v.status === 'stable' ? 'bg-green-50 text-green-700' :
                          v.status === 'development' ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50'
                        }>
                          {v.status}
                        </Badge>
                        {v.is_default ? (
                          <Badge className="bg-purple-600">Active</Badge>
                        ) : (
                          <Button size="sm" variant="outline">Activer</Button>
                        )}
                      </div>
                    </div>
                    {v.changelog && (
                      <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{v.changelog}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">Aucune version</p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
