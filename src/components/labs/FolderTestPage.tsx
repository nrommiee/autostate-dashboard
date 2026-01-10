'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { 
  ChevronLeft, 
  Save, 
  Play, 
  Settings2, 
  FlaskConical,
  Loader2,
  Flame,
  Droplets,
  Bolt,
  AlertTriangle,
  Star,
  Lock,
  Unlock,
  Check
} from 'lucide-react'
import { ROIEditor, type ROIZone, type IndexConfig } from '@/components/labs/ROIEditor'
import { PreprocessingEditor, type PreprocessingConfig } from '@/components/labs/PreprocessingEditor'

// ============================================
// TYPES
// ============================================

interface Photo {
  id: string
  folder_id: string
  image_url: string
  thumbnail_url: string | null
  original_filename: string | null
  detected_type: string
  ai_confidence: number | null
  status: string
  created_at?: string
}

interface Folder {
  id: string
  name: string
  description: string | null
  detected_type: string
  status: string
  photo_count: number
  reference_photo_id?: string | null
  reference_photo?: Photo | null
  experiment_photos?: Photo[]
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

interface SavedConfig {
  id: string
  name: string
  folder_id: string
  is_active: boolean
  preprocessing: PreprocessingConfig
  zones: ROIZone[]
  index_config: IndexConfig
  prompt_model: string
  prompt_levels: { universal: boolean; type: boolean; model: boolean }
  created_at: string
  test_results?: {
    accuracy_rate: number
    total_photos: number
    success_count: number
  }
}

interface TestResultAPI {
  id: string
  photo_id: string
  actual_result: Record<string, unknown>
  confidence_score: number
  is_correct: boolean | null
  processing_time_ms?: number
}

// ============================================
// CONSTANTS
// ============================================

const TYPE_ICONS: Record<string, React.ReactNode> = {
  gas: <Flame className="h-4 w-4 text-orange-500" />,
  water: <Droplets className="h-4 w-4 text-blue-500" />,
  electricity: <Bolt className="h-4 w-4 text-yellow-500" />,
  unknown: <AlertTriangle className="h-4 w-4 text-gray-400" />,
}

const DEFAULT_PREPROCESSING: PreprocessingConfig = {
  grayscale: false,
  contrast: 0,
  brightness: 0,
  sharpness: 0,
  saturation: 100,
}

const DEFAULT_INDEX_CONFIG: IndexConfig = {
  integerDigits: 5,
  decimalDigits: 0,
}

const LAYER_DEFS = [
  { num: 1, name: 'Pré-traitement', configurable: true },
  { num: 2, name: 'Détection', configurable: false },
  { num: 3, name: 'Classification', configurable: false },
  { num: 4, name: 'Zones ROI', configurable: true },
  { num: 5, name: 'Prompts', configurable: true },
  { num: 6, name: 'OCR Claude', configurable: false },
  { num: 7, name: 'Validation croisée', configurable: false },
  { num: 8, name: 'Cohérence', configurable: true },
  { num: 9, name: 'Multi-pass', configurable: true },
]

// ============================================
// PROPS
// ============================================

interface FolderTestPageProps {
  folderId: string
  onBack: () => void
}

// ============================================
// MAIN COMPONENT
// ============================================

export function FolderTestPage({ folderId, onBack }: FolderTestPageProps) {
  const router = useRouter()
  
  // State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // Data
  const [folder, setFolder] = useState<Folder | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [referencePhoto, setReferencePhoto] = useState<Photo | null>(null)
  const [configUniversal, setConfigUniversal] = useState<ConfigUniversal | null>(null)
  const [configType, setConfigType] = useState<ConfigType | null>(null)
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([])
  
  // Config state
  const [configName, setConfigName] = useState('')
  const [preprocessing, setPreprocessing] = useState<PreprocessingConfig>(DEFAULT_PREPROCESSING)
  const [zones, setZones] = useState<ROIZone[]>([])
  const [indexConfig, setIndexConfig] = useState<IndexConfig>(DEFAULT_INDEX_CONFIG)
  const [promptModel, setPromptModel] = useState('')
  
  // Prompt levels (locked/unlocked)
  const [promptLevels, setPromptLevels] = useState({
    universal: true,
    type: true,
    model: true,
  })
  
  // UI state
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config')
  const [selectedLayer, setSelectedLayer] = useState(1)
  const [testResults, setTestResults] = useState<TestResultAPI[]>([])
  const [testProgress, setTestProgress] = useState({ status: '', current: 0, total: 0 })

  // Load config values into state
  const loadConfigValues = useCallback((config: SavedConfig) => {
    setConfigName(config.name)
    setPreprocessing(config.preprocessing || DEFAULT_PREPROCESSING)
    setZones(config.zones || [])
    setIndexConfig(config.index_config || DEFAULT_INDEX_CONFIG)
    setPromptModel(config.prompt_model || '')
    setPromptLevels(config.prompt_levels || { universal: true, type: true, model: true })
  }, [])

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load folder with photos
      const folderRes = await fetch(`/api/labs/experiments/folders?id=${folderId}&with_photos=true`)
      const folderData = await folderRes.json()
      
      if (folderData.folder) {
        setFolder(folderData.folder)
        const folderPhotos = folderData.folder.experiment_photos || []
        setPhotos(folderPhotos)
        
        // Set reference photo
        const refPhoto = folderPhotos.find((p: Photo) => p.id === folderData.folder.reference_photo_id)
        setReferencePhoto(refPhoto || folderPhotos[0] || null)
        
        // Load type-specific config
        if (folderData.folder.detected_type) {
          const configRes = await fetch(`/api/labs/experiments/configs?level=type&meter_type=${folderData.folder.detected_type}`)
          const configData = await configRes.json()
          setConfigType(configData.type || null)
        }
      }
      
      // Load universal config
      const universalRes = await fetch('/api/labs/experiments/configs?level=universal')
      const universalData = await universalRes.json()
      setConfigUniversal(universalData.universal || null)
      
      // Load saved configs for this folder
      try {
        const savedRes = await fetch(`/api/labs/experiments/configs?folder_id=${folderId}`)
        const savedData = await savedRes.json()
        if (savedData.configs) {
          setSavedConfigs(savedData.configs)
          
          // Load active config if exists
          const activeConfig = savedData.configs.find((c: SavedConfig) => c.is_active)
          if (activeConfig) {
            loadConfigValues(activeConfig)
          } else {
            // Generate default config name
            setConfigName(`Config v${savedData.configs.length + 1}`)
          }
        } else {
          setConfigName('Config v1')
        }
      } catch (e) {
        setConfigName('Config v1')
      }
      
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [folderId, loadConfigValues])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Save config
  const handleSave = async () => {
    if (!configName.trim()) {
      alert('Veuillez donner un nom à la configuration')
      return
    }
    
    setSaving(true)
    setSaveSuccess(false)
    
    try {
      const res = await fetch('/api/labs/experiments/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_id: folderId,
          name: configName,
          preprocessing,
          zones,
          index_config: indexConfig,
          prompt_model: promptModel,
          prompt_levels: promptLevels,
        }),
      })
      
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        
        // Reload saved configs
        const savedRes = await fetch(`/api/labs/experiments/configs?folder_id=${folderId}`)
        const savedData = await savedRes.json()
        if (savedData.configs) {
          setSavedConfigs(savedData.configs)
        }
        
        // Increment config name for next save
        const match = configName.match(/v(\d+)/)
        if (match) {
          setConfigName(`Config v${parseInt(match[1]) + 1}`)
        }
      } else {
        console.error('Save failed')
      }
    } catch (error) {
      console.error('Error saving config:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // Activate a saved config
  const handleActivateConfig = async (configId: string) => {
    try {
      await fetch('/api/labs/experiments/configs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: configId,
          folder_id: folderId,
          action: 'activate',
        }),
      })
      
      // Reload configs
      const savedRes = await fetch(`/api/labs/experiments/configs?folder_id=${folderId}`)
      const savedData = await savedRes.json()
      if (savedData.configs) {
        setSavedConfigs(savedData.configs)
        const activeConfig = savedData.configs.find((c: SavedConfig) => c.id === configId)
        if (activeConfig) {
          loadConfigValues(activeConfig)
        }
      }
    } catch (error) {
      console.error('Error activating config:', error)
    }
  }

  // Run test
  const handleRunTest = async () => {
    // Save config first if name is set
    if (configName.trim()) {
      await handleSave()
    }
    
    setTesting(true)
    setTestResults([])
    setActiveTab('results')
    
    try {
      const total = photos.length
      const results: TestResultAPI[] = []
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]
        setTestProgress({
          status: `Analyse photo ${i + 1}/${total}`,
          current: i + 1,
          total,
        })
        
        const res = await fetch('/api/labs/experiments/tests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder_id: folderId,
            photo_id: photo.id,
            config: {
              preprocessing,
              zones,
              index_config: indexConfig,
              prompt_model: promptModel,
              prompt_levels: promptLevels,
            },
          }),
        })
        
        const data = await res.json()
        if (data.result) {
          results.push(data.result)
          setTestResults([...results])
        }
      }
      
      setTestProgress({ status: 'Terminé', current: total, total })
      
    } catch (error) {
      console.error('Error running test:', error)
    } finally {
      setTesting(false)
    }
  }

  // Handle zone save
  const handleZonesSave = () => {
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!folder) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Dossier non trouvé</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          ← Retour
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb - Now with working buttons */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <button 
          onClick={() => router.push('/dashboard/labs')}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          🏠 Labs
        </button>
        <span className="text-gray-300 mx-1">›</span>
        <button 
          onClick={onBack}
          className="hover:text-foreground transition-colors"
        >
          Experiments
        </button>
        <span className="text-gray-300 mx-1">›</span>
        <button 
          onClick={onBack}
          className="hover:text-foreground transition-colors"
        >
          Dossiers
        </button>
        <span className="text-gray-300 mx-1">›</span>
        <span className="flex items-center gap-1 text-foreground font-medium">
          {TYPE_ICONS[folder.detected_type]}
          {folder.name}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Retour
          </Button>
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            {TYPE_ICONS[folder.detected_type]}
          </div>
          <div>
            <h1 className="text-xl font-bold">{folder.name}</h1>
            <p className="text-sm text-muted-foreground">
              {photos.length} photo(s) • Configuration et test
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleSave} 
            disabled={saving || !configName.trim()}
            className={saveSuccess ? 'border-green-500 text-green-600' : ''}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saveSuccess ? 'Sauvegardé !' : 'Sauvegarder'}
          </Button>
          <Button onClick={handleRunTest} disabled={testing}>
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Lancer le test
          </Button>
        </div>
      </div>

      {/* Config Name & Prompt Levels Card */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Nom de la configuration</label>
            <Input 
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="Ex: Config v1 - Zones précises"
              className="max-w-md"
            />
          </div>
          
          {/* Prompt Levels Toggle */}
          <div className="flex items-center gap-4 border-l pl-4">
            <span className="text-sm font-medium">Niveaux actifs :</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPromptLevels(p => ({ ...p, universal: !p.universal }))}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  promptLevels.universal 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-400 line-through'
                }`}
                title={promptLevels.universal ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
              >
                {promptLevels.universal ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                Universel
              </button>
              <button
                onClick={() => setPromptLevels(p => ({ ...p, type: !p.type }))}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  promptLevels.type 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-400 line-through'
                }`}
                title={promptLevels.type ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
              >
                {promptLevels.type ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                Type
              </button>
              <button
                onClick={() => setPromptLevels(p => ({ ...p, model: !p.model }))}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  promptLevels.model 
                    ? 'bg-teal-100 text-teal-700' 
                    : 'bg-gray-100 text-gray-400 line-through'
                }`}
                title={promptLevels.model ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
              >
                {promptLevels.model ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                Modèle
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Layers sidebar */}
        <div className="col-span-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Couches d'analyse
          </p>
          <div className="space-y-1">
            {LAYER_DEFS.map((layer) => (
              <button
                key={layer.num}
                onClick={() => setSelectedLayer(layer.num)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedLayer === layer.num
                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  selectedLayer === layer.num
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {layer.num}
                </span>
                <span className="flex-1 text-left">{layer.name}</span>
                {layer.configurable && (
                  <Settings2 className="h-3 w-3 text-gray-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div className="col-span-10">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'config' | 'results')}>
            <TabsList>
              <TabsTrigger value="config" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Configuration
              </TabsTrigger>
              <TabsTrigger value="results" className="gap-2">
                <FlaskConical className="h-4 w-4" />
                Résultats
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="mt-4">
              {/* Layer 1: Preprocessing with saved configs */}
              {selectedLayer === 1 && referencePhoto && (
                <div className="space-y-4">
                  <PreprocessingEditor
                    imageUrl={referencePhoto.image_url}
                    config={preprocessing}
                    onChange={setPreprocessing}
                  />
                  
                  {/* Saved Configs Section */}
                  {savedConfigs.length > 0 && (
                    <Card className="p-4">
                      <h4 className="font-medium mb-3">Configurations enregistrées</h4>
                      <div className="flex flex-wrap gap-2">
                        {savedConfigs.map((cfg) => (
                          <button
                            key={cfg.id}
                            onClick={() => loadConfigValues(cfg)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                              cfg.is_active 
                                ? 'bg-teal-50 border-teal-300 text-teal-700' 
                                : 'hover:bg-gray-50 border-gray-200'
                            }`}
                          >
                            {cfg.is_active && <Star className="h-3 w-3 text-teal-600" />}
                            <span className="font-medium">{cfg.name}</span>
                            {cfg.test_results && (
                              <Badge variant="outline" className="ml-1">
                                {Math.round(cfg.test_results.accuracy_rate * 100)}%
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Layer 4: ROI Zones */}
              {selectedLayer === 4 && referencePhoto && (
                <ROIEditor
                  imageUrl={referencePhoto.image_url}
                  zones={zones}
                  indexConfig={indexConfig}
                  onZonesChange={setZones}
                  onIndexConfigChange={setIndexConfig}
                  onSave={handleZonesSave}
                />
              )}

              {/* Layer 5: Prompts */}
              {selectedLayer === 5 && (
                <Card className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold">Couche 5 : Prompts</h3>
                    <p className="text-sm text-muted-foreground">
                      3 niveaux de prompts combinés
                    </p>
                  </div>

                  {/* Universal prompt */}
                  <div className={`border rounded-lg p-3 transition-opacity ${!promptLevels.universal ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Niveau 1 - Universel</Badge>
                      <Badge variant="secondary">Lecture seule</Badge>
                      <div className="flex-1" />
                      <button
                        onClick={() => setPromptLevels(p => ({ ...p, universal: !p.universal }))}
                        className="p-1 rounded hover:bg-gray-100"
                        title={promptLevels.universal ? 'Désactiver ce niveau' : 'Activer ce niveau'}
                      >
                        {promptLevels.universal ? <Lock className="h-4 w-4 text-blue-600" /> : <Unlock className="h-4 w-4 text-gray-400" />}
                      </button>
                    </div>
                    <pre className="text-xs bg-gray-50 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {configUniversal?.base_prompt || 'Non configuré'}
                    </pre>
                  </div>

                  {/* Type prompt */}
                  <div className={`border rounded-lg p-3 transition-opacity ${!promptLevels.type ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Niveau 2 - Type</Badge>
                      {TYPE_ICONS[folder.detected_type]}
                      <span className="text-sm capitalize">{folder.detected_type}</span>
                      <Badge variant="secondary">Lecture seule</Badge>
                      <div className="flex-1" />
                      <button
                        onClick={() => setPromptLevels(p => ({ ...p, type: !p.type }))}
                        className="p-1 rounded hover:bg-gray-100"
                        title={promptLevels.type ? 'Désactiver ce niveau' : 'Activer ce niveau'}
                      >
                        {promptLevels.type ? <Lock className="h-4 w-4 text-green-600" /> : <Unlock className="h-4 w-4 text-gray-400" />}
                      </button>
                    </div>
                    <pre className="text-xs bg-gray-50 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {configType?.additional_prompt || 'Non configuré'}
                    </pre>
                  </div>

                  {/* Model prompt (editable) */}
                  <div className={`border rounded-lg p-3 border-teal-200 bg-teal-50/30 transition-opacity ${!promptLevels.model ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-teal-600">Niveau 3 - Modèle</Badge>
                      <Badge className="bg-teal-100 text-teal-700">Éditable</Badge>
                      <div className="flex-1" />
                      <button
                        onClick={() => setPromptLevels(p => ({ ...p, model: !p.model }))}
                        className="p-1 rounded hover:bg-gray-100"
                        title={promptLevels.model ? 'Désactiver ce niveau' : 'Activer ce niveau'}
                      >
                        {promptLevels.model ? <Lock className="h-4 w-4 text-teal-600" /> : <Unlock className="h-4 w-4 text-gray-400" />}
                      </button>
                    </div>
                    <Textarea
                      value={promptModel}
                      onChange={(e) => setPromptModel(e.target.value)}
                      placeholder="Instructions spécifiques pour ce modèle de compteur..."
                      className="font-mono text-sm min-h-28"
                      disabled={!promptLevels.model}
                    />
                  </div>
                </Card>
              )}

              {/* Automatic layers */}
              {[2, 3, 6, 7].includes(selectedLayer) && (
                <Card className="p-8 text-center">
                  <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="font-medium mb-2">Couche automatique</p>
                  <p className="text-sm text-muted-foreground">
                    Cette couche est gérée automatiquement par le système
                  </p>
                </Card>
              )}

              {/* Layer 8: Validation - Read-only, shows format from ROI */}
              {selectedLayer === 8 && (
                <Card className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold">Couche 8 : Validation & Cohérence</h3>
                    <p className="text-sm text-muted-foreground">
                      Vérifie que la lecture correspond au format attendu
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">
                      Format configuré dans{' '}
                      <button 
                        onClick={() => setSelectedLayer(4)} 
                        className="text-teal-600 hover:underline font-medium"
                      >
                        Zones ROI (couche 4)
                      </button>
                    </p>
                    <div className="p-4 bg-white rounded-lg border text-center">
                      <p className="text-xs text-muted-foreground mb-1">Format attendu</p>
                      <p className="font-mono text-3xl font-bold tracking-wider">
                        {'X'.repeat(indexConfig.integerDigits)}
                        {indexConfig.decimalDigits > 0 && (
                          <span className="text-red-500">
                            ,{'X'.repeat(indexConfig.decimalDigits)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                    <p className="font-medium mb-1">Règles de validation :</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-600">
                      <li>La lecture doit avoir {indexConfig.integerDigits} chiffres entiers</li>
                      {indexConfig.decimalDigits > 0 && (
                        <li>Suivi de {indexConfig.decimalDigits} décimale(s)</li>
                      )}
                      <li>Les valeurs incohérentes seront signalées</li>
                    </ul>
                  </div>
                </Card>
              )}

              {/* Layer 9: Multi-pass */}
              {selectedLayer === 9 && (
                <Card className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold">Couche 9 : Multi-pass</h3>
                    <p className="text-sm text-muted-foreground">
                      Analyse multiple pour augmenter la confiance
                    </p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-orange-700 text-sm">
                      <AlertTriangle className="h-4 w-4 inline mr-2" />
                      Fonctionnalité avancée - disponible prochainement
                    </p>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="results" className="mt-4">
              {testing ? (
                <Card className="p-8 text-center">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-teal-500" />
                  <p className="text-lg font-medium">{testProgress.status}</p>
                  <div className="w-full max-w-xs mx-auto mt-4 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-teal-500 h-2 rounded-full transition-all" 
                      style={{ 
                        width: `${(testProgress.current / Math.max(testProgress.total, 1)) * 100}%` 
                      }} 
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {testProgress.current}/{testProgress.total} photos
                  </p>
                </Card>
              ) : testResults.length === 0 ? (
                <Card className="p-8 text-center">
                  <Play className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Aucun test lancé</p>
                  <p className="text-muted-foreground mb-4">
                    Configurez les couches puis lancez le test
                  </p>
                  <Button onClick={handleRunTest}>
                    <Play className="h-4 w-4 mr-2" />
                    Lancer maintenant
                  </Button>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Results summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card className="p-4 text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {Math.round(
                          (testResults.reduce((acc, r) => acc + r.confidence_score, 0) / testResults.length) * 100
                        )}%
                      </p>
                      <p className="text-sm text-muted-foreground">Confiance moy.</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <p className="text-3xl font-bold">{testResults.length}</p>
                      <p className="text-sm text-muted-foreground">Photos</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {testResults.filter(r => r.confidence_score >= 0.8).length}
                      </p>
                      <p className="text-sm text-muted-foreground">Haute conf.</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <p className="text-3xl font-bold text-orange-600">
                        {testResults.filter(r => r.confidence_score < 0.8).length}
                      </p>
                      <p className="text-sm text-muted-foreground">À vérifier</p>
                    </Card>
                  </div>

                  {/* Results grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {testResults.map((result, index) => {
                      const photo = photos.find(p => p.id === result.photo_id) || photos[index]
                      const reading = (result.actual_result as any)?.reading
                      const confidence = result.confidence_score
                      const isGood = confidence >= 0.8
                      
                      return (
                        <Card 
                          key={result.id || index} 
                          className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${
                            isGood ? 'border-green-200' : 'border-orange-200'
                          }`}
                        >
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                            {photo && (
                              <img 
                                src={photo.thumbnail_url || photo.image_url} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <p className="font-mono text-sm font-medium truncate">
                            {reading || '-'}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <Badge 
                              variant="outline" 
                              className={isGood ? 'text-green-600' : 'text-orange-600'}
                            >
                              {Math.round(confidence * 100)}%
                            </Badge>
                            {result.is_correct === true && (
                              <span className="text-green-500">✓</span>
                            )}
                            {result.is_correct === false && (
                              <span className="text-red-500">✗</span>
                            )}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
