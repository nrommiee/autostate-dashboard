'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Check,
  CheckCircle2,
  Pencil
} from 'lucide-react'
import { ROIEditor, type ROIZone } from '@/components/labs/ROIEditor'
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
  config_model_id?: string | null
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

interface IndexConfig {
  integerDigits: number
  decimalDigits: number
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
  { num: 5, name: 'Index Config', configurable: true },
  { num: 6, name: 'OCR Claude', configurable: false },
  { num: 7, name: 'Validation croisée', configurable: false },
  { num: 8, name: 'Cohérence', configurable: true },
  { num: 9, name: 'Prompts', configurable: true }, // Dernière couche configurable
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
  const [isEditingName, setIsEditingName] = useState(true) // true = editing mode, false = saved/locked
  
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
  }, [])

  // Generate Level 3 prompt preview from current config
  const generateLevel3Preview = useCallback(() => {
    let preview = ''
    
    // Zones ROI
    if (zones.length > 0) {
      preview += '=== ZONES D\'INTÉRÊT (ROI) ===\n'
      for (const zone of zones) {
        switch (zone.type) {
          case 'index':
            preview += `• ZONE INDEX: [${Math.round(zone.x)}%, ${Math.round(zone.y)}%] - ${Math.round(zone.width)}x${Math.round(zone.height)}%\n`
            break
          case 'serial':
            preview += `• ZONE N° SÉRIE: [${Math.round(zone.x)}%, ${Math.round(zone.y)}%] - ${Math.round(zone.width)}x${Math.round(zone.height)}%\n`
            break
          case 'ean':
            preview += `• ZONE EAN: [${Math.round(zone.x)}%, ${Math.round(zone.y)}%]\n`
            break
          case 'meter':
            preview += `• ZONE COMPTEUR: [${Math.round(zone.x)}%, ${Math.round(zone.y)}%]\n`
            break
          default:
            preview += `• ZONE ${zone.label}: [${Math.round(zone.x)}%, ${Math.round(zone.y)}%]\n`
        }
      }
    }
    
    // Index config
    if (indexConfig.integerDigits || indexConfig.decimalDigits) {
      if (preview) preview += '\n'
      preview += '=== FORMAT INDEX ===\n'
      preview += `• Chiffres entiers: ${indexConfig.integerDigits}\n`
      preview += `• Décimales: ${indexConfig.decimalDigits}\n`
      preview += `• Format attendu: ${'X'.repeat(indexConfig.integerDigits)}${indexConfig.decimalDigits > 0 ? ',' + 'X'.repeat(indexConfig.decimalDigits) : ''}\n`
    }
    
    // Preprocessing
    const hasPreprocessing = preprocessing.grayscale || 
      preprocessing.contrast !== 30 || 
      preprocessing.brightness !== 0 || 
      preprocessing.sharpness !== 20
    
    if (hasPreprocessing) {
      if (preview) preview += '\n'
      preview += '=== PRÉTRAITEMENT ===\n'
      if (preprocessing.grayscale) preview += '• Niveaux de gris: activé\n'
      if (preprocessing.contrast !== 30) preview += `• Contraste: ${preprocessing.contrast}%\n`
      if (preprocessing.brightness !== 0) preview += `• Luminosité: ${preprocessing.brightness}\n`
      if (preprocessing.sharpness !== 20) preview += `• Netteté: ${preprocessing.sharpness}%\n`
    }
    
    return preview || 'Aucune configuration définie'
  }, [zones, indexConfig, preprocessing])

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
          setConfigType(configData.type || configData.config || null)
        }
        
        // Load model config if linked to folder
        if (folderData.folder.config_model_id) {
          const modelRes = await fetch(`/api/labs/experiments/configs?level=model&id=${folderData.folder.config_model_id}`)
          const modelData = await modelRes.json()
          const modelConfig = modelData.model || modelData.config
          if (modelConfig) {
            // Charger les valeurs de la config modèle
            if (modelConfig.preprocessing_override) {
              setPreprocessing(modelConfig.preprocessing_override)
            }
            if (modelConfig.extraction_zones) {
              setZones(modelConfig.extraction_zones)
            }
            if (modelConfig.specific_prompt) {
              setPromptModel(modelConfig.specific_prompt)
            }
            if (modelConfig.visual_characteristics) {
              setIndexConfig({
                integerDigits: modelConfig.visual_characteristics.num_digits || 5,
                decimalDigits: modelConfig.visual_characteristics.num_decimals || 3
              })
            }
            setConfigName(modelConfig.name || folderData.folder.name)
          }
        }
      }
      
      // Load universal config
      const universalRes = await fetch('/api/labs/experiments/configs?level=universal')
      const universalData = await universalRes.json()
      setConfigUniversal(universalData.universal || universalData.config || null)
      
      // Load saved configs for this folder
      try {
        const savedRes = await fetch(`/api/labs/experiments/configs?folder_id=${folderId}`)
        const savedData = await savedRes.json()
        if (savedData.configs && savedData.configs.length > 0) {
          setSavedConfigs(savedData.configs)
          
          // Load active config if exists
          const activeConfig = savedData.configs.find((c: SavedConfig) => c.is_active)
          if (activeConfig) {
            loadConfigValues(activeConfig)
          } else if (!folderData?.folder?.config_model_id) {
            // Generate default config name only if no model config
            setConfigName(`Config v${savedData.configs.length + 1}`)
          }
        } else if (!folderData?.folder?.config_model_id) {
          setConfigName('Config v1')
        }
      } catch (e) {
        if (!folderData?.folder?.config_model_id) {
          setConfigName('Config v1')
        }
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
        }),
      })
      
      if (res.ok) {
        setSaveSuccess(true)
        setIsEditingName(false) // Lock the name after save
        setTimeout(() => setSaveSuccess(false), 3000)
        
        // Reload saved configs
        const savedRes = await fetch(`/api/labs/experiments/configs?folder_id=${folderId}`)
        const savedData = await savedRes.json()
        if (savedData.configs) {
          setSavedConfigs(savedData.configs)
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

  // Start new config (unlock name for editing)
  const handleNewConfig = () => {
    const match = configName.match(/v(\d+)/)
    if (match) {
      setConfigName(`Config v${parseInt(match[1]) + 1}`)
    } else {
      setConfigName(`${configName} - copie`)
    }
    setIsEditingName(true)
  }

  // Run test
  const handleRunTest = async () => {
    // Save config first if name is set and in editing mode
    if (configName.trim() && isEditingName) {
      await handleSave()
    }
    
    setTesting(true)
    setTestResults([])
    setActiveTab('results')
    setTestProgress({ status: 'Lancement du test...', current: 0, total: photos.length })
    
    try {
      // Call API to create and run test for the entire folder
      const res = await fetch('/api/labs/experiments/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_id: folderId,
          run_immediately: true,
          multi_pass: true,
          config: {
            preprocessing,
            zones,
            index_config: indexConfig,
            prompt_model: promptModel,
          },
        }),
      })
      
      const data = await res.json()
      
      if (data.test) {
        // Poll for results
        const testId = data.test.id
        let completed = false
        let pollCount = 0
        const maxPolls = 60 // 60 * 2s = 2 minutes max
        
        while (!completed && pollCount < maxPolls) {
          await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
          
          const statusRes = await fetch(`/api/labs/experiments/tests?id=${testId}`)
          const statusData = await statusRes.json()
          
          if (statusData.test) {
            const test = statusData.test
            const results = test.experiment_test_results || []
            
            // Update progress
            setTestProgress({
              status: test.status === 'completed' ? 'Terminé' : `Analyse en cours...`,
              current: results.length,
              total: test.total_photos || photos.length,
            })
            
            // Convert results to our format
            const convertedResults: TestResultAPI[] = results.map((r: any) => ({
              id: r.id,
              photo_id: r.photo_id,
              actual_result: r.actual_result || {},
              confidence_score: r.confidence_score || 0,
              is_correct: r.is_correct,
              processing_time_ms: r.processing_time_ms,
            }))
            
            setTestResults(convertedResults)
            
            if (test.status === 'completed' || test.status === 'failed') {
              completed = true
              setTestProgress({ 
                status: test.status === 'completed' ? 'Terminé ✓' : 'Erreur', 
                current: results.length, 
                total: test.total_photos || photos.length 
              })
            }
          }
          
          pollCount++
        }
        
        if (!completed) {
          setTestProgress({ status: 'Timeout - vérifiez les résultats plus tard', current: 0, total: 0 })
        }
      } else {
        console.error('Failed to create test:', data.error)
        setTestProgress({ status: 'Erreur: ' + (data.error || 'Échec'), current: 0, total: 0 })
      }
      
    } catch (error) {
      console.error('Error running test:', error)
      setTestProgress({ status: 'Erreur de connexion', current: 0, total: 0 })
    } finally {
      setTesting(false)
    }
  }

  // Handle zone save
  const handleZonesSave = () => {
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  // Check what's configured
  const hasUniversalPrompt = !!configUniversal?.base_prompt
  const hasTypePrompt = !!configType?.additional_prompt
  // Niveau 3 est configuré seulement si le dossier a une config_model_id liée
  const hasModelPrompt = !!folder?.config_model_id && (!!promptModel.trim() || zones.length > 0)

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

  // Format preview for index
  const formatPreview = 'X'.repeat(indexConfig.integerDigits) + 
    (indexConfig.decimalDigits > 0 ? ',' + 'X'.repeat(indexConfig.decimalDigits) : '')

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

      {/* Config Name Card - avec mode lecture/édition */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Nom de la configuration</label>
            <div className="flex gap-2 items-center">
              {isEditingName ? (
                <>
                  <Input 
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    placeholder="Ex: Config v1 - Zones précises"
                    className="max-w-md"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleSave}
                    disabled={saving || !configName.trim()}
                    title="Enregistrer"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border max-w-md flex-1">
                    <span className="font-medium">{configName}</span>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setIsEditingName(true)}
                    title="Modifier le nom"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleNewConfig}
                    title="Nouvelle config"
                  >
                    + Nouvelle
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {/* Niveaux configurés (lecture seule) */}
          <div className="flex items-center gap-4 border-l pl-4">
            <span className="text-sm font-medium">Niveaux configurés :</span>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                hasUniversalPrompt ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
              }`}>
                {hasUniversalPrompt && <CheckCircle2 className="h-3 w-3" />}
                Universel
              </span>
              <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                hasTypePrompt ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`}>
                {hasTypePrompt && <CheckCircle2 className="h-3 w-3" />}
                Type
              </span>
              <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                hasModelPrompt ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-400'
              }`}>
                {hasModelPrompt && <CheckCircle2 className="h-3 w-3" />}
                Modèle
              </span>
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

              {/* Layer 4: ROI Zones - sans Index de consommation */}
              {selectedLayer === 4 && referencePhoto && (
                <ROIEditor
                  imageUrl={referencePhoto.image_url}
                  zones={zones}
                  onZonesChange={setZones}
                  onSave={handleZonesSave}
                />
              )}

              {/* Layer 5: Index Config */}
              {selectedLayer === 5 && (
                <Card className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold">Couche 5 : Configuration Index</h3>
                    <p className="text-sm text-muted-foreground">
                      Format de l'index du compteur
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Chiffres entiers</label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={indexConfig.integerDigits}
                        onChange={(e) => setIndexConfig({ ...indexConfig, integerDigits: parseInt(e.target.value) || 5 })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Décimales</label>
                      <Input
                        type="number"
                        min={0}
                        max={5}
                        value={indexConfig.decimalDigits}
                        onChange={(e) => setIndexConfig({ ...indexConfig, decimalDigits: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-sm font-medium">Format attendu :</p>
                    <p className="font-mono text-lg mt-1">
                      {'X'.repeat(indexConfig.integerDigits)}
                      {indexConfig.decimalDigits > 0 && `,${('X'.repeat(indexConfig.decimalDigits))}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ex: {String(Math.floor(Math.random() * Math.pow(10, indexConfig.integerDigits))).padStart(indexConfig.integerDigits, '0')}
                      {indexConfig.decimalDigits > 0 && `,${String(Math.floor(Math.random() * Math.pow(10, indexConfig.decimalDigits))).padStart(indexConfig.decimalDigits, '0')}`}
                    </p>
                  </div>
                </Card>
              )}

              {/* Layer 9: Prompts (dernière couche) */}
              {selectedLayer === 9 && (
                <Card className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold">Couche 9 : Prompts</h3>
                    <p className="text-sm text-muted-foreground">
                      3 niveaux de prompts combinés
                    </p>
                  </div>

                  {/* Universal prompt (read-only) */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Niveau 1 - Universel</Badge>
                      <Badge variant="secondary">Lecture seule</Badge>
                      {configUniversal?.base_prompt && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                    </div>
                    <pre className="text-xs bg-gray-50 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {configUniversal?.base_prompt || 'Non configuré'}
                    </pre>
                  </div>

                  {/* Type prompt (read-only) */}
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Niveau 2 - Type</Badge>
                      {TYPE_ICONS[folder.detected_type]}
                      <span className="text-sm capitalize">{folder.detected_type}</span>
                      <Badge variant="secondary">Lecture seule</Badge>
                      {configType?.additional_prompt && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </div>
                    <pre className="text-xs bg-gray-50 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {configType?.additional_prompt || 'Aucun prompt spécifique pour ce type'}
                    </pre>
                  </div>

                  {/* Model prompt (editable + auto-generated preview) */}
                  <div className="border rounded-lg p-3 border-teal-200 bg-teal-50/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-teal-600">Niveau 3 - Modèle</Badge>
                      <Badge className="bg-teal-100 text-teal-700">Éditable</Badge>
                      {(promptModel || zones.length > 0) && <CheckCircle2 className="h-4 w-4 text-teal-600" />}
                    </div>
                    
                    {/* Manual prompt textarea */}
                    <Textarea
                      value={promptModel}
                      onChange={(e) => setPromptModel(e.target.value)}
                      placeholder="Instructions spécifiques pour ce modèle de compteur..."
                      className="font-mono text-sm min-h-20 mb-3"
                    />
                    
                    {/* Auto-generated preview */}
                    {(zones.length > 0 || indexConfig.integerDigits || indexConfig.decimalDigits) && (
                      <div className="border-t pt-3 mt-2">
                        <p className="text-xs font-medium text-teal-700 mb-2">
                          ✨ Prompt auto-généré depuis vos configurations :
                        </p>
                        <pre className="text-xs bg-white p-2 rounded border border-teal-100 max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {generateLevel3Preview()}
                        </pre>
                      </div>
                    )}
                  </div>
                  
                  {/* Hint */}
                  <p className="text-xs text-muted-foreground">
                    💡 Le Niveau 3 combine vos instructions manuelles + les zones ROI (Couche 4) + la config index (Couche 8)
                  </p>
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

              {/* Layer 8: Cohérence - Index de consommation avec photo de référence */}
              {selectedLayer === 8 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Photo de référence */}
                  <Card className="p-4">
                    <h4 className="font-medium mb-3">Photo de référence</h4>
                    {referencePhoto ? (
                      <div className="bg-gray-100 rounded-lg overflow-hidden">
                        <img 
                          src={referencePhoto.image_url} 
                          alt="Photo de référence" 
                          className="w-full h-auto max-h-[400px] object-contain"
                        />
                      </div>
                    ) : (
                      <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                        <p className="text-muted-foreground">Aucune photo de référence</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      📷 {folder.name}
                    </p>
                  </Card>

                  {/* Index de consommation config */}
                  <Card className="p-4 space-y-4">
                    <div>
                      <h3 className="font-semibold">Couche 8 : Cohérence</h3>
                      <p className="text-sm text-muted-foreground">
                        Format attendu pour l'index de consommation
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">Chiffres entiers</label>
                          <Select 
                            value={indexConfig.integerDigits.toString()} 
                            onValueChange={(v) => setIndexConfig({ ...indexConfig, integerDigits: parseInt(v) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[3, 4, 5, 6, 7, 8].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">Décimales</label>
                          <Select 
                            value={indexConfig.decimalDigits.toString()} 
                            onValueChange={(v) => setIndexConfig({ ...indexConfig, decimalDigits: parseInt(v) })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[0, 1, 2, 3].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">Format attendu</p>
                        <p className="font-mono text-3xl font-bold tracking-wider">
                          {formatPreview.split(',')[0]}
                          {indexConfig.decimalDigits > 0 && (
                            <span className="text-red-500">,{formatPreview.split(',')[1]}</span>
                          )}
                        </p>
                      </div>

                      <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                        <p className="font-medium mb-1">Règles de validation :</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-600">
                          <li>La lecture doit avoir {indexConfig.integerDigits} chiffres entiers</li>
                          {indexConfig.decimalDigits > 0 && (
                            <li>Suivi de {indexConfig.decimalDigits} décimale(s) en rouge</li>
                          )}
                          <li>Les valeurs incohérentes seront signalées</li>
                        </ul>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Layer 9: Multi-pass */}
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
