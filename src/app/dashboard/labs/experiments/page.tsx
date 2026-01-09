'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Upload, FolderOpen, Settings2, FlaskConical, CheckCircle2, Trash2, MoreVertical,
  ChevronRight, Loader2, AlertTriangle, Play, Eye, RefreshCw, Plus, Flame, Droplets,
  Bolt, Check, Sparkles, ArrowRight, XCircle, MoveRight, ExternalLink, Pencil,
  Image, X, Filter, Star, ImagePlus
} from 'lucide-react'

// Types
interface Folder {
  id: string; name: string; description: string | null; detected_type: string
  status: string; photo_count: number; min_photos_required: number
  is_unclassified?: boolean; reference_photo_id?: string | null
  reference_photo?: Photo | null; photos_since_last_test?: number
  last_test_at?: string | null; experiment_photos?: Photo[]
}
interface Photo {
  id: string; folder_id: string; image_url: string; thumbnail_url: string | null
  original_filename: string | null; detected_type: string; ai_confidence: number | null; status: string
  created_at?: string
}
interface ConfigUniversal { id: string; name: string; base_prompt: string; min_confidence: number; version: number }
interface ConfigType { id: string; meter_type: string; name: string; additional_prompt: string | null; typical_unit: string }
interface ConfigModel {
  id: string; name: string; manufacturer: string | null; is_promoted: boolean
  accuracy_rate: number | null; type_config_id: string | null; specific_prompt: string | null
}
interface Test {
  id: string; folder_id: string; name: string; total_photos: number
  successful_count: number; failed_count: number; accuracy_rate: number | null
  avg_confidence: number | null; avg_processing_time_ms: number | null
  total_cost_usd: number | null; status: string
  experiment_folders?: { id: string; name: string }
  experiment_test_results?: TestResult[]
}
interface TestResult {
  id: string; photo_id: string; actual_result: Record<string, unknown>
  confidence_score: number; is_correct: boolean | null; experiment_photos?: Photo
}

// Constants
const TYPE_ICONS: Record<string, React.ReactNode> = {
  gas: <Flame className="h-4 w-4 text-orange-500" />,
  water: <Droplets className="h-4 w-4 text-blue-500" />,
  electricity: <Bolt className="h-4 w-4 text-yellow-500" />,
  unknown: <AlertTriangle className="h-4 w-4 text-gray-400" />
}
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', ready: 'bg-green-100 text-green-700',
  testing: 'bg-blue-100 text-blue-700', validated: 'bg-purple-100 text-purple-700',
  promoted: 'bg-teal-100 text-teal-700'
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', ready: 'Prêt', testing: 'En test', validated: 'Validé', promoted: 'Promu'
}

// Compress image
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size < 500 * 1024) { resolve(file); return }
    const img = new window.Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    img.onload = () => {
      let { width, height } = img
      const MAX = 1200
      if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX }
      else if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX }
      canvas.width = width; canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => blob ? resolve(new File([blob], file.name, { type: 'image/jpeg' })) : reject(new Error('Compression failed')), 'image/jpeg', 0.8)
    }
    img.onerror = () => reject(new Error('Failed'))
    img.src = URL.createObjectURL(file)
  })
}

export default function ExperimentsPage() {
  const [activeTab, setActiveTab] = useState('import')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [configs, setConfigs] = useState<{ universal: ConfigUniversal | null; types: ConfigType[]; models: ConfigModel[] }>({ universal: null, types: [], models: [] })
  const [folders, setFolders] = useState<Folder[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedTest, setSelectedTest] = useState<Test | null>(null)
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBrand, setFilterBrand] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configModalLevel, setConfigModalLevel] = useState<'universal' | 'type' | 'model'>('universal')
  const [selectedConfigType, setSelectedConfigType] = useState<ConfigType | null>(null)
  const [selectedConfigModel, setSelectedConfigModel] = useState<ConfigModel | null>(null)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderType, setNewFolderType] = useState('unknown')
  const [deleteAlert, setDeleteAlert] = useState<{ type: 'photo' | 'photos' | 'folder'; ids: string[]; name?: string } | null>(null)
  const [limitAlert, setLimitAlert] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ step: '', current: 0, total: 0 })

  const loadData = useCallback(async () => {
    try {
      const [configsRes, foldersRes, testsRes] = await Promise.all([
        fetch('/api/labs/experiments/configs?level=all'),
        fetch('/api/labs/experiments/folders?with_photos=true'),
        fetch('/api/labs/experiments/tests')
      ])
      const [configsData, foldersData, testsData] = await Promise.all([configsRes.json(), foldersRes.json(), testsRes.json()])
      setConfigs({ universal: configsData.universal || null, types: configsData.types || [], models: configsData.models || [] })
      setFolders(foldersData.folders || [])
      setTests(testsData.tests || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false) }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (files.length > 20) { setLimitAlert(true); if (fileInputRef.current) fileInputRef.current.value = ''; return }
    setUploading(true)
    const total = files.length
    try {
      const compressed: File[] = []
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ step: 'Compression', current: i + 1, total })
        try { compressed.push(await compressImage(files[i])) } catch { compressed.push(files[i]) }
      }
      let success = 0, errors = 0
      for (let i = 0; i < compressed.length; i++) {
        setUploadProgress({ step: 'Upload + Analyse IA', current: i + 1, total })
        const fd = new FormData(); fd.append('files', compressed[i]); fd.append('auto_cluster', 'true')
        try {
          const res = await fetch('/api/labs/experiments/photos', { method: 'POST', body: fd })
          if (res.ok) { const d = await res.json(); success += d.success_count || 0; errors += d.error_count || 0 }
          else errors++
        } catch { errors++ }
      }
      if (errors > 0) alert(`${success} photos importées, ${errors} erreurs`)
      await loadData(); setActiveTab('folders')
    } catch (e) { console.error(e); alert('Erreur') }
    finally { setUploading(false); setUploadProgress({ step: '', current: 0, total: 0 }); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const handleDeletePhotos = async (ids: string[]) => {
    await fetch(`/api/labs/experiments/photos?ids=${ids.join(',')}`, { method: 'DELETE' })
    setDeleteAlert(null); await loadData()
  }
  const handleDeleteFolder = async (id: string) => {
    await fetch(`/api/labs/experiments/folders?id=${id}`, { method: 'DELETE' })
    setDeleteAlert(null); setSelectedFolderId(null); await loadData()
  }
  const handleMovePhotos = async (ids: string[], targetId: string) => {
    await fetch('/api/labs/experiments/photos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_ids: ids, target_folder_id: targetId }) })
    await loadData()
  }
  const handleSetReferencePhoto = async (folderId: string, photoId: string) => {
    await fetch('/api/labs/experiments/folders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: folderId, reference_photo_id: photoId }) })
    await loadData()
  }
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    await fetch('/api/labs/experiments/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFolderName, detected_type: newFolderType }) })
    setShowNewFolderModal(false); setNewFolderName(''); setNewFolderType('unknown'); await loadData()
  }
  const handleUpdateFolder = async (id: string, updates: { name?: string; detected_type?: string }) => {
    await fetch('/api/labs/experiments/folders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) })
    await loadData()
  }
  const handleRunTest = async (folderId: string) => {
    const res = await fetch('/api/labs/experiments/tests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder_id: folderId, run_immediately: true }) })
    const data = await res.json()
    if (data.test) { await loadData(); setActiveTab('tests'); setSelectedTest(data.test) }
  }
  const handlePromote = async (folderId: string) => {
    const res = await fetch('/api/labs/experiments/promote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder_id: folderId }) })
    const data = await res.json()
    if (data.meter_model) { await loadData(); alert(`Modèle ${data.action === 'created' ? 'créé' : 'mis à jour'}: ${data.meter_model.name}`) }
  }

  const formatPercent = (v: number | null) => v == null ? '-' : `${(v * 100).toFixed(1)}%`
  const selectedFolder = folders.find(f => f.id === selectedFolderId) || null
  const regularFolders = folders.filter(f => !f.is_unclassified)
  const unclassifiedFolder = folders.find(f => f.is_unclassified)
  
  // Extraire la marque (premier mot du nom)
  const extractBrand = (name: string) => name.split(' ')[0].toUpperCase()
  const brands = Array.from(new Set(regularFolders.map(f => extractBrand(f.name)))).sort()
  
  const filteredFolders = regularFolders.filter(f => 
    (filterType === 'all' || f.detected_type === filterType) && 
    (filterStatus === 'all' || f.status === filterStatus) &&
    (filterBrand === 'all' || extractBrand(f.name) === filterBrand)
  )
  
  // Pagination
  const totalPages = Math.ceil(filteredFolders.length / ITEMS_PER_PAGE)
  const paginatedFolders = filteredFolders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  
  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [filterType, filterStatus, filterBrand])
  
  const hasActiveFilters = filterType !== 'all' || filterStatus !== 'all' || filterBrand !== 'all'
  const typeStats = { gas: regularFolders.filter(f => f.detected_type === 'gas').length, water: regularFolders.filter(f => f.detected_type === 'water').length, electricity: regularFolders.filter(f => f.detected_type === 'electricity').length }
  const statusStats = { draft: regularFolders.filter(f => f.status === 'draft').length, ready: regularFolders.filter(f => f.status === 'ready').length, validated: regularFolders.filter(f => f.status === 'validated').length, promoted: regularFolders.filter(f => f.status === 'promoted').length }

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>

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
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />Actualiser
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="import"><Upload className="h-4 w-4 mr-2" />Import</TabsTrigger>
          <TabsTrigger value="folders"><FolderOpen className="h-4 w-4 mr-2" />Dossiers</TabsTrigger>
          <TabsTrigger value="configs"><Settings2 className="h-4 w-4 mr-2" />Configs</TabsTrigger>
          <TabsTrigger value="tests"><FlaskConical className="h-4 w-4 mr-2" />Tests</TabsTrigger>
          <TabsTrigger value="models"><CheckCircle2 className="h-4 w-4 mr-2" />Modèles</TabsTrigger>
        </TabsList>

        {/* IMPORT TAB */}
        <TabsContent value="import" className="space-y-6">
          <Card className="p-8">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
            <div className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${uploading ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-500 hover:bg-teal-50/50'}`} onClick={() => !uploading && fileInputRef.current?.click()}>
              {uploading ? (
                <div className="space-y-4">
                  <Loader2 className="h-12 w-12 mx-auto text-teal-600 animate-spin" />
                  <p className="text-lg font-medium">{uploadProgress.step} {uploadProgress.current}/{uploadProgress.total}</p>
                  <Progress value={(uploadProgress.current / uploadProgress.total) * 100} className="max-w-xs mx-auto" />
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium mb-2">Glissez vos photos ici</p>
                  <p className="text-sm text-muted-foreground mb-4">ou cliquez pour sélectionner (max 20)</p>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span>🤖 Analyse IA</span><span>📁 Classement intelligent</span>
                  </div>
                </>
              )}
            </div>
          </Card>
          <div className="grid grid-cols-4 gap-4">
            {[
              { icon: FolderOpen, bg: 'bg-gray-100', color: 'text-gray-600', value: regularFolders.length, label: 'Dossiers' },
              { icon: AlertTriangle, bg: 'bg-orange-100', color: 'text-orange-600', value: unclassifiedFolder?.photo_count || 0, label: 'Non classées' },
              { icon: Check, bg: 'bg-green-100', color: 'text-green-600', value: regularFolders.filter(f => f.status === 'ready').length, label: 'Prêts' },
              { icon: CheckCircle2, bg: 'bg-teal-100', color: 'text-teal-600', value: regularFolders.filter(f => f.status === 'promoted').length, label: 'Promus' },
            ].map((s, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                  <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* FOLDERS TAB */}
        <TabsContent value="folders" className="space-y-4">
          {selectedFolder ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <button onClick={() => setActiveTab('import')} className="text-muted-foreground hover:text-foreground">Experiments</button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <button onClick={() => setSelectedFolderId(null)} className="text-muted-foreground hover:text-foreground">Dossiers</button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedFolder.name}</span>
              </div>
              <FolderDetail
                key={selectedFolder.id + '-' + selectedFolder.photo_count}
                folderId={selectedFolder.id}
                folders={regularFolders}
                onBack={() => setSelectedFolderId(null)}
                onDelete={(id, name) => setDeleteAlert({ type: 'folder', ids: [id], name })}
                onDeletePhotos={(ids) => setDeleteAlert({ type: 'photos', ids })}
                onUpdateFolder={handleUpdateFolder}
                onMovePhotos={handleMovePhotos}
                onSetReferencePhoto={handleSetReferencePhoto}
                onRunTest={handleRunTest}
                onPromote={handlePromote}
                onRefresh={loadData}
              />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">{hasActiveFilters ? `${filteredFolders.length} filtré(s) sur ${regularFolders.length}` : `${regularFolders.length} dossier(s)`}</p>
                <Button size="sm" onClick={() => setShowNewFolderModal(true)}><Plus className="h-4 w-4 mr-2" />Nouveau dossier</Button>
              </div>
              <Card className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground mr-2">Filtres:</span>
                  {[{ k: 'all', l: `Tous (${regularFolders.length})` }, { k: 'gas', l: `🔥 Gaz (${typeStats.gas})` }, { k: 'water', l: `💧 Eau (${typeStats.water})` }, { k: 'electricity', l: `⚡ Élec (${typeStats.electricity})` }].map(f => (
                    <Button key={f.k} variant={filterType === f.k ? 'default' : 'outline'} size="sm" onClick={() => setFilterType(f.k)}>{f.l}</Button>
                  ))}
                  <div className="w-px h-6 bg-gray-200 mx-2" />
                  {[{ k: 'draft', l: `Brouillon (${statusStats.draft})` }, { k: 'ready', l: `Prêt (${statusStats.ready})` }, { k: 'validated', l: `Validé (${statusStats.validated})` }, { k: 'promoted', l: `Promu (${statusStats.promoted})` }].map(f => (
                    <Button key={f.k} variant={filterStatus === f.k ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterStatus(f.k)}>{f.l}</Button>
                  ))}
                  {brands.length > 0 && (
                    <>
                      <div className="w-px h-6 bg-gray-200 mx-2" />
                      <Select value={filterBrand} onValueChange={setFilterBrand}>
                        <SelectTrigger className="w-[150px] h-8">
                          <SelectValue placeholder="Marque" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes marques</SelectItem>
                          {brands.map(brand => (
                            <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  {hasActiveFilters && <><div className="w-px h-6 bg-gray-200 mx-2" /><Button variant="ghost" size="sm" onClick={() => { setFilterType('all'); setFilterStatus('all'); setFilterBrand('all') }} className="text-red-600"><X className="h-4 w-4 mr-1" />Réinitialiser</Button></>}
                </div>
              </Card>
              {unclassifiedFolder && unclassifiedFolder.photo_count > 0 && (
                <Card className="p-4 border-orange-200 bg-orange-50/50 cursor-pointer hover:shadow-md" onClick={() => setSelectedFolderId(unclassifiedFolder.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-orange-600" /></div>
                      <div><h3 className="font-semibold text-orange-800">Non classé</h3><p className="text-sm text-orange-600">{unclassifiedFolder.photo_count} photo(s) à trier</p></div>
                    </div>
                    <div className="flex items-center gap-4"><Badge className="bg-orange-100 text-orange-700">Pot commun</Badge><ChevronRight className="h-5 w-5 text-orange-400" /></div>
                  </div>
                </Card>
              )}
              {filteredFolders.length === 0 ? (
                <Card className="p-12 text-center">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-600 mb-2">{hasActiveFilters ? 'Aucun dossier ne correspond' : 'Aucun dossier'}</p>
                  {hasActiveFilters && <Button variant="outline" className="mt-4" onClick={() => { setFilterType('all'); setFilterStatus('all') }}>Réinitialiser</Button>}
                </Card>
              ) : (
                <>
                  <div className="space-y-3">
                    {paginatedFolders.map(folder => (
                      <Card key={folder.id} className="p-4 hover:shadow-md cursor-pointer" onClick={() => setSelectedFolderId(folder.id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                              {folder.reference_photo?.image_url ? <img src={folder.reference_photo.thumbnail_url || folder.reference_photo.image_url} alt="" className="w-full h-full object-cover" /> : TYPE_ICONS[folder.detected_type]}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{folder.name}</h3>
                                {folder.photos_since_last_test !== undefined && folder.photos_since_last_test > 0 && ['validated', 'promoted'].includes(folder.status) && (
                                  <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200"><ImagePlus className="h-3 w-3 mr-1" />+{folder.photos_since_last_test}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{folder.photo_count} photo{folder.photo_count > 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {folder.status === 'draft' && folder.photo_count < 5 && <div className="w-24"><Progress value={(folder.photo_count / 5) * 100} className="h-2" /><p className="text-xs text-muted-foreground text-center mt-1">{5 - folder.photo_count} manquante(s)</p></div>}
                            <Badge className={STATUS_COLORS[folder.status]}>{STATUS_LABELS[folder.status]}</Badge>
                            {folder.status === 'ready' && (
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); handleRunTest(folder.id) }}><Play className="h-4 w-4 mr-1" />Tester</Button>
                            )}
                            {folder.status !== 'ready' && folder.photos_since_last_test !== undefined && folder.photos_since_last_test > 0 && ['validated', 'promoted'].includes(folder.status) && (
                              <Button size="sm" variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50" onClick={(e) => { e.stopPropagation(); handleRunTest(folder.id) }}><Play className="h-4 w-4 mr-1" />Relancer</Button>
                            )}
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Précédent</Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <Button key={page} variant={currentPage === page ? 'default' : 'ghost'} size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(page)}>{page}</Button>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Suivant</Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* CONFIGS TAB */}
        <TabsContent value="configs" className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">🌍 Configuration Universelle</h3>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium">{configs.universal?.name || 'Configuration universelle'}</p><p className="text-sm text-muted-foreground">Version {configs.universal?.version || 1}</p></div>
                <Button variant="outline" onClick={() => { setConfigModalLevel('universal'); setShowConfigModal(true) }}><Eye className="h-4 w-4 mr-2" />Éditer</Button>
              </div>
            </Card>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3">📦 Par Type</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {configs.types.map(type => (
                <Card key={type.id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">{TYPE_ICONS[type.meter_type]}<span className="font-medium">{type.name}</span></div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { setSelectedConfigType(type); setConfigModalLevel('type'); setShowConfigModal(true) }}><Eye className="h-4 w-4 mr-2" />Éditer</Button>
                </Card>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">🎯 Par Modèle</h3>
              <Button size="sm" onClick={() => { setSelectedConfigModel(null); setConfigModalLevel('model'); setShowConfigModal(true) }}><Plus className="h-4 w-4 mr-2" />Nouvelle config</Button>
            </div>
            {configs.models.length === 0 ? <Card className="p-8 text-center"><p className="text-muted-foreground">Aucune config spécifique</p></Card> : (
              <div className="grid md:grid-cols-2 gap-4">
                {configs.models.map(model => (
                  <Card key={model.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div><p className="font-medium">{model.name}</p><p className="text-xs text-muted-foreground">{model.manufacturer || 'Inconnu'}</p></div>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedConfigModel(model); setConfigModalLevel('model'); setShowConfigModal(true) }}><Eye className="h-4 w-4 mr-2" />Éditer</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TESTS TAB */}
        <TabsContent value="tests" className="space-y-6">
          {selectedTest ? <TestDetail test={selectedTest} onBack={() => setSelectedTest(null)} onRefresh={loadData} /> : tests.length === 0 ? (
            <Card className="p-12 text-center"><FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p className="text-lg font-medium text-gray-600 mb-2">Aucun test</p></Card>
          ) : (
            <div className="space-y-4">
              {tests.map(test => (
                <Card key={test.id} className="p-4 hover:shadow-md cursor-pointer" onClick={() => setSelectedTest(test)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${test.status === 'completed' ? (test.accuracy_rate && test.accuracy_rate >= 0.8 ? 'bg-green-100' : 'bg-orange-100') : test.status === 'running' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        {test.status === 'running' ? <Loader2 className="h-5 w-5 text-blue-600 animate-spin" /> : test.status === 'completed' ? (test.accuracy_rate && test.accuracy_rate >= 0.8 ? <Check className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-orange-600" />) : <FlaskConical className="h-5 w-5 text-gray-600" />}
                      </div>
                      <div><p className="font-medium">{test.name}</p><p className="text-sm text-muted-foreground">{test.experiment_folders?.name} • {test.total_photos} photos</p></div>
                    </div>
                    <div className="flex items-center gap-6">
                      {test.status === 'completed' && <><div className="text-center"><p className="text-2xl font-bold">{formatPercent(test.accuracy_rate)}</p><p className="text-xs text-muted-foreground">Précision</p></div><div className="text-center"><p className="text-lg font-semibold">{formatPercent(test.avg_confidence)}</p><p className="text-xs text-muted-foreground">Confiance</p></div></>}
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MODELS TAB */}
        <TabsContent value="models" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center"><CheckCircle2 className="h-6 w-6 text-teal-600" /></div>
              <div><h3 className="font-semibold">Modèles promus</h3><p className="text-sm text-muted-foreground">Disponibles dans Compteurs &gt; Modèles</p></div>
            </div>
            {regularFolders.filter(f => f.status === 'promoted').length === 0 ? <div className="text-center py-8"><p className="text-muted-foreground">Aucun modèle promu</p></div> : (
              <div className="space-y-3">
                {regularFolders.filter(f => f.status === 'promoted').map(folder => (
                  <div key={folder.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {folder.reference_photo?.image_url ? <img src={folder.reference_photo.thumbnail_url || folder.reference_photo.image_url} alt="" className="w-10 h-10 rounded object-cover" /> : TYPE_ICONS[folder.detected_type]}
                      <span className="font-medium">{folder.name}</span>
                      {folder.photos_since_last_test !== undefined && folder.photos_since_last_test > 0 && <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">+{folder.photos_since_last_test}</Badge>}
                    </div>
                    <Button variant="outline" size="sm" asChild><a href="/dashboard/meters"><ExternalLink className="h-4 w-4 mr-2" />Voir</a></Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <Dialog open={showNewFolderModal} onOpenChange={setShowNewFolderModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau dossier</DialogTitle><DialogDescription>Créez un dossier vide</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium mb-2 block">Nom</label><Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ex: ITRON G4" /></div>
            <div><label className="text-sm font-medium mb-2 block">Type</label><Select value={newFolderType} onValueChange={setNewFolderType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gas">🔥 Gaz</SelectItem><SelectItem value="water">💧 Eau</SelectItem><SelectItem value="electricity">⚡ Électricité</SelectItem><SelectItem value="unknown">❓ Non défini</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowNewFolderModal(false)}>Annuler</Button><Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Créer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{configModalLevel === 'universal' ? '🌍 Configuration Universelle' : configModalLevel === 'type' ? `📦 ${selectedConfigType?.name}` : `🎯 ${selectedConfigModel?.name || 'Nouveau'}`}</DialogTitle></DialogHeader>
          <ConfigEditor level={configModalLevel} universal={configs.universal} type={selectedConfigType} model={selectedConfigModel} types={configs.types} onSave={async () => { await loadData(); setShowConfigModal(false) }} onCancel={() => setShowConfigModal(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAlert} onOpenChange={(o) => !o && setDeleteAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmer la suppression</AlertDialogTitle><AlertDialogDescription>{deleteAlert?.type === 'photos' ? `${deleteAlert.ids.length} photo(s) seront supprimées.` : deleteAlert?.type === 'folder' ? `Le dossier "${deleteAlert?.name}" sera supprimé.` : 'Cette photo sera supprimée.'}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteAlert?.type === 'folder' ? handleDeleteFolder(deleteAlert.ids[0]) : handleDeletePhotos(deleteAlert?.ids || [])}>Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={limitAlert} onOpenChange={setLimitAlert}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Limite dépassée</AlertDialogTitle><AlertDialogDescription>Maximum 20 photos par upload.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogAction>Compris</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ============================================
// FOLDER DETAIL COMPONENT
// ============================================
function FolderDetail({ folderId, folders, onBack, onDelete, onDeletePhotos, onUpdateFolder, onMovePhotos, onSetReferencePhoto, onRunTest, onPromote, onRefresh }: {
  folderId: string; folders: Folder[]; onBack: () => void; onDelete: (id: string, name: string) => void
  onDeletePhotos: (ids: string[]) => void; onUpdateFolder: (id: string, u: { name?: string; detected_type?: string }) => void
  onMovePhotos: (ids: string[], fid: string) => void; onSetReferencePhoto: (fid: string, pid: string) => void
  onRunTest: (id: string) => void; onPromote: (id: string) => void; onRefresh: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [folder, setFolder] = useState<Folder | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const res = await fetch(`/api/labs/experiments/folders?id=${folderId}`)
      const data = await res.json()
      if (data.folder) { setFolder(data.folder); setPhotos(data.folder.experiment_photos || []); setEditName(data.folder.name); setEditType(data.folder.detected_type) }
      setLoading(false)
    })()
  }, [folderId])

  const handleSave = async () => { if (!folder) return; await onUpdateFolder(folder.id, { name: editName, detected_type: editType }); setFolder({ ...folder, name: editName, detected_type: editType }); setEditing(false); onRefresh() }
  const handleMovePhoto = async (pid: string, tid: string) => { await onMovePhotos([pid], tid); setPhotos(photos.filter(p => p.id !== pid)); onRefresh() }
  const toggleSelect = (id: string) => setSelectedPhotos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = () => setSelectedPhotos(selectedPhotos.size === photos.length ? new Set() : new Set(photos.map(p => p.id)))
  const deleteSelected = async () => { 
    if (selectedPhotos.size > 0) { 
      setDeleting(true)
      await onDeletePhotos(Array.from(selectedPhotos))
      setSelectedPhotos(new Set())
      setSelectionMode(false)
      setDeleting(false)
    } 
  }
  const cancelSelection = () => { setSelectedPhotos(new Set()); setSelectionMode(false) }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (!folder) return null

  const isUnclassified = folder.is_unclassified
  
  // Nombre de nouvelles photos depuis le dernier test
  const newPhotosCount = folder.photos_since_last_test || 0
  const hasNewPhotos = newPhotosCount > 0 && ['validated', 'promoted'].includes(folder.status)
  
  // Pour les dossiers validés/promus avec nouvelles photos, on sépare visuellement
  // Note: On ne peut pas identifier exactement quelles photos sont "nouvelles" sans created_at
  // Donc on affiche juste un message informatif
  
  const referencePhoto = photos.find(p => p.id === folder.reference_photo_id) || photos[0]
  const otherPhotos = referencePhoto ? photos.filter(p => p.id !== referencePhoto.id) : photos

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {editing && !isUnclassified ? (
            <div className="flex items-center gap-2">
              <Select value={editType} onValueChange={setEditType}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gas">🔥 Gaz</SelectItem><SelectItem value="water">💧 Eau</SelectItem><SelectItem value="electricity">⚡ Élec</SelectItem><SelectItem value="unknown">❓</SelectItem></SelectContent></Select>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-64" />
              <Button size="sm" onClick={handleSave}><Check className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}><XCircle className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {isUnclassified ? <AlertTriangle className="h-5 w-5 text-orange-500" /> : TYPE_ICONS[folder.detected_type]}
              <div><h2 className="text-xl font-bold">{folder.name}</h2><p className="text-sm text-muted-foreground">{photos.length} photo(s)</p></div>
              {!isUnclassified && <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>}
              <Badge className={isUnclassified ? 'bg-orange-100 text-orange-700' : STATUS_COLORS[folder.status]}>{isUnclassified ? 'Pot commun' : STATUS_LABELS[folder.status]}</Badge>
              {folder.photos_since_last_test !== undefined && folder.photos_since_last_test > 0 && !isUnclassified && ['validated', 'promoted'].includes(folder.status) && <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200"><ImagePlus className="h-3 w-3 mr-1" />+{folder.photos_since_last_test}</Badge>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isUnclassified && folder.status === 'ready' && <Button onClick={() => onRunTest(folder.id)}><Play className="h-4 w-4 mr-2" />Tester</Button>}
          {!isUnclassified && folder.status !== 'ready' && folder.photos_since_last_test !== undefined && folder.photos_since_last_test > 0 && ['validated', 'promoted'].includes(folder.status) && <Button variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => onRunTest(folder.id)}><Play className="h-4 w-4 mr-2" />Relancer</Button>}
          {!isUnclassified && folder.status === 'validated' && <Button onClick={() => onPromote(folder.id)} className="bg-teal-600 hover:bg-teal-700"><ArrowRight className="h-4 w-4 mr-2" />Promouvoir</Button>}
          {!isUnclassified && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem className="text-red-600" onClick={() => onDelete(folder.id, folder.name)}><Trash2 className="h-4 w-4 mr-2" />Supprimer</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
        </div>
      </div>

      {/* Alerts */}
      {!isUnclassified && folder.status === 'draft' && photos.length < 5 && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-4"><AlertTriangle className="h-5 w-5 text-orange-600" /><div className="flex-1"><p className="font-medium text-orange-800">{5 - photos.length} photo(s) manquante(s)</p><Progress value={(photos.length / 5) * 100} className="h-2 mt-2" /></div></div>
        </Card>
      )}
      {isUnclassified && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-4"><AlertTriangle className="h-5 w-5 text-orange-600" /><div><p className="font-medium text-orange-800">Photos à classer</p><p className="text-sm text-orange-600">Déplacez ces photos vers les dossiers appropriés.</p></div></div>
        </Card>
      )}

      {/* Selection toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Photos ({photos.length})</h3>
        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <Button variant="outline" size="sm" onClick={selectAll} disabled={deleting}>{selectedPhotos.size === photos.length ? 'Désélectionner tout' : 'Tout sélectionner'}</Button>
              <span className="text-sm text-muted-foreground">{selectedPhotos.size} sélectionnée(s)</span>
              <Button variant="destructive" size="sm" onClick={deleteSelected} disabled={selectedPhotos.size === 0 || deleting}>
                {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                {deleting ? 'Suppression...' : 'Supprimer'}
              </Button>
              <Button variant="outline" size="sm" onClick={cancelSelection} disabled={deleting}>Annuler</Button>
            </>
          ) : (
            photos.length > 0 && <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>Sélectionner</Button>
          )}
        </div>
      </div>

      {/* Message nouvelles photos */}
      {!isUnclassified && hasNewPhotos && (
        <Card className="p-4 border-orange-200 bg-orange-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ImagePlus className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">{newPhotosCount} nouvelle(s) photo(s) ajoutée(s) depuis le dernier test</p>
                <p className="text-sm text-orange-600">Relancez un test pour valider ces nouvelles photos</p>
              </div>
            </div>
            <Button variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-100" onClick={() => onRunTest(folder.id)}>
              <Play className="h-4 w-4 mr-2" />Relancer le test
            </Button>
          </div>
        </Card>
      )}

      {/* Photos grid with reference */}
      {photos.length === 0 ? (
        <Card className="p-8 text-center"><Image className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p className="text-muted-foreground">Aucune photo</p></Card>
      ) : !isUnclassified && referencePhoto ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reference photo - large */}
          <div className="lg:col-span-1">
            <p className="text-sm font-medium mb-2 flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" />Photo de référence</p>
            <div className="relative group">
              <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-yellow-400">
                <img src={referencePhoto.image_url} alt="" className="w-full h-full object-cover" />
              </div>
              {selectionMode && (
                <div className="absolute top-2 left-2"><Checkbox checked={selectedPhotos.has(referencePhoto.id)} onCheckedChange={() => toggleSelect(referencePhoto.id)} className="h-6 w-6 bg-white" /></div>
              )}
              {referencePhoto.ai_confidence !== null && <div className="absolute bottom-2 right-2 bg-black/60 text-white text-sm px-2 py-1 rounded">{referencePhoto.ai_confidence}%</div>}
            </div>
          </div>
          {/* Other photos */}
          <div className="lg:col-span-2">
            <p className="text-sm font-medium mb-2">Autres photos ({otherPhotos.length})</p>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {otherPhotos.map(photo => (
                <div key={photo.id} className="relative group">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <img src={photo.thumbnail_url || photo.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                  {selectionMode ? (
                    <div className="absolute top-1 left-1"><Checkbox checked={selectedPhotos.has(photo.id)} onCheckedChange={() => toggleSelect(photo.id)} className="h-5 w-5 bg-white" /></div>
                  ) : (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                      <Button size="sm" variant="secondary" onClick={() => onSetReferencePhoto(folder.id, photo.id)} title="Définir comme référence"><Star className="h-4 w-4" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="sm" variant="secondary"><MoveRight className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>{folders.filter(f => f.id !== folder.id).map(f => <DropdownMenuItem key={f.id} onClick={() => handleMovePhoto(photo.id, f.id)}>{TYPE_ICONS[f.detected_type]}<span className="ml-2">{f.name}</span></DropdownMenuItem>)}</DropdownMenuContent>
                      </DropdownMenu>
                      <Button size="sm" variant="destructive" onClick={() => onDeletePhotos([photo.id])}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                  {photo.ai_confidence !== null && <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">{photo.ai_confidence}%</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Unclassified or no reference - simple grid */
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {photos.map(photo => (
            <div key={photo.id} className="relative group">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img src={photo.thumbnail_url || photo.image_url} alt="" className="w-full h-full object-cover" />
              </div>
              {selectionMode ? (
                <div className="absolute top-1 left-1"><Checkbox checked={selectedPhotos.has(photo.id)} onCheckedChange={() => toggleSelect(photo.id)} className="h-5 w-5 bg-white" /></div>
              ) : (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="sm" variant="secondary"><MoveRight className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>{folders.filter(f => f.id !== folder.id).map(f => <DropdownMenuItem key={f.id} onClick={() => handleMovePhoto(photo.id, f.id)}>{TYPE_ICONS[f.detected_type]}<span className="ml-2">{f.name}</span></DropdownMenuItem>)}</DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="destructive" onClick={() => onDeletePhotos([photo.id])}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
              {photo.ai_confidence !== null && <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">{photo.ai_confidence}%</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// TEST DETAIL COMPONENT
// ============================================
function TestDetail({ test, onBack, onRefresh }: { test: Test; onBack: () => void; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false)
  const [fullTest, setFullTest] = useState<Test | null>(null)

  useEffect(() => {
    (async () => { setLoading(true); const res = await fetch(`/api/labs/experiments/tests?id=${test.id}`); setFullTest((await res.json()).test); setLoading(false) })()
  }, [test.id])

  const results = fullTest?.experiment_test_results || []
  const handleMark = async (rid: string, correct: boolean) => {
    await fetch('/api/labs/experiments/tests', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result_id: rid, is_correct: correct }) })
    const res = await fetch(`/api/labs/experiments/tests?id=${test.id}`); setFullTest((await res.json()).test); onRefresh()
  }
  const fmt = (v: number | null) => v == null ? '-' : `${(v * 100).toFixed(1)}%`

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4"><Button variant="ghost" onClick={onBack}>← Retour</Button><div><h2 className="text-xl font-bold">{test.name}</h2><p className="text-sm text-muted-foreground">{test.total_photos} photos testées</p></div></div>
      <div className="grid grid-cols-4 gap-4">
        {[{ l: 'Précision', v: fmt(fullTest?.accuracy_rate ?? test.accuracy_rate), big: true }, { l: 'Confiance', v: fmt(fullTest?.avg_confidence ?? test.avg_confidence) }, { l: 'Temps moy.', v: `${fullTest?.avg_processing_time_ms || test.avg_processing_time_ms || '-'}ms` }, { l: 'Coût', v: `$${(fullTest?.total_cost_usd ?? test.total_cost_usd ?? 0).toFixed(4)}` }].map((s, i) => (
          <Card key={i} className="p-4 text-center"><p className={s.big ? 'text-3xl font-bold' : 'text-xl font-bold'}>{s.v}</p><p className="text-sm text-muted-foreground">{s.l}</p></Card>
        ))}
      </div>
      <div><h3 className="font-semibold mb-3">Résultats</h3>
        <div className="space-y-3">
          {results.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">{r.experiment_photos && <img src={r.experiment_photos.thumbnail_url || r.experiment_photos.image_url} alt="" className="w-full h-full object-cover" />}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {r.is_correct === true && <Check className="h-5 w-5 text-green-600" />}
                    {r.is_correct === false && <XCircle className="h-5 w-5 text-red-600" />}
                    {r.is_correct === null && <AlertTriangle className="h-5 w-5 text-gray-400" />}
                    <span className="font-medium">{(r.actual_result as { reading?: string })?.reading || 'Pas de lecture'}</span>
                    <Badge variant="outline">{(r.confidence_score * 100).toFixed(0)}%</Badge>
                  </div>
                </div>
                {r.is_correct === null && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => handleMark(r.id, true)}><Check className="h-4 w-4 text-green-600" /></Button><Button size="sm" variant="outline" onClick={() => handleMark(r.id, false)}><XCircle className="h-4 w-4 text-red-600" /></Button></div>}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================
// CONFIG EDITOR COMPONENT
// ============================================
function ConfigEditor({ level, universal, type, model, types, onSave, onCancel }: { level: 'universal' | 'type' | 'model'; universal: ConfigUniversal | null; type: ConfigType | null; model: ConfigModel | null; types: ConfigType[]; onSave: () => void; onCancel: () => void }) {
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
      if (level === 'universal') await fetch('/api/labs/experiments/configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'universal', id: universal?.id, base_prompt: basePrompt, min_confidence: minConfidence }) })
      else if (level === 'type') await fetch('/api/labs/experiments/configs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'type', id: type?.id, additional_prompt: additionalPrompt }) })
      else await fetch('/api/labs/experiments/configs', { method: model ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'model', id: model?.id, name: modelName, manufacturer, specific_prompt: specificPrompt, type_config_id: typeConfigId || null }) })
      await onSave()
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      {level === 'universal' && <>
        <div><label className="text-sm font-medium mb-2 block">Prompt de base</label><Textarea value={basePrompt} onChange={(e) => setBasePrompt(e.target.value)} className="font-mono text-sm h-64" /></div>
        <div><label className="text-sm font-medium mb-2 block">Confiance min: {minConfidence}</label><input type="range" min="0" max="1" step="0.05" value={minConfidence} onChange={(e) => setMinConfidence(parseFloat(e.target.value))} className="w-full" /></div>
      </>}
      {level === 'type' && <div><label className="text-sm font-medium mb-2 block">Prompt additionnel</label><Textarea value={additionalPrompt} onChange={(e) => setAdditionalPrompt(e.target.value)} className="font-mono text-sm h-48" /></div>}
      {level === 'model' && <>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm font-medium mb-2 block">Nom</label><Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="ITRON G4" /></div>
          <div><label className="text-sm font-medium mb-2 block">Fabricant</label><Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Itron" /></div>
        </div>
        <div><label className="text-sm font-medium mb-2 block">Type</label><Select value={typeConfigId} onValueChange={setTypeConfigId}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
        <div><div className="flex items-center justify-between mb-2"><label className="text-sm font-medium">Prompt spécifique</label><Button variant="outline" size="sm"><Sparkles className="h-4 w-4 mr-2" />Générer IA</Button></div><Textarea value={specificPrompt} onChange={(e) => setSpecificPrompt(e.target.value)} className="font-mono text-sm h-32" placeholder="Instructions..." /></div>
      </>}
      <DialogFooter><Button variant="outline" onClick={onCancel}>Annuler</Button><Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sauvegarder</Button></DialogFooter>
    </div>
  )
}
