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
  ExternalLink
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface ConfigUniversal {
  id: string
  name: string
  base_prompt: string
  preprocessing: {
    brightness: number
    contrast: number
    sharpness: number
    denoise: string | null
    binarization: string | null
  }
  min_confidence: number
  multi_pass_enabled: boolean
  multi_pass_count: number
  version: number
}

interface ConfigType {
  id: string
  meter_type: 'gas' | 'water' | 'electricity'
  name: string
  additional_prompt: string | null
  preprocessing_override: Record<string, unknown> | null
  typical_unit: string
  decimal_places: number
}

interface ConfigModel {
  id: string
  type_config_id: string | null
  meter_model_id: string | null
  name: string
  manufacturer: string | null
  specific_prompt: string | null
  preprocessing_override: Record<string, unknown> | null
  accuracy_rate: number | null
  is_promoted: boolean
  experiment_config_type?: ConfigType
}

interface Folder {
  id: string
  name: string
  description: string | null
  linked_meter_model_id: string | null
  config_model_id: string | null
  detected_type: string
  status: 'draft' | 'ready' | 'testing' | 'validated' | 'promoted'
  photo_count: number
  min_photos_required: number
  meter_models?: { id: string; name: string; manufacturer: string }
  experiment_photos?: Photo[]
}

interface Photo {
  id: string
  folder_id: string
  image_url: string
  thumbnail_url: string | null
  original_filename: string | null
  ground_truth: Record<string, unknown> | null
  status: 'pending' | 'tested' | 'validated' | 'reference'
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
  status: 'pending' | 'running' | 'completed' | 'failed'
  created_at: string
  experiment_folders?: { id: string; name: string }
  experiment_config_model?: { id: string; name: string }
  experiment_test_results?: TestResult[]
}

interface TestResult {
  id: string
  photo_id: string
  expected_result: Record<string, unknown> | null
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
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [selectedTest, setSelectedTest] = useState<Test | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configModalLevel, setConfigModalLevel] = useState<'universal' | 'type' | 'model'>('universal')
  const [selectedConfigType, setSelectedConfigType] = useState<ConfigType | null>(null)
  const [selectedConfigModel, setSelectedConfigModel] = useState<ConfigModel | null>(null)

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

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

    setUploading(true)

    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i])
    }
    formData.append('auto_cluster', 'true')

    try {
      const res = await fetch('/api/labs/experiments/photos', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      
      if (data.uploaded) {
        await loadData()
        setActiveTab('folders')
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // ============================================
  // ACTION HANDLERS
  // ============================================

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Supprimer cette photo ?')) return
    await fetch(`/api/labs/experiments/photos?id=${photoId}`, { method: 'DELETE' })
    await loadData()
    if (selectedFolder) {
      const updated = folders.find(f => f.id === selectedFolder.id)
      setSelectedFolder(updated || null)
    }
  }

  const handleMovePhoto = async (photoId: string, targetFolderId: string) => {
    await fetch('/api/labs/experiments/photos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: [photoId], target_folder_id: targetFolderId })
    })
    await loadData()
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Supprimer ce dossier et toutes ses photos ?')) return
    await fetch(`/api/labs/experiments/folders?id=${folderId}`, { method: 'DELETE' })
    setSelectedFolder(null)
    await loadData()
  }

  const handleRunTest = async (folderId: string, configModelId?: string) => {
    try {
      const res = await fetch('/api/labs/experiments/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_id: folderId,
          config_model_id: configModelId,
          use_universal_only: !configModelId,
          run_immediately: true
        })
      })
      const data = await res.json()
      
      if (data.test) {
        await loadData()
        setActiveTab('tests')
        setSelectedTest(data.test)
      }
    } catch (error) {
      console.error('Test error:', error)
    }
  }

  const handlePromote = async (folderId: string) => {
    if (!confirm('Promouvoir ce dossier vers les Modèles ?')) return
    
    try {
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
    } catch (error) {
      console.error('Promote error:', error)
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return '-'
    return `${(value * 100).toFixed(1)}%`
  }

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
            {folders.filter(f => f.status === 'ready').length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center text-xs">
                {folders.filter(f => f.status === 'ready').length}
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

        {/* ============================================ */}
        {/* TAB: IMPORT */}
        {/* ============================================ */}
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
                  <p className="text-lg font-medium">Import en cours...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium mb-2">Glissez vos photos ici</p>
                  <p className="text-sm text-muted-foreground mb-4">ou cliquez pour sélectionner</p>
                  <p className="text-xs text-muted-foreground">
                    Les photos seront automatiquement triées par compteur similaire
                  </p>
                </>
              )}
            </div>
          </Card>

          {/* Stats rapides */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{folders.length}</p>
                  <p className="text-xs text-muted-foreground">Dossiers</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{folders.filter(f => f.status === 'ready').length}</p>
                  <p className="text-xs text-muted-foreground">Prêts pour test</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FlaskConical className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tests.length}</p>
                  <p className="text-xs text-muted-foreground">Tests</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{configs.models.filter(m => m.is_promoted).length}</p>
                  <p className="text-xs text-muted-foreground">Promus</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: DOSSIERS */}
        {/* ============================================ */}
        <TabsContent value="folders" className="space-y-6">
          {selectedFolder ? (
            // Vue détail dossier
            <FolderDetail 
              folder={selectedFolder}
              folders={folders}
              onBack={() => setSelectedFolder(null)}
              onDeletePhoto={handleDeletePhoto}
              onMovePhoto={handleMovePhoto}
              onDeleteFolder={handleDeleteFolder}
              onRunTest={handleRunTest}
              onPromote={handlePromote}
              onRefresh={loadData}
            />
          ) : (
            // Liste des dossiers
            <>
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">{folders.length} dossier(s)</p>
              </div>

              {folders.length === 0 ? (
                <Card className="p-12 text-center">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-600 mb-2">Aucun dossier</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Importez des photos pour créer automatiquement des dossiers
                  </p>
                  <Button onClick={() => setActiveTab('import')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importer des photos
                  </Button>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {folders.map(folder => (
                    <Card 
                      key={folder.id} 
                      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedFolder(folder)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            {TYPE_ICONS[folder.detected_type] || TYPE_ICONS.unknown}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{folder.name}</h3>
                              {folder.linked_meter_model_id && (
                                <Badge variant="outline" className="text-xs">
                                  🔗 {folder.meter_models?.name}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {folder.photo_count} photo{folder.photo_count > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {folder.status === 'draft' && (
                            <div className="w-32">
                              <Progress 
                                value={(folder.photo_count / folder.min_photos_required) * 100} 
                                className="h-2"
                              />
                              <p className="text-xs text-muted-foreground mt-1 text-center">
                                {folder.min_photos_required - folder.photo_count} manquante(s)
                              </p>
                            </div>
                          )}
                          
                          <Badge className={STATUS_COLORS[folder.status]}>
                            {STATUS_LABELS[folder.status]}
                          </Badge>
                          
                          {folder.status === 'ready' && (
                            <Button 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRunTest(folder.id)
                              }}
                            >
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

        {/* ============================================ */}
        {/* TAB: CONFIGS */}
        {/* ============================================ */}
        <TabsContent value="configs" className="space-y-6">
          {/* Config Universelle */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🌍 Configuration Universelle
            </h3>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{configs.universal?.name || 'Configuration universelle'}</p>
                  <p className="text-sm text-muted-foreground">
                    Appliquée à tous les compteurs • Version {configs.universal?.version || 1}
                  </p>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setConfigModalLevel('universal')
                    setShowConfigModal(true)
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Voir / Éditer
                </Button>
              </div>
            </Card>
          </div>

          {/* Configs par Type */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              📦 Configurations par Type
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {configs.types.map(type => (
                <Card key={type.id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {TYPE_ICONS[type.meter_type]}
                    <div>
                      <p className="font-medium">{type.name}</p>
                      <p className="text-xs text-muted-foreground">{type.typical_unit}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setSelectedConfigType(type)
                      setConfigModalLevel('type')
                      setShowConfigModal(true)
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Voir / Éditer
                  </Button>
                </Card>
              ))}
            </div>
          </div>

          {/* Configs par Modèle */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                🎯 Configurations par Modèle
              </h3>
              <Button 
                size="sm"
                onClick={() => {
                  setSelectedConfigModel(null)
                  setConfigModalLevel('model')
                  setShowConfigModal(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle config
              </Button>
            </div>
            
            {configs.models.length === 0 ? (
              <Card className="p-8 text-center">
                <Settings2 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-muted-foreground">Aucune config spécifique</p>
                <p className="text-sm text-muted-foreground">
                  Créez des configs pour vos modèles de compteurs
                </p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {configs.models.map(model => (
                  <Card key={model.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {model.experiment_config_type && TYPE_ICONS[model.experiment_config_type.meter_type]}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{model.name}</p>
                            {model.is_promoted && (
                              <Badge className="bg-teal-100 text-teal-700">Promu</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {model.manufacturer || 'Fabricant inconnu'}
                            {model.accuracy_rate && ` • ${formatPercent(model.accuracy_rate)}`}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedConfigModel(model)
                          setConfigModalLevel('model')
                          setShowConfigModal(true)
                        }}
                      >
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

        {/* ============================================ */}
        {/* TAB: TESTS */}
        {/* ============================================ */}
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
                  <p className="text-sm text-muted-foreground">
                    Lancez un test depuis un dossier prêt
                  </p>
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
                              ? test.accuracy_rate && test.accuracy_rate >= 0.8 
                                ? 'bg-green-100' 
                                : 'bg-orange-100'
                              : test.status === 'running'
                                ? 'bg-blue-100'
                                : 'bg-gray-100'
                          }`}>
                            {test.status === 'running' ? (
                              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                            ) : test.status === 'completed' ? (
                              test.accuracy_rate && test.accuracy_rate >= 0.8 ? (
                                <Check className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-orange-600" />
                              )
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

        {/* ============================================ */}
        {/* TAB: MODÈLES */}
        {/* ============================================ */}
        <TabsContent value="models" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <h3 className="font-semibold">Modèles promus</h3>
                <p className="text-sm text-muted-foreground">
                  Les modèles validés sont disponibles dans Compteurs &gt; Modèles
                </p>
              </div>
            </div>
            
            {folders.filter(f => f.status === 'promoted').length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Aucun modèle promu depuis Experiments</p>
                <Button variant="outline" onClick={() => setActiveTab('folders')}>
                  Voir les dossiers
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {folders.filter(f => f.status === 'promoted').map(folder => (
                  <div key={folder.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {TYPE_ICONS[folder.detected_type]}
                      <div>
                        <p className="font-medium">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Lié à: {folder.meter_models?.name || 'Nouveau modèle'}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/dashboard/meters">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Voir dans Modèles
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============================================ */}
      {/* MODAL: CONFIG EDITOR */}
      {/* ============================================ */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {configModalLevel === 'universal' && '🌍 Configuration Universelle'}
              {configModalLevel === 'type' && `📦 Configuration ${selectedConfigType?.name || 'Type'}`}
              {configModalLevel === 'model' && `🎯 Configuration ${selectedConfigModel?.name || 'Nouveau modèle'}`}
            </DialogTitle>
          </DialogHeader>
          
          <ConfigEditor
            level={configModalLevel}
            universal={configs.universal}
            type={selectedConfigType}
            model={selectedConfigModel}
            types={configs.types}
            onSave={async () => {
              await loadData()
              setShowConfigModal(false)
            }}
            onCancel={() => setShowConfigModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// COMPOSANT: FOLDER DETAIL
// ============================================

function FolderDetail({ 
  folder, 
  folders,
  onBack, 
  onDeletePhoto, 
  onMovePhoto,
  onDeleteFolder,
  onRunTest,
  onPromote,
  onRefresh
}: {
  folder: Folder
  folders: Folder[]
  onBack: () => void
  onDeletePhoto: (id: string) => void
  onMovePhoto: (photoId: string, targetFolderId: string) => void
  onDeleteFolder: (id: string) => void
  onRunTest: (folderId: string) => void
  onPromote: (folderId: string) => void
  onRefresh: () => void
}) {
  const photos = folder.experiment_photos || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            ← Retour
          </Button>
          <div className="flex items-center gap-3">
            {TYPE_ICONS[folder.detected_type]}
            <div>
              <h2 className="text-xl font-bold">{folder.name}</h2>
              <p className="text-sm text-muted-foreground">
                {folder.photo_count} photo{folder.photo_count > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Badge className={STATUS_COLORS[folder.status]}>
            {STATUS_LABELS[folder.status]}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {folder.status === 'ready' && (
            <Button onClick={() => onRunTest(folder.id)}>
              <Play className="h-4 w-4 mr-2" />
              Lancer test
            </Button>
          )}
          {folder.status === 'validated' && (
            <Button onClick={() => onPromote(folder.id)} className="bg-teal-600 hover:bg-teal-700">
              <ArrowRight className="h-4 w-4 mr-2" />
              Promouvoir
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => onDeleteFolder(folder.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer le dossier
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Progress si draft */}
      {folder.status === 'draft' && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-4">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <p className="font-medium text-orange-800">
                {folder.min_photos_required - folder.photo_count} photo(s) manquante(s)
              </p>
              <Progress 
                value={(folder.photo_count / folder.min_photos_required) * 100} 
                className="h-2 mt-2"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Grille de photos */}
      <div>
        <h3 className="font-semibold mb-3">Photos ({photos.length})</h3>
        {photos.length === 0 ? (
          <Card className="p-8 text-center">
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
                        <DropdownMenuItem 
                          key={f.id}
                          onClick={() => onMovePhoto(photo.id, f.id)}
                        >
                          Vers {f.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => onDeletePhoto(photo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Badge status */}
                {photo.status !== 'pending' && (
                  <Badge 
                    className="absolute top-2 right-2 text-xs"
                    variant={photo.status === 'validated' ? 'default' : 'secondary'}
                  >
                    {photo.status === 'tested' && 'Testé'}
                    {photo.status === 'validated' && '✓'}
                    {photo.status === 'reference' && '⭐'}
                  </Badge>
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
    // Reload test
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
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            ← Retour
          </Button>
          <div>
            <h2 className="text-xl font-bold">{test.name}</h2>
            <p className="text-sm text-muted-foreground">
              {test.total_photos} photos testées
            </p>
          </div>
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
                {/* Image */}
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {result.experiment_photos && (
                    <img 
                      src={result.experiment_photos.thumbnail_url || result.experiment_photos.image_url}
                      alt="Photo"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                
                {/* Résultat */}
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
                  
                  {result.expected_result && (
                    <p className="text-sm text-muted-foreground">
                      Attendu: {(result.expected_result as { reading?: string })?.reading}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {result.is_correct === null && (
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleMarkCorrect(result.id, true)}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleMarkCorrect(result.id, false)}
                    >
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
  
  // Universal state
  const [basePrompt, setBasePrompt] = useState(universal?.base_prompt || '')
  const [minConfidence, setMinConfidence] = useState(universal?.min_confidence || 0.7)
  
  // Type state
  const [additionalPrompt, setAdditionalPrompt] = useState(type?.additional_prompt || '')
  
  // Model state
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
          <label className="text-sm font-medium mb-2 block">Prompt additionnel (s'ajoute au prompt universel)</label>
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
              placeholder="Instructions spécifiques pour ce modèle de compteur..."
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
