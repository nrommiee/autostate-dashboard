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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Upload, FolderOpen, Settings2, FlaskConical, CheckCircle2,
  Trash2, MoreVertical, ChevronRight, Loader2, AlertTriangle,
  Play, Eye, RefreshCw, Plus, Flame, Droplets, Bolt,
  Check, Sparkles, ArrowRight, XCircle, MoveRight,
  ExternalLink, Pencil, Image
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface Folder {
  id: string
  name: string
  description: string | null
  detected_type: string
  status: string
  photo_count: number
  min_photos_required: number
  is_unclassified?: boolean
  experiment_photos?: Photo[]
}

interface Photo {
  id: string
  folder_id: string
  image_url: string
  thumbnail_url: string | null
  original_filename: string | null
  detected_type: string
  ai_confidence: number | null
  status: string
}

interface ConfigUniversal {
  id: string
  name: string
  base_prompt: string
  min_confidence: number
  version: number
}

interface ConfigType {
  id: string
  meter_type: string
  name: string
  additional_prompt: string | null
  typical_unit: string
}

interface ConfigModel {
  id: string
  name: string
  manufacturer: string | null
  is_promoted: boolean
  accuracy_rate: number | null
  type_config_id: string | null
  specific_prompt: string | null
  experiment_config_type?: ConfigType
}

interface Test {
  id: string
  folder_id: string
  name: string
  total_photos: number
  successful_count: number
  failed_count: number
  accuracy_rate: number | null
  avg_confidence: number | null
  avg_processing_time_ms: number | null
  total_cost_usd: number | null
  status: string
  experiment_folders?: { id: string; name: string }
  experiment_test_results?: TestResult[]
}

interface TestResult {
  id: string
  photo_id: string
  actual_result: Record<string, unknown>
  confidence_score: number
  is_correct: boolean | null
  experiment_photos?: Photo
}

// ============================================
// CONSTANTES
// ============================================

const TYPE_ICONS: Record<string, React.ReactNode> = {
  gas: <Flame className="h-4 w-4 text-orange-500" />,
  water: <Droplets className="h-4 w-4 text-blue-500" />,
  electricity: <Bolt className="h-4 w-4 text-yellow-500" />,
  unknown: <AlertTriangle className="h-4 w-4 text-gray-400" />
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  ready: 'bg-green-100 text-green-700',
  testing: 'bg-blue-100 text-blue-700',
  validated: 'bg-purple-100 text-purple-700',
  promoted: 'bg-teal-100 text-teal-700'
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  ready: 'Prêt',
  testing: 'En test',
  validated: 'Validé',
  promoted: 'Promu'
}

// ============================================
// IMAGE COMPRESSION
// ============================================

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size < 500 * 1024) {
      resolve(file)
      return
    }
    const img = new window.Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    img.onload = () => {
      let { width, height } = img
      const MAX_SIZE = 1200
      if (width > height && width > MAX_SIZE) {
        height = Math.round((height * MAX_SIZE) / width)
        width = MAX_SIZE
      } else if (height > MAX_SIZE) {
        width = Math.round((width * MAX_SIZE) / height)
        height = MAX_SIZE
      }
      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
          } else {
            reject(new Error('Compression failed'))
          }
        },
        'image/jpeg',
        0.8
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function ExperimentsPage() {
  const [activeTab, setActiveTab] = useState('import')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data
  const [configs, setConfigs] = useState<{
    universal: ConfigUniversal | null
    types: ConfigType[]
    models: ConfigModel[]
  }>({ universal: null, types: [], models: [] })
  const [folders, setFolders] = useState<Folder[]>([])
  const [tests, setTests] = useState<Test[]>([])

  // UI State
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedTest, setSelectedTest] = useState<Test | null>(null)

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configModalLevel, setConfigModalLevel] = useState<'universal' | 'type' | 'model'>('universal')
  const [selectedConfigType, setSelectedConfigType] = useState<ConfigType | null>(null)
  const [selectedConfigModel, setSelectedConfigModel] = useState<ConfigModel | null>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderType, setNewFolderType] = useState('unknown')

  // Alerts
  const [deleteAlert, setDeleteAlert] = useState<{ type: 'photo' | 'folder'; id: string; name?: string } | null>(null)

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ step: '', current: 0, total: 0 })

  // ============================================
  // DATA LOADING
  // ============================================

  const loadData = useCallback(async () => {
    try {
      const [configsRes, foldersRes, testsRes] = await Promise.all([
        fetch('/api/labs/experiments/configs?level=all'),
        fetch('/api/labs/experiments/folders?with_photos=true'),
        fetch('/api/labs/experiments/tests')
      ])

      const [configsData, foldersData, testsData] = await Promise.all([
        configsRes.json(),
        foldersRes.json(),
        testsRes.json()
      ])

      setConfigs({
        universal: configsData.universal || null,
        types: configsData.types || [],
        models: configsData.models || []
      })
      setFolders(foldersData.folders || [])
      setTests(testsData.tests || [])
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

  // ============================================
  // UPLOAD HANDLERS
  // ============================================

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (files.length > 20) {
      setDeleteAlert(null)
      alert('Maximum 20 photos par upload. Veuillez réduire votre sélection.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    setUploadProgress({ step: 'Compression', current: 0, total: files.length })

    try {
      const compressedFiles: File[] = []
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ step: 'Compression', current: i + 1, total: files.length })
        try {
          const compressed = await compressImage(files[i])
          compressedFiles.push(compressed)
        } catch {
          compressedFiles.push(files[i])
        }
      }

      setUploadProgress({ step: 'Analyse IA', current: 0, total: compressedFiles.length })

      const formData = new FormData()
      for (const file of compressedFiles) {
        formData.append('files', file)
      }
      formData.append('auto_cluster', 'true')

      const res = await fetch('/api/labs/experiments/photos', {
        method: 'POST',
        body: formData
      })
      
      if (!res.ok) {
        const data = await res.json()
        alert(data.message || `Erreur: ${res.status}`)
        return
      }

      const data = await res.json()
      
      if (data.error_count > 0) {
        alert(`${data.success_count} photos importées, ${data.error_count} erreurs`)
      }

      await loadData()
      setActiveTab('folders')
    } catch (error) {
      console.error('Upload error:', error)
      alert('Erreur lors de l\'upload')
    } finally {
      setUploading(false)
      setUploadProgress({ step: '', current: 0, total: 0 })
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ============================================
  // ACTION HANDLERS
  // ============================================

  const handleDeletePhoto = async (photoId: string) => {
    await fetch(`/api/labs/experiments/photos?id=${photoId}`, { method: 'DELETE' })
    setDeleteAlert(null)
    await loadData()
  }

  const handleDeleteFolder = async (folderId: string) => {
    await fetch(`/api/labs/experiments/folders?id=${folderId}`, { method: 'DELETE' })
    setDeleteAlert(null)
    setSelectedFolderId(null)
    await loadData()
  }

  const handleMovePhotos = async (photoIds: string[], targetFolderId: string) => {
    await fetch('/api/labs/experiments/photos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: photoIds, target_folder_id: targetFolderId })
    })
    await loadData()
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    
    await fetch('/api/labs/experiments/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName, detected_type: newFolderType })
    })
    
    setShowNewFolderModal(false)
    setNewFolderName('')
    setNewFolderType('unknown')
    await loadData()
  }

  const handleUpdateFolder = async (folderId: string, updates: { name?: string; detected_type?: string }) => {
    await fetch('/api/labs/experiments/folders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: folderId, ...updates })
    })
    await loadData()
  }

  const handleRunTest = async (folderId: string) => {
    const res = await fetch('/api/labs/experiments/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId, run_immediately: true })
    })
    const data = await res.json()
    if (data.test) {
      await loadData()
      setActiveTab('tests')
      setSelectedTest(data.test)
    }
  }

  const handlePromote = async (folderId: string) => {
    const res = await fetch('/api/labs/experiments/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId })
    })
    const data = await res.json()
    if (data.meter_model) {
      await loadData()
      alert(`Modèle ${data.action === 'created' ? 'créé' : 'mis à jour'}: ${data.meter_model.name}`)
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return '-'
    return `${(value * 100).toFixed(1)}%`
  }

  const selectedFolder = folders.find(f => f.id === selectedFolderId) || null
  const unclassifiedCount = folders.find(f => f.is_unclassified)?.photo_count || 0

  // ============================================
  // RENDER
  // ============================================

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
            <h1 className="text-2xl font-bold">Experiments</h1>
            <p className="text-muted-foreground">Créez et testez vos modèles de compteurs</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="folders" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Dossiers
            {unclassifiedCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {unclassifiedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="configs" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configs
          </TabsTrigger>
          <TabsTrigger value="tests" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Tests
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Modèles
          </TabsTrigger>
        </TabsList>

        {/* TAB: IMPORT */}
        <TabsContent value="import" className="space-y-6">
          <Card className="p-8">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            
            <div 
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                ${uploading ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-500 hover:bg-teal-50/50'}`}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="space-y-4">
                  <Loader2 className="h-12 w-12 mx-auto text-teal-600 animate-spin" />
                  <p className="text-lg font-medium">
                    {uploadProgress.step} {uploadProgress.current}/{uploadProgress.total}
                  </p>
                  <Progress value={(uploadProgress.current / uploadProgress.total) * 100} className="max-w-xs mx-auto" />
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium mb-2">Glissez vos photos ici</p>
                  <p className="text-sm text-muted-foreground mb-4">ou cliquez pour sélectionner (max 20 photos)</p>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span>🤖 Analyse IA automatique</span>
                    <span>📁 Classement intelligent</span>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{folders.filter(f => !f.is_unclassified).length}</p>
                  <p className="text-xs text-muted-foreground">Dossiers</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{unclassifiedCount}</p>
                  <p className="text-xs text-muted-foreground">Non classées</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{folders.filter(f => f.status === 'ready' && !f.is_unclassified).length}</p>
                  <p className="text-xs text-muted-foreground">Prêts pour test</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{folders.filter(f => f.status === 'promoted').length}</p>
                  <p className="text-xs text-muted-foreground">Promus</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: DOSSIERS */}
        <TabsContent value="folders" className="space-y-4">
          {selectedFolder ? (
            <FolderDetail 
              folderId={selectedFolder.id}
              folders={folders.filter(f => !f.is_unclassified)}
              onBack={() => setSelectedFolderId(null)}
              onDelete={(id, name) => setDeleteAlert({ type: 'folder', id, name })}
              onUpdateFolder={handleUpdateFolder}
              onMovePhotos={handleMovePhotos}
              onDeletePhoto={(id) => setDeleteAlert({ type: 'photo', id })}
              onRunTest={handleRunTest}
              onPromote={handlePromote}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">{folders.length} dossier(s)</p>
                <Button size="sm" onClick={() => setShowNewFolderModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau dossier
                </Button>
              </div>

              {folders.length === 0 ? (
                <Card className="p-12 text-center">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-600 mb-2">Aucun dossier</p>
                  <p className="text-sm text-muted-foreground">Importez des photos pour créer des dossiers</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {folders.map(folder => (
                    <Card 
                      key={folder.id}
                      className={`p-4 hover:shadow-md transition-shadow cursor-pointer
                        ${folder.is_unclassified ? 'border-orange-200 bg-orange-50/50' : ''}`}
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center
                            ${folder.is_unclassified ? 'bg-orange-100' : 'bg-gray-100'}`}>
                            {folder.is_unclassified 
                              ? <AlertTriangle className="h-5 w-5 text-orange-600" />
                              : (TYPE_ICONS[folder.detected_type] || TYPE_ICONS.unknown)
                            }
                          </div>
                          <div>
                            <h3 className="font-semibold">{folder.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {folder.photo_count} photo{folder.photo_count > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {/* Progress bar - PAS pour Non classé */}
                          {!folder.is_unclassified && folder.status === 'draft' && folder.photo_count < 5 && (
                            <div className="w-24">
                              <Progress value={(folder.photo_count / 5) * 100} className="h-2" />
                              <p className="text-xs text-muted-foreground text-center mt-1">
                                {5 - folder.photo_count} manquante(s)
                              </p>
                            </div>
                          )}
                          
                          {/* Badge status */}
                          <Badge className={folder.is_unclassified ? 'bg-orange-100 text-orange-700' : STATUS_COLORS[folder.status]}>
                            {folder.is_unclassified ? 'Pot commun' : STATUS_LABELS[folder.status]}
                          </Badge>
                          
                          {/* Bouton Tester - PAS pour Non classé */}
                          {!folder.is_unclassified && folder.status === 'ready' && (
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleRunTest(folder.id) }}>
                              <Play className="h-4 w-4 mr-1" />
                              Tester
                            </Button>
                          )}
                          
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* TAB: CONFIGS */}
        <TabsContent value="configs" className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">🌍 Configuration Universelle</h3>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{configs.universal?.name || 'Configuration universelle'}</p>
                  <p className="text-sm text-muted-foreground">Version {configs.universal?.version || 1}</p>
                </div>
                <Button variant="outline" onClick={() => { setConfigModalLevel('universal'); setShowConfigModal(true) }}>
                  <Eye className="h-4 w-4 mr-2" />
                  Voir / Éditer
                </Button>
              </div>
            </Card>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">📦 Par Type</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {configs.types.map(type => (
                <Card key={type.id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {TYPE_ICONS[type.meter_type]}
                    <span className="font-medium">{type.name}</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => {
                    setSelectedConfigType(type)
                    setConfigModalLevel('type')
                    setShowConfigModal(true)
                  }}>
                    <Eye className="h-4 w-4 mr-2" />
                    Éditer
                  </Button>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">🎯 Par Modèle</h3>
              <Button size="sm" onClick={() => { setSelectedConfigModel(null); setConfigModalLevel('model'); setShowConfigModal(true) }}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle config
              </Button>
            </div>
            {configs.models.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Aucune config spécifique</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {configs.models.map(model => (
                  <Card key={model.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{model.name}</p>
                        <p className="text-xs text-muted-foreground">{model.manufacturer || 'Fabricant inconnu'}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => {
                        setSelectedConfigModel(model)
                        setConfigModalLevel('model')
                        setShowConfigModal(true)
                      }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Éditer
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB: TESTS */}
        <TabsContent value="tests" className="space-y-6">
          {selectedTest ? (
            <TestDetail 
              test={selectedTest}
              onBack={() => setSelectedTest(null)}
              onRefresh={loadData}
            />
          ) : (
            <>
              {tests.length === 0 ? (
                <Card className="p-12 text-center">
                  <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-600 mb-2">Aucun test</p>
                  <p className="text-sm text-muted-foreground">Lancez un test depuis un dossier prêt</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {tests.map(test => (
                    <Card 
                      key={test.id} 
                      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedTest(test)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            test.status === 'completed' 
                              ? test.accuracy_rate && test.accuracy_rate >= 0.8 ? 'bg-green-100' : 'bg-orange-100'
                              : test.status === 'running' ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            {test.status === 'running' ? (
                              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                            ) : test.status === 'completed' ? (
                              test.accuracy_rate && test.accuracy_rate >= 0.8 
                                ? <Check className="h-5 w-5 text-green-600" />
                                : <AlertTriangle className="h-5 w-5 text-orange-600" />
                            ) : (
                              <FlaskConical className="h-5 w-5 text-gray-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{test.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {test.experiment_folders?.name} • {test.total_photos} photos
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          {test.status === 'completed' && (
                            <>
                              <div className="text-center">
                                <p className="text-2xl font-bold">{formatPercent(test.accuracy_rate)}</p>
                                <p className="text-xs text-muted-foreground">Précision</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-semibold">{formatPercent(test.avg_confidence)}</p>
                                <p className="text-xs text-muted-foreground">Confiance</p>
                              </div>
                            </>
                          )}
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* TAB: MODÈLES */}
        <TabsContent value="models" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <h3 className="font-semibold">Modèles promus</h3>
                <p className="text-sm text-muted-foreground">Disponibles dans Compteurs &gt; Modèles</p>
              </div>
            </div>
            
            {folders.filter(f => f.status === 'promoted').length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Aucun modèle promu</p>
              </div>
            ) : (
              <div className="space-y-3">
                {folders.filter(f => f.status === 'promoted').map(folder => (
                  <div key={folder.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {TYPE_ICONS[folder.detected_type]}
                      <span className="font-medium">{folder.name}</span>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/dashboard/meters">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Voir
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: Nouveau dossier */}
      <Dialog open={showNewFolderModal} onOpenChange={setShowNewFolderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau dossier</DialogTitle>
            <DialogDescription>Créez un dossier vide pour y classer des photos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nom du dossier</label>
              <Input 
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ex: ITRON G4"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Type de compteur</label>
              <Select value={newFolderType} onValueChange={setNewFolderType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gas">🔥 Gaz</SelectItem>
                  <SelectItem value="water">💧 Eau</SelectItem>
                  <SelectItem value="electricity">⚡ Électricité</SelectItem>
                  <SelectItem value="unknown">❓ Non défini</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderModal(false)}>Annuler</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Config Editor */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {configModalLevel === 'universal' && '🌍 Configuration Universelle'}
              {configModalLevel === 'type' && `📦 ${selectedConfigType?.name}`}
              {configModalLevel === 'model' && `🎯 ${selectedConfigModel?.name || 'Nouveau modèle'}`}
            </DialogTitle>
          </DialogHeader>
          <ConfigEditor
            level={configModalLevel}
            universal={configs.universal}
            type={selectedConfigType}
            model={selectedConfigModel}
            types={configs.types}
            onSave={async () => { await loadData(); setShowConfigModal(false) }}
            onCancel={() => setShowConfigModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ALERT: Suppression */}
      <AlertDialog open={!!deleteAlert} onOpenChange={(open) => !open && setDeleteAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAlert?.type === 'photo' 
                ? 'Cette photo sera définitivement supprimée.'
                : `Le dossier "${deleteAlert?.name}" et toutes ses photos seront définitivement supprimés.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteAlert?.type === 'photo') {
                  handleDeletePhoto(deleteAlert.id)
                } else if (deleteAlert?.type === 'folder') {
                  handleDeleteFolder(deleteAlert.id)
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================
// COMPOSANT: FOLDER DETAIL
// ============================================

function FolderDetail({ 
  folderId,
  folders,
  onBack, 
  onDelete,
  onUpdateFolder,
  onMovePhotos,
  onDeletePhoto,
  onRunTest,
  onPromote
}: {
  folderId: string
  folders: Folder[]
  onBack: () => void
  onDelete: (id: string, name: string) => void
  onUpdateFolder: (id: string, updates: { name?: string; detected_type?: string }) => void
  onMovePhotos: (photoIds: string[], folderId: string) => void
  onDeletePhoto: (id: string) => void
  onRunTest: (id: string) => void
  onPromote: (id: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [folder, setFolder] = useState<Folder | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch(`/api/labs/experiments/folders?id=${folderId}`)
      const data = await res.json()
      if (data.folder) {
        setFolder(data.folder)
        setPhotos(data.folder.experiment_photos || [])
        setEditName(data.folder.name)
        setEditType(data.folder.detected_type)
      }
      setLoading(false)
    }
    load()
  }, [folderId])

  const handleSave = async () => {
    if (!folder) return
    await onUpdateFolder(folder.id, { name: editName, detected_type: editType })
    setFolder({ ...folder, name: editName, detected_type: editType })
    setEditing(false)
  }

  const handleMovePhoto = async (photoId: string, targetFolderId: string) => {
    await onMovePhotos([photoId], targetFolderId)
    setPhotos(photos.filter(p => p.id !== photoId))
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  if (!folder) return null

  const isUnclassified = folder.is_unclassified

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>← Retour</Button>
          
          {editing && !isUnclassified ? (
            <div className="flex items-center gap-2">
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gas">🔥 Gaz</SelectItem>
                  <SelectItem value="water">💧 Eau</SelectItem>
                  <SelectItem value="electricity">⚡ Élec</SelectItem>
                  <SelectItem value="unknown">❓</SelectItem>
                </SelectContent>
              </Select>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-64" />
              <Button size="sm" onClick={handleSave}><Check className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}><XCircle className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {isUnclassified 
                ? <AlertTriangle className="h-5 w-5 text-orange-500" />
                : TYPE_ICONS[folder.detected_type]
              }
              <div>
                <h2 className="text-xl font-bold">{folder.name}</h2>
                <p className="text-sm text-muted-foreground">{photos.length} photo(s)</p>
              </div>
              {!isUnclassified && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Badge className={isUnclassified ? 'bg-orange-100 text-orange-700' : STATUS_COLORS[folder.status]}>
                {isUnclassified ? 'Pot commun' : STATUS_LABELS[folder.status]}
              </Badge>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isUnclassified && folder.status === 'ready' && (
            <Button onClick={() => onRunTest(folder.id)}>
              <Play className="h-4 w-4 mr-2" />
              Lancer test
            </Button>
          )}
          {!isUnclassified && folder.status === 'validated' && (
            <Button onClick={() => onPromote(folder.id)} className="bg-teal-600 hover:bg-teal-700">
              <ArrowRight className="h-4 w-4 mr-2" />
              Promouvoir
            </Button>
          )}
          {!isUnclassified && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem className="text-red-600" onClick={() => onDelete(folder.id, folder.name)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Progress si draft - PAS pour Non classé */}
      {!isUnclassified && folder.status === 'draft' && photos.length < 5 && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-4">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <p className="font-medium text-orange-800">{5 - photos.length} photo(s) manquante(s)</p>
              <Progress value={(photos.length / 5) * 100} className="h-2 mt-2" />
            </div>
          </div>
        </Card>
      )}

      {/* Info pour Non classé */}
      {isUnclassified && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-4">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-800">Photos à classer</p>
              <p className="text-sm text-orange-600">
                Déplacez ces photos vers les dossiers appropriés en utilisant le bouton de déplacement sur chaque photo.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Grille de photos */}
      <div>
        <h3 className="font-semibold mb-3">Photos ({photos.length})</h3>
        {photos.length === 0 ? (
          <Card className="p-8 text-center">
            <Image className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-muted-foreground">Aucune photo dans ce dossier</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {photos.map(photo => (
              <div key={photo.id} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src={photo.thumbnail_url || photo.image_url}
                    alt={photo.original_filename || 'Photo'}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="secondary">
                        <MoveRight className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {folders.filter(f => f.id !== folder.id).map(f => (
                        <DropdownMenuItem key={f.id} onClick={() => handleMovePhoto(photo.id, f.id)}>
                          {TYPE_ICONS[f.detected_type]}
                          <span className="ml-2">{f.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="destructive" onClick={() => onDeletePhoto(photo.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Badge confidence */}
                {photo.ai_confidence !== null && (
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
                    {photo.ai_confidence}%
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// COMPOSANT: TEST DETAIL
// ============================================

function TestDetail({ 
  test, 
  onBack,
  onRefresh
}: {
  test: Test
  onBack: () => void
  onRefresh: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [fullTest, setFullTest] = useState<Test | null>(null)

  useEffect(() => {
    const loadTest = async () => {
      setLoading(true)
      const res = await fetch(`/api/labs/experiments/tests?id=${test.id}`)
      const data = await res.json()
      setFullTest(data.test)
      setLoading(false)
    }
    loadTest()
  }, [test.id])

  const results = fullTest?.experiment_test_results || []

  const handleMarkCorrect = async (resultId: string, isCorrect: boolean) => {
    await fetch('/api/labs/experiments/tests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result_id: resultId, is_correct: isCorrect })
    })
    const res = await fetch(`/api/labs/experiments/tests?id=${test.id}`)
    const data = await res.json()
    setFullTest(data.test)
    onRefresh()
  }

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return '-'
    return `${(value * 100).toFixed(1)}%`
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>← Retour</Button>
        <div>
          <h2 className="text-xl font-bold">{test.name}</h2>
          <p className="text-sm text-muted-foreground">{test.total_photos} photos testées</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold">{formatPercent(fullTest?.accuracy_rate ?? test.accuracy_rate)}</p>
          <p className="text-sm text-muted-foreground">Précision</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold">{formatPercent(fullTest?.avg_confidence ?? test.avg_confidence)}</p>
          <p className="text-sm text-muted-foreground">Confiance moy.</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold">{fullTest?.avg_processing_time_ms || test.avg_processing_time_ms || '-'}ms</p>
          <p className="text-sm text-muted-foreground">Temps moy.</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold">${(fullTest?.total_cost_usd ?? test.total_cost_usd ?? 0).toFixed(4)}</p>
          <p className="text-sm text-muted-foreground">Coût total</p>
        </Card>
      </div>

      {/* Résultats */}
      <div>
        <h3 className="font-semibold mb-3">Résultats détaillés</h3>
        <div className="space-y-3">
          {results.map(result => (
            <Card key={result.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {result.experiment_photos && (
                    <img 
                      src={result.experiment_photos.thumbnail_url || result.experiment_photos.image_url}
                      alt="Photo"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {result.is_correct === true && <Check className="h-5 w-5 text-green-600" />}
                    {result.is_correct === false && <XCircle className="h-5 w-5 text-red-600" />}
                    {result.is_correct === null && <AlertTriangle className="h-5 w-5 text-gray-400" />}
                    <span className="font-medium">
                      {(result.actual_result as { reading?: string })?.reading || 'Pas de lecture'}
                    </span>
                    <Badge variant="outline">
                      {(result.confidence_score * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>

                {result.is_correct === null && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleMarkCorrect(result.id, true)}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleMarkCorrect(result.id, false)}>
                      <XCircle className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================
// COMPOSANT: CONFIG EDITOR
// ============================================

function ConfigEditor({
  level,
  universal,
  type,
  model,
  types,
  onSave,
  onCancel
}: {
  level: 'universal' | 'type' | 'model'
  universal: ConfigUniversal | null
  type: ConfigType | null
  model: ConfigModel | null
  types: ConfigType[]
  onSave: () => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [basePrompt, setBasePrompt] = useState(universal?.base_prompt || '')
  const [minConfidence, setMinConfidence] = useState(universal?.min_confidence || 0.7)
  const [additionalPrompt, setAdditionalPrompt] = useState(type?.additional_prompt || '')
  const [modelName, setModelName] = useState(model?.name || '')
  const [manufacturer, setManufacturer] = useState(model?.manufacturer || '')
  const [specificPrompt, setSpecificPrompt] = useState(model?.specific_prompt || '')
  const [typeConfigId, setTypeConfigId] = useState(model?.type_config_id || '')

  const handleSave = async () => {
    setSaving(true)
    try {
      if (level === 'universal') {
        await fetch('/api/labs/experiments/configs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'universal',
            id: universal?.id,
            base_prompt: basePrompt,
            min_confidence: minConfidence
          })
        })
      } else if (level === 'type') {
        await fetch('/api/labs/experiments/configs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'type',
            id: type?.id,
            additional_prompt: additionalPrompt
          })
        })
      } else if (level === 'model') {
        const method = model ? 'PUT' : 'POST'
        await fetch('/api/labs/experiments/configs', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'model',
            id: model?.id,
            name: modelName,
            manufacturer,
            specific_prompt: specificPrompt,
            type_config_id: typeConfigId || null
          })
        })
      }
      await onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {level === 'universal' && (
        <>
          <div>
            <label className="text-sm font-medium mb-2 block">Prompt de base</label>
            <Textarea 
              value={basePrompt}
              onChange={(e) => setBasePrompt(e.target.value)}
              className="font-mono text-sm h-64"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Confiance minimum: {minConfidence}
            </label>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </>
      )}

      {level === 'type' && (
        <div>
          <label className="text-sm font-medium mb-2 block">Prompt additionnel</label>
          <Textarea 
            value={additionalPrompt}
            onChange={(e) => setAdditionalPrompt(e.target.value)}
            className="font-mono text-sm h-48"
          />
        </div>
      )}

      {level === 'model' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nom</label>
              <Input 
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="Ex: ITRON G4"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Fabricant</label>
              <Input 
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Ex: Itron"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Type de compteur</label>
            <Select value={typeConfigId} onValueChange={setTypeConfigId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {types.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Prompt spécifique</label>
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Générer avec IA
              </Button>
            </div>
            <Textarea 
              value={specificPrompt}
              onChange={(e) => setSpecificPrompt(e.target.value)}
              className="font-mono text-sm h-32"
              placeholder="Instructions spécifiques..."
            />
          </div>
        </>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Sauvegarder
        </Button>
      </DialogFooter>
    </div>
  )
}
