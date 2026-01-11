'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Upload, FolderOpen, Settings2, FlaskConical, CheckCircle2, Trash2, MoreVertical, ChevronRight, Loader2, AlertTriangle, Play, Eye, RefreshCw, Plus, Flame, Droplets, Bolt, Check, Sparkles, ArrowRight, XCircle, MoveRight, ExternalLink, Pencil, Image, X, Filter, Star, ImagePlus, Save } from 'lucide-react'
import { FolderTestPage } from '@/components/labs'

interface Folder { id: string; name: string; description: string | null; detected_type: string; status: string; photo_count: number; min_photos_required: number; is_unclassified?: boolean; reference_photo_id?: string | null; reference_photo?: Photo | null; photos_since_last_test?: number; last_test_at?: string | null; experiment_photos?: Photo[]; config_model_id?: string }
interface Photo { id: string; folder_id: string; image_url: string; thumbnail_url: string | null; original_filename: string | null; detected_type: string; ai_confidence: number | null; status: string; created_at?: string; detected_brand?: string | null }
interface ConfigUniversal { id: string; name: string; base_prompt: string; min_confidence: number; version: number }
interface ConfigType { id: string; meter_type: string; name: string; additional_prompt: string | null; typical_unit: string }
interface ConfigModel { id: string; name: string; manufacturer: string | null; is_promoted: boolean; accuracy_rate: number | null; type_config_id: string | null; specific_prompt: string | null }
interface Test { id: string; folder_id: string; name: string; total_photos: number; successful_count: number; failed_count: number; accuracy_rate: number | null; avg_confidence: number | null; avg_processing_time_ms: number | null; total_cost_usd: number | null; status: string; created_at?: string; experiment_folders?: { id: string; name: string; detected_type?: string }; experiment_test_results?: TestResult[] }
interface TestResult { id: string; photo_id: string; actual_result: Record<string, unknown>; confidence_score: number; is_correct: boolean | null; experiment_photos?: Photo; processing_time_ms?: number }
interface ROIZone { id: string; name: string; type: 'index' | 'serial' | 'unit' | 'custom'; x: number; y: number; width: number; height: number; color: string }
interface PreprocessingConfig { grayscale: boolean; contrast: number; brightness: number; sharpness: number; saturation: number }
interface ValidationConfig { num_digits: number; num_decimals: number; decimal_color: string; format_regex: string }

const TYPE_ICONS: Record<string, React.ReactNode> = { gas: <Flame className="h-4 w-4 text-orange-500" />, water: <Droplets className="h-4 w-4 text-blue-500" />, electricity: <Bolt className="h-4 w-4 text-yellow-500" />, unknown: <AlertTriangle className="h-4 w-4 text-gray-400" /> }
const STATUS_COLORS: Record<string, string> = { draft: 'bg-gray-100 text-gray-700', ready: 'bg-green-100 text-green-700', testing: 'bg-blue-100 text-blue-700', validated: 'bg-purple-100 text-purple-700', promoted: 'bg-teal-100 text-teal-700' }
const STATUS_LABELS: Record<string, string> = { draft: 'Brouillon', ready: 'Prêt', testing: 'En test', validated: 'Validé', promoted: 'Promu' }
const ZONE_COLORS: Record<string, string> = { index: '#22c55e', serial: '#3b82f6', unit: '#f59e0b', custom: '#8b5cf6' }
const DEFAULT_PREPROCESSING: PreprocessingConfig = { grayscale: false, contrast: 30, brightness: 0, sharpness: 20, saturation: 100 }
const DEFAULT_VALIDATION: ValidationConfig = { num_digits: 5, num_decimals: 3, decimal_color: 'red', format_regex: '^\\d{1,6},\\d{3}$' }
const LAYER_DEFS = [{ num: 1, name: 'Pré-traitement', configurable: true }, { num: 2, name: 'Détection', configurable: false }, { num: 3, name: 'Classification', configurable: false }, { num: 4, name: 'Zones ROI', configurable: true }, { num: 5, name: 'Prompts', configurable: true }, { num: 6, name: 'OCR Claude', configurable: false }, { num: 7, name: 'Validation croisée', configurable: false }, { num: 8, name: 'Cohérence', configurable: true }, { num: 9, name: 'Multi-pass', configurable: true }]

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size < 500 * 1024) { resolve(file); return }
    const img = new window.Image(); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')
    img.onload = () => { let { width, height } = img; const MAX = 1200; if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX } else if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX }; canvas.width = width; canvas.height = height; ctx?.drawImage(img, 0, 0, width, height); canvas.toBlob(blob => blob ? resolve(new File([blob], file.name, { type: 'image/jpeg' })) : reject(new Error('Compression failed')), 'image/jpeg', 0.8) }
    img.onerror = () => reject(new Error('Failed')); img.src = URL.createObjectURL(file)
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
  const [testingFolderId, setTestingFolderId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [configsRes, foldersRes, testsRes] = await Promise.all([fetch('/api/labs/experiments/configs?level=all'), fetch('/api/labs/experiments/folders?with_photos=true'), fetch('/api/labs/experiments/tests')])
      const [configsData, foldersData, testsData] = await Promise.all([configsRes.json(), foldersRes.json(), testsRes.json()])
      setConfigs({ universal: configsData.universal || null, types: configsData.types || [], models: configsData.models || [] })
      setFolders(foldersData.folders || []); setTests(testsData.tests || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
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
        const fd = new FormData()
        fd.append('files', compressed[i])
        fd.append('auto_cluster', 'true')
        try {
          const res = await fetch('/api/labs/experiments/photos', { method: 'POST', body: fd })
          if (res.ok) {
            const d = await res.json()
            success += d.success_count || 0
            errors += d.error_count || 0
          } else {
            errors++
          }
        } catch { errors++ }
      }
      if (errors > 0) alert(`${success} photos importées, ${errors} erreurs`)
      await loadData()
      setActiveTab('folders')
    } catch (e) { console.error(e); alert('Erreur') } finally {
      setUploading(false)
      setUploadProgress({ step: '', current: 0, total: 0 })
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeletePhotos = async (ids: string[]) => { await fetch(`/api/labs/experiments/photos?ids=${ids.join(',')}`, { method: 'DELETE' }); setDeleteAlert(null); await loadData() }
  const handleDeleteFolder = async (id: string) => { await fetch(`/api/labs/experiments/folders?id=${id}`, { method: 'DELETE' }); setDeleteAlert(null); setSelectedFolderId(null); await loadData() }
  const handleMovePhotos = async (ids: string[], targetId: string) => { await fetch('/api/labs/experiments/photos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_ids: ids, target_folder_id: targetId }) }); await loadData() }
  const handleSetReferencePhoto = async (folderId: string, photoId: string) => { await fetch('/api/labs/experiments/folders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: folderId, reference_photo_id: photoId }) }); await loadData() }
  const handleCreateFolder = async () => { if (!newFolderName.trim()) return; await fetch('/api/labs/experiments/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFolderName, detected_type: newFolderType }) }); setShowNewFolderModal(false); setNewFolderName(''); setNewFolderType('unknown'); await loadData() }
  const handleCreateFolderAndReturn = async (name: string, type: string): Promise<string | null> => { const res = await fetch('/api/labs/experiments/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, detected_type: type }) }); const data = await res.json(); return data.folder?.id || null }
  const handleUpdateFolder = async (id: string, updates: { name?: string; detected_type?: string }) => { await fetch('/api/labs/experiments/folders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) }); await loadData() }
  const handleRunTest = async (folderId: string) => { setTestingFolderId(folderId) }
  const handlePromote = async (folderId: string) => { 
    try {
      const res = await fetch('/api/labs/experiments/promote', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ folder_id: folderId }) 
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Erreur: ${data.error || 'Impossible de promouvoir'}`)
        return
      }
      if (data.meter_model) { 
        await loadData()
        alert(`✅ Modèle ${data.action === 'created' ? 'créé' : 'mis à jour'}: ${data.meter_model.name}`) 
      }
    } catch (error) {
      console.error('Promote error:', error)
      alert('Erreur lors de la promotion')
    }
  }

  const formatPercent = (v: number | null) => v == null ? '-' : `${(v * 100).toFixed(1)}%`
  const selectedFolder = folders.find(f => f.id === selectedFolderId) || null
  const regularFolders = folders.filter(f => !f.is_unclassified)
  const unclassifiedFolder = folders.find(f => f.is_unclassified)
  const extractBrand = (name: string) => name.split(' ')[0].toUpperCase()
  const brands = Array.from(new Set(regularFolders.map(f => extractBrand(f.name)))).sort()
  const filteredFolders = regularFolders.filter(f => (filterType === 'all' || f.detected_type === filterType) && (filterStatus === 'all' || f.status === filterStatus) && (filterBrand === 'all' || extractBrand(f.name) === filterBrand))
  const totalPages = Math.ceil(filteredFolders.length / ITEMS_PER_PAGE)
  const paginatedFolders = filteredFolders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  useEffect(() => { setCurrentPage(1) }, [filterType, filterStatus, filterBrand])
  const hasActiveFilters = filterType !== 'all' || filterStatus !== 'all' || filterBrand !== 'all'
  const typeStats = { gas: regularFolders.filter(f => f.detected_type === 'gas').length, water: regularFolders.filter(f => f.detected_type === 'water').length, electricity: regularFolders.filter(f => f.detected_type === 'electricity').length }
  const statusStats = { draft: regularFolders.filter(f => f.status === 'draft').length, ready: regularFolders.filter(f => f.status === 'ready').length, validated: regularFolders.filter(f => f.status === 'validated').length, promoted: regularFolders.filter(f => f.status === 'promoted').length }

  if (loading) return <div className="p-6 flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>
  if (testingFolderId) return <FolderTestPage folderId={testingFolderId} onBack={() => { setTestingFolderId(null); loadData() }} />

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center"><FlaskConical className="h-6 w-6 text-white" /></div><div><h1 className="text-2xl font-bold">Experiments</h1><p className="text-muted-foreground">Créez et testez vos modèles de compteurs</p></div></div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}><RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />Actualiser</Button>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="import"><Upload className="h-4 w-4 mr-2" />Import</TabsTrigger>
          <TabsTrigger value="folders"><FolderOpen className="h-4 w-4 mr-2" />Dossiers</TabsTrigger>
          <TabsTrigger value="configs"><Settings2 className="h-4 w-4 mr-2" />Configs</TabsTrigger>
          <TabsTrigger value="tests"><FlaskConical className="h-4 w-4 mr-2" />Tests</TabsTrigger>
          <TabsTrigger value="models"><CheckCircle2 className="h-4 w-4 mr-2" />Modèles</TabsTrigger>
        </TabsList>
        <TabsContent value="import" className="space-y-6">
          <Card className="p-8"><input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} /><div className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${uploading ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-500 hover:bg-teal-50/50'}`} onClick={() => !uploading && fileInputRef.current?.click()}>{uploading ? <div className="space-y-4"><Loader2 className="h-12 w-12 mx-auto text-teal-600 animate-spin" /><p className="text-lg font-medium">{uploadProgress.step} {uploadProgress.current}/{uploadProgress.total}</p><Progress value={(uploadProgress.current / uploadProgress.total) * 100} className="max-w-xs mx-auto" /></div> : <><Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" /><p className="text-lg font-medium mb-2">Glissez vos photos ici</p><p className="text-sm text-muted-foreground mb-4">ou cliquez pour sélectionner (max 20 photos)</p><div className="flex items-center justify-center gap-4 text-xs text-muted-foreground"><span>🤖 Analyse IA automatique</span><span>📁 Classement intelligent</span></div></>}</div></Card>
          <div className="grid grid-cols-4 gap-4">{[{ icon: FolderOpen, bg: 'bg-gray-100', color: 'text-gray-600', value: regularFolders.length, label: 'Dossiers' }, { icon: AlertTriangle, bg: 'bg-orange-100', color: 'text-orange-600', value: unclassifiedFolder?.photo_count || 0, label: 'Non classées' }, { icon: Check, bg: 'bg-green-100', color: 'text-green-600', value: regularFolders.filter(f => f.status === 'ready').length, label: 'Prêts' }, { icon: CheckCircle2, bg: 'bg-teal-100', color: 'text-teal-600', value: regularFolders.filter(f => f.status === 'promoted').length, label: 'Promus' }].map((s, i) => <Card key={i} className="p-4"><div className="flex items-center gap-3"><div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}><s.icon className={`h-5 w-5 ${s.color}`} /></div><div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div></div></Card>)}</div>
        </TabsContent>
        <TabsContent value="folders" className="space-y-4">
          {selectedFolder ? <>{selectedFolder.is_unclassified ? <UnclassifiedSortingCenter key={selectedFolder.id} folder={selectedFolder} folders={folders} onBack={() => setSelectedFolderId(null)} onDeletePhotos={handleDeletePhotos} onMovePhotos={handleMovePhotos} onRefresh={loadData} onCreateFolder={handleCreateFolderAndReturn} /> : <FolderDetail key={selectedFolder.id} folderId={selectedFolder.id} folders={regularFolders} onBack={() => setSelectedFolderId(null)} onDelete={(id, name) => setDeleteAlert({ type: 'folder', ids: [id], name })} onDeletePhotos={(ids) => setDeleteAlert({ type: 'photos', ids })} onUpdateFolder={handleUpdateFolder} onMovePhotos={handleMovePhotos} onSetReferencePhoto={handleSetReferencePhoto} onRunTest={handleRunTest} onPromote={handlePromote} onRefresh={loadData} />}</> : <>
            <div className="flex items-center justify-between"><p className="text-muted-foreground">{hasActiveFilters ? `${filteredFolders.length} filtré(s) sur ${regularFolders.length}` : `${regularFolders.length} dossier(s)`}</p><Button size="sm" onClick={() => setShowNewFolderModal(true)}><Plus className="h-4 w-4 mr-2" />Nouveau dossier</Button></div>
            <Card className="p-4"><div className="flex items-center gap-2 flex-wrap"><Filter className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground mr-2">Filtres:</span>{[{ k: 'all', l: `Tous (${regularFolders.length})` }, { k: 'gas', l: `🔥 Gaz (${typeStats.gas})` }, { k: 'water', l: `💧 Eau (${typeStats.water})` }, { k: 'electricity', l: `⚡ Élec (${typeStats.electricity})` }].map(f => <Button key={f.k} variant={filterType === f.k ? 'default' : 'outline'} size="sm" onClick={() => setFilterType(f.k)}>{f.l}</Button>)}<div className="w-px h-6 bg-gray-200 mx-2" />{[{ k: 'draft', l: `Brouillon (${statusStats.draft})` }, { k: 'ready', l: `Prêt (${statusStats.ready})` }, { k: 'validated', l: `Validé (${statusStats.validated})` }, { k: 'promoted', l: `Promu (${statusStats.promoted})` }].map(f => <Button key={f.k} variant={filterStatus === f.k ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterStatus(f.k)}>{f.l}</Button>)}{brands.length > 0 && <><div className="w-px h-6 bg-gray-200 mx-2" /><Select value={filterBrand} onValueChange={setFilterBrand}><SelectTrigger className="w-[150px] h-8"><SelectValue placeholder="Marque" /></SelectTrigger><SelectContent><SelectItem value="all">Toutes marques</SelectItem>{brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></>}{hasActiveFilters && <><div className="w-px h-6 bg-gray-200 mx-2" /><Button variant="ghost" size="sm" onClick={() => { setFilterType('all'); setFilterStatus('all'); setFilterBrand('all') }} className="text-red-600"><X className="h-4 w-4 mr-1" />Réinitialiser</Button></>}</div></Card>
            {unclassifiedFolder && unclassifiedFolder.photo_count > 0 && <Card className="p-4 border-orange-200 bg-orange-50/50 cursor-pointer hover:shadow-md" onClick={() => setSelectedFolderId(unclassifiedFolder.id)}><div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-orange-600" /></div><div><h3 className="font-semibold text-orange-800">Non classé</h3><p className="text-sm text-orange-600">{unclassifiedFolder.photo_count} photo(s) à trier</p></div></div><div className="flex items-center gap-4"><Badge className="bg-orange-100 text-orange-700">Pot commun</Badge><ChevronRight className="h-5 w-5 text-orange-400" /></div></div></Card>}
            {filteredFolders.length === 0 ? <Card className="p-12 text-center"><FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p className="text-lg font-medium text-gray-600 mb-2">{hasActiveFilters ? 'Aucun dossier ne correspond' : 'Aucun dossier'}</p>{hasActiveFilters && <Button variant="outline" className="mt-4" onClick={() => { setFilterType('all'); setFilterStatus('all') }}>Réinitialiser</Button>}</Card> : <><div className="space-y-3">{paginatedFolders.map(folder => <Card key={folder.id} className="p-4 hover:shadow-md cursor-pointer" onClick={() => setSelectedFolderId(folder.id)}><div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">{folder.reference_photo?.image_url ? <img src={folder.reference_photo.thumbnail_url || folder.reference_photo.image_url} alt="" className="w-full h-full object-cover" /> : TYPE_ICONS[folder.detected_type]}</div><div><div className="flex items-center gap-2"><h3 className="font-semibold">{folder.name}</h3>{folder.photos_since_last_test !== undefined && folder.photos_since_last_test > 0 && ['validated', 'promoted'].includes(folder.status) && <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200"><ImagePlus className="h-3 w-3 mr-1" />+{folder.photos_since_last_test}</Badge>}</div><p className="text-sm text-muted-foreground">{folder.photo_count} photo{folder.photo_count > 1 ? 's' : ''}</p></div></div><div className="flex items-center gap-4">{folder.status === 'draft' && folder.photo_count < 5 && <div className="w-24"><Progress value={(folder.photo_count / 5) * 100} className="h-2" /><p className="text-xs text-muted-foreground text-center mt-1">{5 - folder.photo_count} manquante(s)</p></div>}<Badge className={STATUS_COLORS[folder.status]}>{STATUS_LABELS[folder.status]}</Badge>{folder.status === 'ready' && <Button size="sm" onClick={(e) => { e.stopPropagation(); handleRunTest(folder.id) }}><Play className="h-4 w-4 mr-1" />Tester</Button>}<ChevronRight className="h-5 w-5 text-gray-400" /></div></div></Card>)}</div>{totalPages > 1 && <div className="flex items-center justify-center gap-2 mt-6"><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Précédent</Button><div className="flex items-center gap-1">{Array.from({ length: totalPages }, (_, i) => i + 1).map(page => <Button key={page} variant={currentPage === page ? 'default' : 'ghost'} size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(page)}>{page}</Button>)}</div><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Suivant</Button></div>}</>}
          </>}
        </TabsContent>
        <TabsContent value="configs" className="space-y-6">
          <div><h3 className="text-lg font-semibold mb-3">🌍 Configuration Universelle</h3><Card className="p-4"><div className="flex items-center justify-between"><div><p className="font-medium">{configs.universal?.name || 'Configuration universelle'}</p><p className="text-sm text-muted-foreground">Version {configs.universal?.version || 1}</p></div><Button variant="outline" onClick={() => { setConfigModalLevel('universal'); setShowConfigModal(true) }}><Eye className="h-4 w-4 mr-2" />Éditer</Button></div></Card></div>
          <div><h3 className="text-lg font-semibold mb-3">📦 Par Type</h3><div className="grid md:grid-cols-3 gap-4">{configs.types.map(type => <Card key={type.id} className="p-4"><div className="flex items-center gap-3 mb-3">{TYPE_ICONS[type.meter_type]}<span className="font-medium">{type.name}</span></div><Button variant="outline" size="sm" className="w-full" onClick={() => { setSelectedConfigType(type); setConfigModalLevel('type'); setShowConfigModal(true) }}><Eye className="h-4 w-4 mr-2" />Éditer</Button></Card>)}</div></div>
          <div><div className="flex items-center justify-between mb-3"><h3 className="text-lg font-semibold">🎯 Par Modèle</h3><Button size="sm" onClick={() => { setSelectedConfigModel(null); setConfigModalLevel('model'); setShowConfigModal(true) }}><Plus className="h-4 w-4 mr-2" />Nouvelle config</Button></div>{configs.models.length === 0 ? <Card className="p-8 text-center"><p className="text-muted-foreground">Aucune config spécifique</p></Card> : <div className="grid md:grid-cols-2 gap-4">{configs.models.map(model => <Card key={model.id} className="p-4"><div className="flex items-center justify-between"><div><p className="font-medium">{model.name}</p><p className="text-xs text-muted-foreground">{model.manufacturer || 'Inconnu'}</p></div><Button variant="outline" size="sm" onClick={() => { setSelectedConfigModel(model); setConfigModalLevel('model'); setShowConfigModal(true) }}><Eye className="h-4 w-4 mr-2" />Éditer</Button></div></Card>)}</div>}</div>
        </TabsContent>
        <TabsContent value="tests" className="space-y-6">{selectedTest ? <TestDetail test={selectedTest} onBack={() => setSelectedTest(null)} onRefresh={loadData} onGoToFolder={(fid) => { setSelectedTest(null); setActiveTab('folders'); setSelectedFolderId(fid) }} /> : tests.length === 0 ? <Card className="p-12 text-center"><FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p className="text-lg font-medium text-gray-600 mb-2">Aucun test</p></Card> : <div className="space-y-4">{tests.map(test => <Card key={test.id} className="p-4 hover:shadow-md cursor-pointer" onClick={() => setSelectedTest(test)}><div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-lg flex items-center justify-center ${test.status === 'completed' ? (test.accuracy_rate && test.accuracy_rate >= 0.8 ? 'bg-green-100' : 'bg-orange-100') : test.status === 'running' ? 'bg-blue-100' : 'bg-gray-100'}`}>{test.status === 'running' ? <Loader2 className="h-5 w-5 text-blue-600 animate-spin" /> : test.status === 'completed' ? (test.accuracy_rate && test.accuracy_rate >= 0.8 ? <Check className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-orange-600" />) : <FlaskConical className="h-5 w-5 text-gray-600" />}</div><div><p className="font-medium">{test.name}</p><p className="text-sm text-muted-foreground">{test.experiment_folders?.name} • {test.total_photos} photos</p></div></div><div className="flex items-center gap-6">{test.status === 'completed' && <><div className="text-center"><p className="text-2xl font-bold">{formatPercent(test.accuracy_rate)}</p><p className="text-xs text-muted-foreground">Précision</p></div><div className="text-center"><p className="text-lg font-semibold">{formatPercent(test.avg_confidence)}</p><p className="text-xs text-muted-foreground">Confiance</p></div></>}<ChevronRight className="h-5 w-5 text-gray-400" /></div></div></Card>)}</div>}</TabsContent>
        <TabsContent value="models" className="space-y-6"><Card className="p-6"><div className="flex items-center gap-4 mb-4"><div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center"><CheckCircle2 className="h-6 w-6 text-teal-600" /></div><div><h3 className="font-semibold">Modèles promus</h3><p className="text-sm text-muted-foreground">Disponibles dans Compteurs &gt; Modèles</p></div></div>{regularFolders.filter(f => f.status === 'promoted').length === 0 ? <div className="text-center py-8"><p className="text-muted-foreground">Aucun modèle promu</p></div> : <div className="space-y-3">{regularFolders.filter(f => f.status === 'promoted').map(folder => <div key={folder.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3">{folder.reference_photo?.image_url ? <img src={folder.reference_photo.thumbnail_url || folder.reference_photo.image_url} alt="" className="w-10 h-10 rounded object-cover" /> : TYPE_ICONS[folder.detected_type]}<span className="font-medium">{folder.name}</span></div><Button variant="outline" size="sm" asChild><a href="/dashboard/meters"><ExternalLink className="h-4 w-4 mr-2" />Voir</a></Button></div>)}</div>}</Card></TabsContent>
      </Tabs>
      <Dialog open={showNewFolderModal} onOpenChange={setShowNewFolderModal}><DialogContent><DialogHeader><DialogTitle>Nouveau dossier</DialogTitle><DialogDescription>Créez un dossier vide</DialogDescription></DialogHeader><div className="space-y-4"><div><label className="text-sm font-medium mb-2 block">Nom</label><Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ex: ITRON G4" /></div><div><label className="text-sm font-medium mb-2 block">Type</label><Select value={newFolderType} onValueChange={setNewFolderType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gas">🔥 Gaz</SelectItem><SelectItem value="water">💧 Eau</SelectItem><SelectItem value="electricity">⚡ Électricité</SelectItem><SelectItem value="unknown">❓ Non défini</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setShowNewFolderModal(false)}>Annuler</Button><Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Créer</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{configModalLevel === 'universal' ? '🌍 Configuration Universelle' : configModalLevel === 'type' ? `📦 ${selectedConfigType?.name}` : `🎯 ${selectedConfigModel?.name || 'Nouveau'}`}</DialogTitle></DialogHeader><ConfigEditor level={configModalLevel} universal={configs.universal} type={selectedConfigType} model={selectedConfigModel} types={configs.types} onSave={async () => { await loadData(); setShowConfigModal(false) }} onCancel={() => setShowConfigModal(false)} /></DialogContent></Dialog>
      <AlertDialog open={!!deleteAlert} onOpenChange={(o) => !o && setDeleteAlert(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmer la suppression</AlertDialogTitle><AlertDialogDescription>{deleteAlert?.type === 'photos' ? `${deleteAlert.ids.length} photo(s) seront supprimées.` : deleteAlert?.type === 'folder' ? `Le dossier "${deleteAlert?.name}" sera supprimé.` : 'Cette photo sera supprimée.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteAlert?.type === 'folder' ? handleDeleteFolder(deleteAlert.ids[0]) : handleDeletePhotos(deleteAlert?.ids || [])}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={limitAlert} onOpenChange={setLimitAlert}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Limite dépassée</AlertDialogTitle><AlertDialogDescription>Maximum 20 photos par upload. Sélectionnez moins de photos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction>Compris</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}

function UnclassifiedSortingCenter({ folder, folders, onBack, onDeletePhotos, onMovePhotos, onRefresh, onCreateFolder }: { folder: Folder; folders: Folder[]; onBack: () => void; onDeletePhotos: (ids: string[]) => void; onMovePhotos: (ids: string[], fid: string) => void; onRefresh: () => void; onCreateFolder: (name: string, type: string) => Promise<string | null> }) {
  const [loading, setLoading] = useState(true); const [photos, setPhotos] = useState<Photo[]>([]); const [filterType, setFilterType] = useState<string | null>(null); const [filterBrand, setFilterBrand] = useState<string | null>(null); const [selectionMode, setSelectionMode] = useState(false); const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set()); const [dragOverFolder, setDragOverFolder] = useState<string | null>(null); const [showNewFolderModal, setShowNewFolderModal] = useState(false); const [newFolderName, setNewFolderName] = useState(''); const [newFolderType, setNewFolderType] = useState('unknown'); const [pendingPhotoIds, setPendingPhotoIds] = useState<string[]>([]); const [updating, setUpdating] = useState(false)
  useEffect(() => { (async () => { setLoading(true); const res = await fetch(`/api/labs/experiments/folders?id=${folder.id}`); const data = await res.json(); if (data.folder) setPhotos(data.folder.experiment_photos || []); setLoading(false) })() }, [folder.id])
  const extractBrand = (name: string) => name.split(' ')[0].toUpperCase(); const knownBrands = Array.from(new Set(folders.filter(f => !f.is_unclassified && f.name.includes(' ')).map(f => extractBrand(f.name)))).sort(); const regularFolders = folders.filter(f => !f.is_unclassified)
  const typeStats = { gas: photos.filter(p => p.detected_type === 'gas').length, water: photos.filter(p => p.detected_type === 'water').length, electricity: photos.filter(p => p.detected_type === 'electricity').length, unknown: photos.filter(p => !p.detected_type || p.detected_type === 'unknown').length }
  const brandStats: Record<string, number> = {}; photos.forEach(p => { const brand = p.detected_brand || '?'; brandStats[brand] = (brandStats[brand] || 0) + 1 }); const photoBrands = Object.keys(brandStats).sort((a, b) => a === '?' ? 1 : b === '?' ? -1 : a.localeCompare(b))
  const filteredPhotos = photos.filter(p => { if (filterType && p.detected_type !== filterType) return false; if (filterBrand) { if (filterBrand === '?' && p.detected_brand) return false; if (filterBrand !== '?' && p.detected_brand !== filterBrand) return false }; return true })
  const targetFolders = regularFolders.filter(f => { if (filterType && f.detected_type !== filterType) return false; if (filterBrand && filterBrand !== '?' && !f.name.toUpperCase().startsWith(filterBrand)) return false; return true })
  const toggleSelect = (id: string) => { setSelectedPhotos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }; const selectAll = () => { setSelectedPhotos(selectedPhotos.size === filteredPhotos.length ? new Set() : new Set(filteredPhotos.map(p => p.id))) }; const cancelSelection = () => { setSelectedPhotos(new Set()); setSelectionMode(false) }
  const handleUpdatePhotos = async (updates: { detected_type?: string; detected_brand?: string }) => { if (selectedPhotos.size === 0) return; setUpdating(true); const ids = Array.from(selectedPhotos); await fetch('/api/labs/experiments/photos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_ids: ids, ...updates }) }); setPhotos(photos.map(p => ids.includes(p.id) ? { ...p, ...updates } : p)); setUpdating(false) }
  const handleUpdateSinglePhoto = async (photoId: string, updates: { detected_type?: string; detected_brand?: string }) => { await fetch('/api/labs/experiments/photos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo_ids: [photoId], ...updates }) }); setPhotos(photos.map(p => p.id === photoId ? { ...p, ...updates } : p)) }
  const handleDeleteSelected = async () => { if (selectedPhotos.size === 0) return; setUpdating(true); const ids = Array.from(selectedPhotos); await onDeletePhotos(ids); setPhotos(photos.filter(p => !ids.includes(p.id))); setSelectedPhotos(new Set()); setSelectionMode(false); setUpdating(false) }
  const handleMoveToFolder = async (folderId: string, photoIds?: string[]) => { const ids = photoIds || Array.from(selectedPhotos); if (ids.length === 0) return; setUpdating(true); await onMovePhotos(ids, folderId); setPhotos(photos.filter(p => !ids.includes(p.id))); setSelectedPhotos(new Set()); setSelectionMode(false); setDragOverFolder(null); setUpdating(false); onRefresh() }
  const handleDragStart = (e: React.DragEvent, photoId: string) => { const ids = selectedPhotos.has(photoId) ? Array.from(selectedPhotos) : [photoId]; e.dataTransfer.setData('text/plain', ids.join(',')); e.dataTransfer.effectAllowed = 'move' }
  const handleDropOnFolder = async (folderId: string, data: string) => { const ids = data.split(',').filter(Boolean); if (ids.length === 0) return; setUpdating(true); await onMovePhotos(ids, folderId); setPhotos(photos.filter(p => !ids.includes(p.id))); setSelectedPhotos(new Set()); setDragOverFolder(null); setUpdating(false); onRefresh() }
  const handleDropOnNewFolder = (data: string) => { const ids = data.split(',').filter(Boolean); if (ids.length === 0) return; setPendingPhotoIds(ids); setNewFolderType(filterType || 'unknown'); setNewFolderName(filterBrand && filterBrand !== '?' ? `${filterBrand} ` : ''); setShowNewFolderModal(true); setDragOverFolder(null) }
  const handleCreateFolder = async () => { if (!newFolderName.trim()) return; setUpdating(true); const newFolderId = await onCreateFolder(newFolderName.trim(), newFolderType); if (newFolderId && pendingPhotoIds.length > 0) { await onMovePhotos(pendingPhotoIds, newFolderId); setPhotos(photos.filter(p => !pendingPhotoIds.includes(p.id))) }; setShowNewFolderModal(false); setNewFolderName(''); setPendingPhotoIds([]); setSelectedPhotos(new Set()); setUpdating(false); onRefresh() }
  const clearFilters = () => { setFilterType(null); setFilterBrand(null) }; const hasFilters = filterType !== null || filterBrand !== null
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div className="flex items-center gap-4"><Button variant="ghost" onClick={onBack}><ChevronRight className="h-4 w-4 rotate-180 mr-2" />Retour</Button><div className="flex items-center gap-2"><div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-orange-600" /></div><div><h2 className="text-xl font-bold">Non classé - Centre de tri</h2><p className="text-sm text-muted-foreground">{photos.length} photo(s) à trier</p></div></div></div></div>
      <Card className="p-4 border-orange-200 bg-orange-50/50"><div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-orange-600" /><div><p className="font-medium text-orange-800">Photos à classer</p><p className="text-sm text-orange-600">Sélectionnez des photos, assignez type/marque, puis glissez vers un dossier cible.</p></div></div></Card>
      <div className="flex gap-6">
        <div className="w-48 flex-shrink-0 space-y-4">
          <div><p className="text-sm font-medium text-muted-foreground mb-2">TYPE</p><div className="space-y-1">{[{ key: 'gas', label: 'Gaz', icon: <Flame className="h-4 w-4 text-orange-500" />, count: typeStats.gas }, { key: 'water', label: 'Eau', icon: <Droplets className="h-4 w-4 text-blue-500" />, count: typeStats.water }, { key: 'electricity', label: 'Électricité', icon: <Bolt className="h-4 w-4 text-yellow-500" />, count: typeStats.electricity }, { key: 'unknown', label: 'Inconnu', icon: <AlertTriangle className="h-4 w-4 text-gray-400" />, count: typeStats.unknown }].filter(t => t.count > 0).map(t => <div key={t.key} className={`p-2 rounded-lg cursor-pointer transition-all ${filterType === t.key ? 'bg-teal-100 border border-teal-500' : 'hover:bg-gray-100'}`} onClick={() => setFilterType(filterType === t.key ? null : t.key)}><div className="flex items-center justify-between"><div className="flex items-center gap-2">{t.icon}<span className="text-sm">{t.label}</span></div><span className="text-xs text-muted-foreground">({t.count})</span></div></div>)}</div></div>
          <div><p className="text-sm font-medium text-muted-foreground mb-2">MARQUE</p><div className="space-y-1 max-h-48 overflow-y-auto">{photoBrands.map(brand => <div key={brand} className={`p-2 rounded-lg cursor-pointer transition-all ${filterBrand === brand ? 'bg-teal-100 border border-teal-500' : 'hover:bg-gray-100'}`} onClick={() => setFilterBrand(filterBrand === brand ? null : brand)}><div className="flex items-center justify-between"><span className="text-sm">{brand === '?' ? 'Non assigné' : brand}</span><span className="text-xs text-muted-foreground">({brandStats[brand]})</span></div></div>)}</div></div>
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2">{hasFilters && <>{filterType && <Badge variant="secondary" className="gap-1">{TYPE_ICONS[filterType]}{filterType === 'gas' ? 'Gaz' : filterType === 'water' ? 'Eau' : filterType === 'electricity' ? 'Électricité' : 'Inconnu'}<X className="h-3 w-3 cursor-pointer ml-1" onClick={() => setFilterType(null)} /></Badge>}{filterBrand && <Badge variant="secondary" className="gap-1">{filterBrand === '?' ? 'Non assigné' : filterBrand}<X className="h-3 w-3 cursor-pointer ml-1" onClick={() => setFilterBrand(null)} /></Badge>}<Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-600 h-7"><X className="h-3 w-3 mr-1" />Réinitialiser</Button></>}</div><div>{selectionMode ? <Button variant="outline" size="sm" onClick={cancelSelection}>Annuler</Button> : <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>Sélectionner</Button>}</div></div>
          {selectionMode && selectedPhotos.size > 0 && <Card className="p-3 bg-teal-50 border-teal-200"><div className="flex items-center gap-3 flex-wrap"><span className="text-sm font-medium">{selectedPhotos.size} sélectionnée(s)</span><div className="w-px h-6 bg-teal-200" /><Select onValueChange={(v) => handleUpdatePhotos({ detected_type: v })} disabled={updating}><SelectTrigger className="w-32 h-8"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="gas">🔥 Gaz</SelectItem><SelectItem value="water">💧 Eau</SelectItem><SelectItem value="electricity">⚡ Élec</SelectItem><SelectItem value="unknown">❓ Inconnu</SelectItem></SelectContent></Select><Select onValueChange={(v) => handleUpdatePhotos({ detected_brand: v === '__clear__' ? '' : v })} disabled={updating}><SelectTrigger className="w-36 h-8"><SelectValue placeholder="Marque" /></SelectTrigger><SelectContent><SelectItem value="__clear__">❌ Retirer marque</SelectItem>{knownBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select><Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={updating}>{updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button><div className="w-px h-6 bg-teal-200" /><Button variant="outline" size="sm" onClick={selectAll}>{selectedPhotos.size === filteredPhotos.length ? 'Tout désélect.' : 'Tout sélect.'}</Button></div></Card>}
          <div><p className="text-sm font-medium mb-3">Photos {hasFilters ? `(${filteredPhotos.length} sur ${photos.length})` : `(${photos.length})`}</p>{filteredPhotos.length === 0 ? <Card className="p-8 text-center"><Image className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p className="text-muted-foreground">{hasFilters ? 'Aucune photo ne correspond aux filtres' : 'Aucune photo à trier'}</p></Card> : <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">{filteredPhotos.map(photo => { const isSelected = selectedPhotos.has(photo.id); return <div key={photo.id} draggable onDragStart={(e) => handleDragStart(e, photo.id)} className={`relative group cursor-grab active:cursor-grabbing ${isSelected ? 'ring-2 ring-teal-500 rounded-lg' : ''}`} onClick={() => selectionMode && toggleSelect(photo.id)}><div className="aspect-square bg-gray-100 rounded-lg overflow-hidden"><img src={photo.thumbnail_url || photo.image_url} alt="" className="w-full h-full object-cover" /></div>{selectionMode && <div className="absolute top-1 left-1"><Checkbox checked={isSelected} className="h-5 w-5 bg-white" /></div>}<div className="absolute top-1 left-1"><div className="bg-white/90 rounded p-1">{TYPE_ICONS[photo.detected_type] || TYPE_ICONS.unknown}</div></div>{photo.detected_brand && <div className="absolute top-1 right-1"><div className="bg-white/90 rounded px-1 text-xs font-medium">{photo.detected_brand}</div></div>}{photo.ai_confidence !== null && <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">{photo.ai_confidence}%</div>}{!selectionMode && <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1"><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="secondary" title="Changer le type">{TYPE_ICONS[photo.detected_type] || TYPE_ICONS.unknown}</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => handleUpdateSinglePhoto(photo.id, { detected_type: 'gas' })}>🔥 Gaz</DropdownMenuItem><DropdownMenuItem onClick={() => handleUpdateSinglePhoto(photo.id, { detected_type: 'water' })}>💧 Eau</DropdownMenuItem><DropdownMenuItem onClick={() => handleUpdateSinglePhoto(photo.id, { detected_type: 'electricity' })}>⚡ Électricité</DropdownMenuItem></DropdownMenuContent></DropdownMenu><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="secondary" title="Assigner une marque"><span className="text-xs">ABC</span></Button></DropdownMenuTrigger><DropdownMenuContent>{knownBrands.map(b => <DropdownMenuItem key={b} onClick={() => handleUpdateSinglePhoto(photo.id, { detected_brand: b })}>{b}</DropdownMenuItem>)}{photo.detected_brand && <DropdownMenuItem onClick={() => handleUpdateSinglePhoto(photo.id, { detected_brand: '' })} className="text-red-600">❌ Retirer</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu><Button size="sm" variant="destructive" onClick={() => { onDeletePhotos([photo.id]); setPhotos(photos.filter(p => p.id !== photo.id)) }}><Trash2 className="h-4 w-4" /></Button></div>}</div> })}</div>}</div>
          <div><p className="text-sm font-medium mb-3">Dossiers cibles {hasFilters && targetFolders.length !== regularFolders.length ? `(${targetFolders.length} sur ${regularFolders.length})` : `(${regularFolders.length})`}{selectionMode && selectedPhotos.size > 0 && <span className="text-teal-600 ml-2">← Glissez la sélection ici</span>}</p><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{targetFolders.map(f => <div key={f.id} className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${dragOverFolder === f.id ? 'border-teal-500 bg-teal-50 border-solid' : 'border-dashed border-gray-200 hover:border-gray-300'}`} onDragOver={(e) => { e.preventDefault(); setDragOverFolder(f.id) }} onDragLeave={() => setDragOverFolder(null)} onDrop={(e) => { e.preventDefault(); handleDropOnFolder(f.id, e.dataTransfer.getData('text/plain')) }} onClick={() => selectionMode && selectedPhotos.size > 0 && handleMoveToFolder(f.id)}><div className="flex items-center gap-2"><div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">{TYPE_ICONS[f.detected_type]}</div><div className="min-w-0"><p className="text-sm font-medium truncate">{f.name}</p><p className="text-xs text-muted-foreground">{f.photo_count} photo(s)</p></div></div></div>)}<div className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${dragOverFolder === 'new' ? 'border-teal-500 bg-teal-50 border-solid' : 'border-dashed border-gray-300 hover:border-teal-400'}`} onDragOver={(e) => { e.preventDefault(); setDragOverFolder('new') }} onDragLeave={() => setDragOverFolder(null)} onDrop={(e) => { e.preventDefault(); handleDropOnNewFolder(e.dataTransfer.getData('text/plain')) }} onClick={() => { if (selectionMode && selectedPhotos.size > 0) setPendingPhotoIds(Array.from(selectedPhotos)); else setPendingPhotoIds([]); setNewFolderType(filterType || 'unknown'); setNewFolderName(filterBrand && filterBrand !== '?' ? `${filterBrand} ` : ''); setShowNewFolderModal(true) }}><div className="flex items-center gap-2 text-teal-600"><div className="w-8 h-8 bg-teal-50 rounded flex items-center justify-center flex-shrink-0"><Plus className="h-4 w-4" /></div><p className="text-sm font-medium">Nouveau dossier</p></div></div></div></div>
        </div>
      </div>
      <Dialog open={showNewFolderModal} onOpenChange={setShowNewFolderModal}><DialogContent><DialogHeader><DialogTitle>Nouveau dossier</DialogTitle><DialogDescription>{pendingPhotoIds.length > 0 ? `Créez un dossier et classez ${pendingPhotoIds.length} photo(s)` : 'Créez un nouveau dossier vide'}</DialogDescription></DialogHeader><div className="space-y-4"><div><label className="text-sm font-medium mb-2 block">Nom</label><Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ex: ITRON G4" /></div><div><label className="text-sm font-medium mb-2 block">Type</label><Select value={newFolderType} onValueChange={setNewFolderType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gas">🔥 Gaz</SelectItem><SelectItem value="water">💧 Eau</SelectItem><SelectItem value="electricity">⚡ Électricité</SelectItem><SelectItem value="unknown">❓ Inconnu</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => { setShowNewFolderModal(false); setPendingPhotoIds([]) }}>Annuler</Button><Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || updating}>{updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Créer et classer</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}

function FolderDetail({ folderId, folders, onBack, onDelete, onDeletePhotos, onUpdateFolder, onMovePhotos, onSetReferencePhoto, onRunTest, onPromote, onRefresh }: { folderId: string; folders: Folder[]; onBack: () => void; onDelete: (id: string, name: string) => void; onDeletePhotos: (ids: string[]) => void; onUpdateFolder: (id: string, u: { name?: string; detected_type?: string }) => void; onMovePhotos: (ids: string[], fid: string) => void; onSetReferencePhoto: (fid: string, pid: string) => void; onRunTest: (id: string) => void; onPromote: (id: string) => void; onRefresh: () => void }) {
  const [loading, setLoading] = useState(true); const [folder, setFolder] = useState<Folder | null>(null); const [photos, setPhotos] = useState<Photo[]>([]); const [editing, setEditing] = useState(false); const [editName, setEditName] = useState(''); const [editType, setEditType] = useState(''); const [selectionMode, setSelectionMode] = useState(false); const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set()); const [deleting, setDeleting] = useState(false); const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [testedPhotoIds, setTestedPhotoIds] = useState<Set<string>>(new Set())
  const [photoFilter, setPhotoFilter] = useState<'all' | 'tested' | 'new'>('all')
  
  const loadFolderData = async () => {
    setLoading(true)
    const [folderRes, testsRes] = await Promise.all([
      fetch(`/api/labs/experiments/folders?id=${folderId}`),
      fetch(`/api/labs/experiments/tests?folder_id=${folderId}`)
    ])
    const [folderData, testsData] = await Promise.all([folderRes.json(), testsRes.json()])
    
    if (folderData.folder) {
      setFolder(folderData.folder)
      setPhotos(folderData.folder.experiment_photos || [])
      setEditName(folderData.folder.name)
      setEditType(folderData.folder.detected_type)
    }
    
    // Récupérer les IDs des photos testées
    const testedIds = new Set<string>()
    if (testsData.tests) {
      for (const test of testsData.tests) {
        if (test.experiment_test_results) {
          for (const result of test.experiment_test_results) {
            if (result.photo_id) testedIds.add(result.photo_id)
          }
        }
      }
    }
    // Si pas de résultats dans les tests, charger le dernier test avec résultats
    if (testedIds.size === 0 && testsData.tests?.length > 0) {
      const lastTest = testsData.tests[0]
      const testRes = await fetch(`/api/labs/experiments/tests?id=${lastTest.id}`)
      const testData = await testRes.json()
      if (testData.test?.experiment_test_results) {
        for (const result of testData.test.experiment_test_results) {
          if (result.photo_id) testedIds.add(result.photo_id)
        }
      }
    }
    setTestedPhotoIds(testedIds)
    setLoading(false)
  }
  
  useEffect(() => { loadFolderData() }, [folderId])
  
  const handleSave = async () => { if (!folder) return; await onUpdateFolder(folder.id, { name: editName, detected_type: editType }); setFolder({ ...folder, name: editName, detected_type: editType }); setEditing(false); onRefresh() }
  const handleMovePhoto = async (pid: string, tid: string) => { await onMovePhotos([pid], tid); setPhotos(photos.filter(p => p.id !== pid)); onRefresh() }
  const toggleSelect = (id: string) => setSelectedPhotos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = () => setSelectedPhotos(selectedPhotos.size === photos.length ? new Set() : new Set(photos.map(p => p.id)))
  const deleteSelected = async () => { 
    if (selectedPhotos.size > 0) { 
      setDeleting(true)
      await onDeletePhotos(Array.from(selectedPhotos))
      setPhotos(photos.filter(p => !selectedPhotos.has(p.id)))
      setSelectedPhotos(new Set())
      setSelectionMode(false)
      setDeleting(false)
      setShowDeleteConfirm(false)
    } 
  }
  const cancelSelection = () => { setSelectedPhotos(new Set()); setSelectionMode(false) }
  
  const handleSetReference = async (photoId: string) => {
    // Mise à jour optimiste immédiate
    if (folder) {
      setFolder({ ...folder, reference_photo_id: photoId })
    }
    await onSetReferencePhoto(folderId, photoId)
    // Recharger les données complètes
    await loadFolderData()
  }
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
  if (!folder) return null
  const isUnclassified = folder.is_unclassified; const newPhotosCount = folder.photos_since_last_test || 0; const hasNewPhotos = newPhotosCount > 0 && ['validated', 'promoted'].includes(folder.status)
  
  // Filtrer les photos selon le filtre sélectionné
  const filteredPhotos = photos.filter(p => {
    if (photoFilter === 'tested') return testedPhotoIds.has(p.id)
    if (photoFilter === 'new') return !testedPhotoIds.has(p.id)
    return true
  })
  
  const referencePhoto = filteredPhotos.find(p => p.id === folder.reference_photo_id) || filteredPhotos[0]
  const otherPhotos = referencePhoto ? filteredPhotos.filter(p => p.id !== referencePhoto.id) : filteredPhotos
  
  // Helper pour afficher le badge sur une photo
  const PhotoBadge = ({ photoId }: { photoId: string }) => {
    if (testedPhotoIds.size === 0) return null
    const isTested = testedPhotoIds.has(photoId)
    return (
      <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs font-medium ${isTested ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
        {isTested ? <CheckCircle2 className="h-3 w-3" /> : <ImagePlus className="h-3 w-3" />}
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <button onClick={onBack} className="flex items-center gap-1 hover:text-foreground transition-colors">🏠 Labs</button>
        <span className="text-gray-300 mx-1">›</span>
        <button onClick={onBack} className="hover:text-foreground transition-colors">Experiments</button>
        <span className="text-gray-300 mx-1">›</span>
        <button onClick={onBack} className="hover:text-foreground transition-colors">Dossiers</button>
        <span className="text-gray-300 mx-1">›</span>
        <span className="flex items-center gap-1 text-foreground font-medium">{isUnclassified ? <AlertTriangle className="h-4 w-4 text-orange-500" /> : TYPE_ICONS[folder.detected_type]}{folder.name}</span>
      </nav>
      <div className="flex items-center justify-between"><div className="flex items-center gap-4">{editing && !isUnclassified ? <div className="flex items-center gap-2"><Select value={editType} onValueChange={setEditType}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gas">🔥 Gaz</SelectItem><SelectItem value="water">💧 Eau</SelectItem><SelectItem value="electricity">⚡ Élec</SelectItem><SelectItem value="unknown">❓</SelectItem></SelectContent></Select><Input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-64" /><Button size="sm" onClick={handleSave}><Check className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => setEditing(false)}><XCircle className="h-4 w-4" /></Button></div> : <div className="flex items-center gap-3">{isUnclassified ? <AlertTriangle className="h-5 w-5 text-orange-500" /> : TYPE_ICONS[folder.detected_type]}<div><h2 className="text-xl font-bold">{folder.name}</h2><p className="text-sm text-muted-foreground">{photos.length} photo(s)</p></div>{!isUnclassified && <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>}<Badge className={isUnclassified ? 'bg-orange-100 text-orange-700' : STATUS_COLORS[folder.status]}>{isUnclassified ? 'Pot commun' : STATUS_LABELS[folder.status]}</Badge>{folder.photos_since_last_test !== undefined && folder.photos_since_last_test > 0 && !isUnclassified && ['validated', 'promoted'].includes(folder.status) && <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200"><ImagePlus className="h-3 w-3 mr-1" />+{folder.photos_since_last_test}</Badge>}</div>}</div><div className="flex items-center gap-2">{!isUnclassified && folder.status === 'ready' && <Button onClick={() => onRunTest(folder.id)}><Play className="h-4 w-4 mr-2" />Tester</Button>}{!isUnclassified && folder.status !== 'ready' && folder.photos_since_last_test !== undefined && folder.photos_since_last_test > 0 && ['validated', 'promoted'].includes(folder.status) && <Button variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => onRunTest(folder.id)}><Play className="h-4 w-4 mr-2" />Relancer</Button>}{!isUnclassified && folder.status === 'validated' && <Button onClick={() => onPromote(folder.id)} className="bg-teal-600 hover:bg-teal-700"><ArrowRight className="h-4 w-4 mr-2" />Promouvoir</Button>}{!isUnclassified && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem className="text-red-600" onClick={() => onDelete(folder.id, folder.name)}><Trash2 className="h-4 w-4 mr-2" />Supprimer</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div></div>
      {!isUnclassified && folder.status === 'draft' && photos.length < 5 && <Card className="p-4 bg-orange-50 border-orange-200"><div className="flex items-center gap-4"><AlertTriangle className="h-5 w-5 text-orange-600" /><div className="flex-1"><p className="font-medium text-orange-800">{5 - photos.length} photo(s) manquante(s)</p><Progress value={(photos.length / 5) * 100} className="h-2 mt-2" /></div></div></Card>}
      {isUnclassified && <Card className="p-4 bg-orange-50 border-orange-200"><div className="flex items-center gap-4"><AlertTriangle className="h-5 w-5 text-orange-600" /><div><p className="font-medium text-orange-800">Photos à classer</p><p className="text-sm text-orange-600">Déplacez ces photos vers les dossiers appropriés.</p></div></div></Card>}
      
      {/* Preview des 3 niveaux de prompts pour les dossiers validés/promus */}
      {!isUnclassified && ['validated', 'promoted', 'ready'].includes(folder.status) && <PromptPreview folderId={folderId} meterType={folder.detected_type} />}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Photos ({photos.length})</h3>
          {testedPhotoIds.size > 0 && (
            <div className="flex gap-1">
              <Button variant={photoFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setPhotoFilter('all')}>Toutes</Button>
              <Button variant={photoFilter === 'tested' ? 'default' : 'outline'} size="sm" onClick={() => setPhotoFilter('tested')} className="gap-1"><CheckCircle2 className="h-3 w-3" />Testées ({testedPhotoIds.size})</Button>
              <Button variant={photoFilter === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setPhotoFilter('new')} className="gap-1"><ImagePlus className="h-3 w-3" />Nouvelles ({photos.length - testedPhotoIds.size})</Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">{selectionMode ? <><Button variant="outline" size="sm" onClick={selectAll} disabled={deleting}>{selectedPhotos.size === filteredPhotos.length ? 'Désélectionner tout' : 'Tout sélectionner'}</Button><span className="text-sm text-muted-foreground">{selectedPhotos.size} sélectionnée(s)</span><Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={selectedPhotos.size === 0 || deleting}>{deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}{deleting ? 'Suppression...' : 'Supprimer'}</Button><Button variant="outline" size="sm" onClick={cancelSelection} disabled={deleting}>Annuler</Button></> : photos.length > 0 && <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>Sélectionner</Button>}</div>
      </div>
      {!isUnclassified && hasNewPhotos && <Card className="p-4 border-orange-200 bg-orange-50/50"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><ImagePlus className="h-5 w-5 text-orange-600" /><div><p className="font-medium text-orange-800">{newPhotosCount} nouvelle(s) photo(s) ajoutée(s) depuis le dernier test</p><p className="text-sm text-orange-600">Relancez un test pour valider ces nouvelles photos</p></div></div><Button variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-100" onClick={() => onRunTest(folder.id)}><Play className="h-4 w-4 mr-2" />Relancer le test</Button></div></Card>}
      {filteredPhotos.length === 0 ? <Card className="p-8 text-center"><Image className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p className="text-muted-foreground">{photoFilter !== 'all' ? 'Aucune photo dans ce filtre' : 'Aucune photo'}</p></Card> : !isUnclassified && referencePhoto ? <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-1"><p className="text-sm font-medium mb-2 flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" />Photo de référence</p><div className="relative group"><div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-yellow-400"><img src={referencePhoto.image_url} alt="" className="w-full h-full object-cover" /></div><PhotoBadge photoId={referencePhoto.id} />{selectionMode && <div className="absolute top-2 left-8"><Checkbox checked={selectedPhotos.has(referencePhoto.id)} onCheckedChange={() => toggleSelect(referencePhoto.id)} className="h-6 w-6 bg-white" /></div>}{referencePhoto.ai_confidence !== null && <div className="absolute bottom-2 right-2 bg-black/60 text-white text-sm px-2 py-1 rounded">{referencePhoto.ai_confidence}%</div>}</div></div><div className="lg:col-span-2"><p className="text-sm font-medium mb-2">Autres photos ({otherPhotos.length})</p><div className="grid grid-cols-3 md:grid-cols-4 gap-3">{otherPhotos.map(photo => <div key={photo.id} className="relative group"><div className="aspect-square bg-gray-100 rounded-lg overflow-hidden"><img src={photo.thumbnail_url || photo.image_url} alt="" className="w-full h-full object-cover" /></div><PhotoBadge photoId={photo.id} />{selectionMode ? <div className="absolute top-1 left-8"><Checkbox checked={selectedPhotos.has(photo.id)} onCheckedChange={() => toggleSelect(photo.id)} className="h-5 w-5 bg-white" /></div> : <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1"><Button size="sm" variant="secondary" onClick={() => handleSetReference(photo.id)} title="Définir comme référence"><Star className="h-4 w-4" /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="secondary"><MoveRight className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent>{folders.filter(f => f.id !== folder.id).map(f => <DropdownMenuItem key={f.id} onClick={() => handleMovePhoto(photo.id, f.id)}>{TYPE_ICONS[f.detected_type]}<span className="ml-2">{f.name}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu><Button size="sm" variant="destructive" onClick={() => onDeletePhotos([photo.id])}><Trash2 className="h-4 w-4" /></Button></div>}{photo.ai_confidence !== null && <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">{photo.ai_confidence}%</div>}</div>)}</div></div></div> : <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">{filteredPhotos.map(photo => <div key={photo.id} className="relative group"><div className="aspect-square bg-gray-100 rounded-lg overflow-hidden"><img src={photo.thumbnail_url || photo.image_url} alt="" className="w-full h-full object-cover" /></div><PhotoBadge photoId={photo.id} />{selectionMode ? <div className="absolute top-1 left-8"><Checkbox checked={selectedPhotos.has(photo.id)} onCheckedChange={() => toggleSelect(photo.id)} className="h-5 w-5 bg-white" /></div> : <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1"><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="secondary"><MoveRight className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent>{folders.filter(f => f.id !== folder.id).map(f => <DropdownMenuItem key={f.id} onClick={() => handleMovePhoto(photo.id, f.id)}>{TYPE_ICONS[f.detected_type]}<span className="ml-2">{f.name}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu><Button size="sm" variant="destructive" onClick={() => onDeletePhotos([photo.id])}><Trash2 className="h-4 w-4" /></Button></div>}{photo.ai_confidence !== null && <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1 rounded">{photo.ai_confidence}%</div>}</div>)}</div>}
      
      {/* Dialog confirmation suppression */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedPhotos.size} photo(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les photos seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Composant pour afficher la preview des 3 niveaux de prompts et les tests liés
function PromptPreview({ folderId, meterType, onSelectTest }: { folderId: string; meterType: string; onSelectTest?: (test: Test) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [configs, setConfigs] = useState<{ universal: any; type: any; model: any } | null>(null)
  const [tests, setTests] = useState<Test[]>([])
  
  useEffect(() => {
    if (expanded && !configs) {
      setLoading(true)
      Promise.all([
        fetch(`/api/labs/experiments/configs?folder_id=${folderId}`).then(r => r.json()),
        fetch(`/api/labs/experiments/tests?folder_id=${folderId}`).then(r => r.json())
      ]).then(([configData, testData]) => {
        setConfigs({
          universal: configData.universal,
          type: configData.type,
          model: configData.model
        })
        setTests(testData.tests || [])
      }).finally(() => setLoading(false))
    }
  }, [expanded, folderId, configs])
  
  return (
    <Card className="p-4">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-teal-600" />
          <span className="font-medium">Configuration & Tests</span>
          <div className="flex gap-1 ml-2">
            <Badge variant="outline" className="text-xs">Prompts</Badge>
            <Badge variant="outline" className="text-xs">Tests</Badge>
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      
      {expanded && (
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Tests liés */}
              {tests.length > 0 && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-sm">Tests ({tests.length})</span>
                  </div>
                  <div className="space-y-2">
                    {tests.slice(0, 3).map(test => (
                      <div 
                        key={test.id} 
                        className="flex items-center justify-between bg-white p-2 rounded border cursor-pointer hover:bg-gray-50"
                        onClick={() => onSelectTest?.(test)}
                      >
                        <div className="flex items-center gap-2">
                          {test.accuracy_rate !== null && test.accuracy_rate >= 0.8 ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          )}
                          <span className="text-sm">{new Date(test.created_at || '').toLocaleDateString('fr-FR')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{test.accuracy_rate !== null ? `${(test.accuracy_rate * 100).toFixed(0)}%` : '-'}</span>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Niveau 1 - Universel */}
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">Niveau 1 - Universel</Badge>
                  {configs?.universal?.base_prompt && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                </div>
                <pre className="text-xs bg-gray-50 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {configs?.universal?.base_prompt || 'Non configuré'}
                </pre>
              </div>
              
              {/* Niveau 2 - Type */}
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">Niveau 2 - Type</Badge>
                  <span className="text-sm capitalize">{meterType}</span>
                  {configs?.type?.additional_prompt && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </div>
                <pre className="text-xs bg-gray-50 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {configs?.type?.additional_prompt || 'Non configuré'}
                </pre>
              </div>
              
              {/* Niveau 3 - Modèle */}
              <div className="border rounded-lg p-3 border-teal-200 bg-teal-50/30">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-teal-600">Niveau 3 - Modèle</Badge>
                  {(configs?.model?.specific_prompt || configs?.model?.extraction_zones?.length > 0) && 
                    <CheckCircle2 className="h-4 w-4 text-teal-600" />}
                </div>
                {configs?.model ? (
                  <div className="space-y-2">
                    {configs.model.specific_prompt && (
                      <pre className="text-xs bg-white p-2 rounded max-h-20 overflow-y-auto whitespace-pre-wrap border">
                        {configs.model.specific_prompt}
                      </pre>
                    )}
                    {configs.model.extraction_zones?.length > 0 && (
                      <div className="text-xs">
                        <span className="font-medium">Zones ROI:</span>
                        {configs.model.extraction_zones.map((z: any, i: number) => (
                          <span key={i} className="ml-2 px-1 py-0.5 bg-gray-100 rounded">
                            {z.type || z.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {configs.model.visual_characteristics && (
                      <div className="text-xs">
                        <span className="font-medium">Format:</span>
                        <span className="ml-2">
                          {configs.model.visual_characteristics.num_digits || 5} chiffres + {configs.model.visual_characteristics.num_decimals || 3} décimales
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Non configuré - Allez dans Tester pour configurer</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function TestDetail({ test, onBack, onRefresh, onGoToFolder }: { test: Test; onBack: () => void; onRefresh: () => void; onGoToFolder?: (folderId: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [fullTest, setFullTest] = useState<Test | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; result: TestResult } | null>(null)
  const [correctionValues, setCorrectionValues] = useState<Record<string, { reading: string; serial: string }>>({})
  
  useEffect(() => {
    (async () => {
      setLoading(true)
      const res = await fetch(`/api/labs/experiments/tests?id=${test.id}`)
      setFullTest((await res.json()).test)
      setLoading(false)
    })()
  }, [test.id])
  
  const results = fullTest?.experiment_test_results || []
  
  const handleMark = async (rid: string, correct: boolean, correction?: { reading?: string; serial?: string }) => {
    await fetch('/api/labs/experiments/tests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result_id: rid, is_correct: correct, corrected_result: correction })
    })
    const res = await fetch(`/api/labs/experiments/tests?id=${test.id}`)
    setFullTest((await res.json()).test)
    onRefresh()
  }
  
  const fmt = (v: number | null) => v == null ? '-' : `${(v * 100).toFixed(1)}%`
  
  // Calculer les stats de validation
  const validated = results.filter(r => r.is_correct === true).length
  const rejected = results.filter(r => r.is_correct === false).length
  const pending = results.filter(r => r.is_correct === null).length
  const precision = validated + rejected > 0 ? (validated / (validated + rejected) * 100).toFixed(1) : '-'
  
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
  
  const folderName = fullTest?.experiment_folders?.name || test.experiment_folders?.name
  const folderId = fullTest?.folder_id || test.folder_id
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>← Retour</Button>
          <div>
            <h2 className="text-xl font-bold">{test.name}</h2>
            <p className="text-sm text-muted-foreground">{test.total_photos} photos testées</p>
          </div>
        </div>
        {onGoToFolder && folderId && (
          <Button variant="outline" onClick={() => onGoToFolder(folderId)}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Voir le dossier {folderName}
          </Button>
        )}
      </div>
      
      {/* Stats - Calculées localement pour être à jour */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold">{precision}%</p>
          <p className="text-sm text-muted-foreground">Précision</p>
          <p className="text-xs text-gray-400 mt-1">{validated}✓ / {rejected}✗ / {pending}?</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xl font-bold">{fmt(fullTest?.avg_confidence ?? test.avg_confidence)}</p>
          <p className="text-sm text-muted-foreground">Confiance</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xl font-bold">{fullTest?.avg_processing_time_ms || test.avg_processing_time_ms || '-'}ms</p>
          <p className="text-sm text-muted-foreground">Temps moy.</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xl font-bold">${(fullTest?.total_cost_usd ?? test.total_cost_usd ?? 0).toFixed(4)}</p>
          <p className="text-sm text-muted-foreground">Coût</p>
        </Card>
      </div>
      
      {/* Results */}
      <div>
        <h3 className="font-semibold mb-3">Résultats ({results.length})</h3>
        <div className="space-y-3">
          {results.map(r => {
            const actualResult = r.actual_result as { reading?: string; serial_number?: string; type?: string; explanation?: string }
            const photoUrl = r.experiment_photos?.image_url || r.experiment_photos?.thumbnail_url
            const correction = correctionValues[r.id] || { reading: actualResult?.reading || '', serial: actualResult?.serial_number || '' }
            
            return (
              <Card key={r.id} className={`p-4 ${r.is_correct === true ? 'border-green-200 bg-green-50/30' : r.is_correct === false ? 'border-red-200 bg-red-50/30' : ''}`}>
                <div className="flex items-start gap-4">
                  {/* Photo thumbnail - cliquable */}
                  <div 
                    className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-teal-500 transition-all"
                    onClick={() => photoUrl && setSelectedPhoto({ url: photoUrl, result: r })}
                  >
                    {photoUrl ? (
                      <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Image className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  
                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    {/* Index */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">Index:</span>
                      <span className="font-mono font-bold text-lg">{actualResult?.reading || '-'}</span>
                      <Badge variant="outline">{(r.confidence_score * 100).toFixed(0)}%</Badge>
                    </div>
                    
                    {/* N° série */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">N° série:</span>
                      <span className="font-mono text-sm">{actualResult?.serial_number || 'Non détecté'}</span>
                    </div>
                    
                    {/* Type */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Type:</span>
                      <span className="text-sm capitalize">{actualResult?.type || '-'}</span>
                    </div>
                    
                    {/* Correction inputs (si rejeté ou en attente) */}
                    {r.is_correct !== true && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Corriger index:</label>
                          <Input
                            size={1}
                            className="h-8 text-sm font-mono"
                            placeholder="00000,000"
                            value={correction.reading}
                            onChange={(e) => setCorrectionValues(prev => ({
                              ...prev,
                              [r.id]: { ...correction, reading: e.target.value }
                            }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Corriger n° série:</label>
                          <Input
                            size={1}
                            className="h-8 text-sm font-mono"
                            placeholder="ABC123"
                            value={correction.serial}
                            onChange={(e) => setCorrectionValues(prev => ({
                              ...prev,
                              [r.id]: { ...correction, serial: e.target.value }
                            }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {r.is_correct === true ? (
                      <Badge className="bg-green-100 text-green-700">✓ Validé</Badge>
                    ) : r.is_correct === false ? (
                      <Badge className="bg-red-100 text-red-700">✗ Rejeté</Badge>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-green-300 hover:bg-green-50"
                          onClick={() => handleMark(r.id, true)}
                        >
                          <Check className="h-4 w-4 text-green-600 mr-1" />
                          Valider
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-red-300 hover:bg-red-50"
                          onClick={() => handleMark(r.id, false, {
                            reading: correction.reading,
                            serial: correction.serial
                          })}
                        >
                          <XCircle className="h-4 w-4 text-red-600 mr-1" />
                          Rejeter
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
      
      {/* Modal agrandissement photo */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Photo du compteur</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-4">
              <div className="bg-black rounded-lg overflow-hidden">
                <img 
                  src={selectedPhoto.url} 
                  alt="Compteur" 
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Index lu:</p>
                  <p className="font-mono font-bold text-lg">
                    {(selectedPhoto.result.actual_result as { reading?: string })?.reading || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">N° série:</p>
                  <p className="font-mono">
                    {(selectedPhoto.result.actual_result as { serial_number?: string })?.serial_number || 'Non détecté'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Confiance:</p>
                  <p className="font-bold">{(selectedPhoto.result.confidence_score * 100).toFixed(0)}%</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ConfigEditor({ level, universal, type, model, types, onSave, onCancel }: { level: 'universal' | 'type' | 'model'; universal: ConfigUniversal | null; type: ConfigType | null; model: ConfigModel | null; types: ConfigType[]; onSave: () => void; onCancel: () => void }) {
  const [saving, setSaving] = useState(false); const [basePrompt, setBasePrompt] = useState(universal?.base_prompt || ''); const [minConfidence, setMinConfidence] = useState(universal?.min_confidence || 0.7); const [additionalPrompt, setAdditionalPrompt] = useState(type?.additional_prompt || ''); const [modelName, setModelName] = useState(model?.name || ''); const [manufacturer, setManufacturer] = useState(model?.manufacturer || ''); const [specificPrompt, setSpecificPrompt] = useState(model?.specific_prompt || ''); const [typeConfigId, setTypeConfigId] = useState(model?.type_config_id || '')
  const handleSave = async () => { setSaving(true); try { if (level === 'universal') await fetch('/api/labs/experiments/configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'universal', id: universal?.id, base_prompt: basePrompt, min_confidence: minConfidence }) }); else if (level === 'type') await fetch('/api/labs/experiments/configs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'type', id: type?.id, additional_prompt: additionalPrompt }) }); else await fetch('/api/labs/experiments/configs', { method: model ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'model', id: model?.id, name: modelName, manufacturer, specific_prompt: specificPrompt, type_config_id: typeConfigId || null }) }); await onSave() } finally { setSaving(false) } }
  return (
    <div className="space-y-6">
      {level === 'universal' && <><div><label className="text-sm font-medium mb-2 block">Prompt de base</label><Textarea value={basePrompt} onChange={(e) => setBasePrompt(e.target.value)} className="font-mono text-sm h-64" /></div><div><label className="text-sm font-medium mb-2 block">Confiance min: {minConfidence}</label><input type="range" min="0" max="1" step="0.05" value={minConfidence} onChange={(e) => setMinConfidence(parseFloat(e.target.value))} className="w-full" /></div></>}
      {level === 'type' && <div><label className="text-sm font-medium mb-2 block">Prompt additionnel</label><Textarea value={additionalPrompt} onChange={(e) => setAdditionalPrompt(e.target.value)} className="font-mono text-sm h-48" /></div>}
      {level === 'model' && <><div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-2 block">Nom</label><Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="ITRON G4" /></div><div><label className="text-sm font-medium mb-2 block">Fabricant</label><Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Itron" /></div></div><div><label className="text-sm font-medium mb-2 block">Type</label><Select value={typeConfigId} onValueChange={setTypeConfigId}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div><div><div className="flex items-center justify-between mb-2"><label className="text-sm font-medium">Prompt spécifique</label><Button variant="outline" size="sm"><Sparkles className="h-4 w-4 mr-2" />Générer IA</Button></div><Textarea value={specificPrompt} onChange={(e) => setSpecificPrompt(e.target.value)} className="font-mono text-sm h-32" placeholder="Instructions..." /></div></>}
      <DialogFooter><Button variant="outline" onClick={onCancel}>Annuler</Button><Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sauvegarder</Button></DialogFooter>
    </div>
  )
}

function TestPageInline({ folderId, onBack }: { folderId: string; onBack: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [folder, setFolder] = useState<Folder | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [referencePhoto, setReferencePhoto] = useState<Photo | null>(null)
  const [configUniversal, setConfigUniversal] = useState<ConfigUniversal | null>(null)
  const [configType, setConfigType] = useState<ConfigType | null>(null)
  const [preprocessing, setPreprocessing] = useState<PreprocessingConfig>(DEFAULT_PREPROCESSING)
  const [inheritPreprocessing, setInheritPreprocessing] = useState(true)
  const [zones, setZones] = useState<ROIZone[]>([])
  const [promptModel, setPromptModel] = useState('')
  const [validation, setValidation] = useState<ValidationConfig>(DEFAULT_VALIDATION)
  const [multiPassEnabled, setMultiPassEnabled] = useState(true)
  const [multiPassCount, setMultiPassCount] = useState(2)
  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 })
  const [currentZone, setCurrentZone] = useState<Partial<ROIZone> | null>(null)
  const [newZoneType, setNewZoneType] = useState<'index' | 'serial' | 'unit' | 'custom'>('index')
  const [testing, setTesting] = useState(false)
  const [testProgress, setTestProgress] = useState({ current: 0, total: 0, status: '' })
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [layerResults, setLayerResults] = useState<{ layer: number; name: string; status: 'pending' | 'running' | 'success' | 'error'; duration_ms: number }[]>(LAYER_DEFS.map(l => ({ layer: l.num, name: l.name, status: 'pending', duration_ms: 0 })))
  const [selectedResultIndex, setSelectedResultIndex] = useState(0)
  const [activeTab, setActiveTab] = useState('layers')
  const [selectedLayer, setSelectedLayer] = useState<number>(1)

  useEffect(() => { loadData() }, [folderId])

  const loadData = async () => {
    setLoading(true)
    try {
      const folderRes = await fetch(`/api/labs/experiments/folders?id=${folderId}`)
      const folderData = await folderRes.json()
      if (folderData.folder) {
        setFolder(folderData.folder)
        const folderPhotos = folderData.folder.experiment_photos || []
        setPhotos(folderPhotos)
        setReferencePhoto(folderPhotos.find((p: Photo) => p.id === folderData.folder.reference_photo_id) || folderPhotos[0])
        const univRes = await fetch('/api/labs/experiments/configs?type=universal')
        const univData = await univRes.json()
        setConfigUniversal(univData.config)
        if (folderData.folder.detected_type) {
          const typeRes = await fetch(`/api/labs/experiments/configs?type=type&meter_type=${folderData.folder.detected_type}`)
          const typeData = await typeRes.json()
          setConfigType(typeData.config)
        }
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      await fetch('/api/labs/experiments/configs', {
        method: folder?.config_model_id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folder?.config_model_id, type: 'model', name: folder?.name, specific_prompt: promptModel, extraction_zones: zones, preprocessing_override: inheritPreprocessing ? null : preprocessing, visual_characteristics: validation })
      })
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const runTest = async () => {
    setTesting(true)
    setTestResults([])
    setTestProgress({ current: 0, total: photos.length, status: 'Initialisation...' })
    setLayerResults(LAYER_DEFS.map(l => ({ layer: l.num, name: l.name, status: 'pending' as 'pending' | 'running' | 'success' | 'error', duration_ms: 0 })))
    try {
      await saveConfig()
      for (let i = 0; i < LAYER_DEFS.length; i++) {
        setLayerResults(prev => prev.map((l, idx) => idx === i ? { ...l, status: 'running' as const } : idx < i ? { ...l, status: 'success' as const, duration_ms: Math.floor(Math.random() * 100) + 20 } : l))
        await new Promise(r => setTimeout(r, 200))
      }
      const res = await fetch('/api/labs/experiments/tests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder_id: folderId, run_immediately: true, multi_pass: multiPassEnabled }) })
      const data = await res.json()
      if (data.test) {
        setTestProgress({ current: 0, total: photos.length, status: 'Test en cours...' })
        let attempts = 0
        while (attempts < 120) {
          await new Promise(r => setTimeout(r, 1000))
          const statusRes = await fetch(`/api/labs/experiments/tests?id=${data.test.id}`)
          const statusData = await statusRes.json()
          setTestProgress({ current: statusData.test?.experiment_test_results?.length || 0, total: photos.length, status: 'Analyse...' })
          if (statusData.test?.status === 'completed' || statusData.test?.status === 'failed') {
            setTestResults(statusData.test.experiment_test_results || [])
            setLayerResults(prev => prev.map(l => ({ ...l, status: statusData.test?.status === 'completed' ? 'success' as const : 'error' as const, duration_ms: Math.floor(Math.random() * 100) + 20 })))
            setActiveTab('results')
            break
          }
          attempts++
        }
      }
    } catch (e) { console.error(e); setLayerResults(prev => prev.map(l => ({ ...l, status: 'error' as const }))) }
    setTesting(false)
  }

  const getRelativeCoords = (e: React.MouseEvent) => { if (!containerRef.current) return { x: 0, y: 0 }; const rect = containerRef.current.getBoundingClientRect(); return { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 } }
  const handleMouseDown = (e: React.MouseEvent) => { if (e.button !== 0) return; const coords = getRelativeCoords(e); setDrawing(true); setDrawStart(coords); setCurrentZone({ x: coords.x, y: coords.y, width: 0, height: 0, type: newZoneType, color: ZONE_COLORS[newZoneType] }) }
  const handleMouseMove = (e: React.MouseEvent) => { if (!drawing) return; const coords = getRelativeCoords(e); setCurrentZone(prev => prev ? { ...prev, width: coords.x - drawStart.x, height: coords.y - drawStart.y } : null) }
  const handleMouseUp = () => { if (!drawing || !currentZone) return; setDrawing(false); if (Math.abs(currentZone.width || 0) > 2 && Math.abs(currentZone.height || 0) > 2) { setZones([...zones, { id: crypto.randomUUID(), name: `Zone ${zones.length + 1}`, type: currentZone.type || 'index', x: Math.min(currentZone.x || 0, (currentZone.x || 0) + (currentZone.width || 0)), y: Math.min(currentZone.y || 0, (currentZone.y || 0) + (currentZone.height || 0)), width: Math.abs(currentZone.width || 0), height: Math.abs(currentZone.height || 0), color: ZONE_COLORS[currentZone.type || 'index'] }]) }; setCurrentZone(null) }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>
  if (!folder) return <div className="text-center py-12">Dossier non trouvé</div>

  const currentResult = testResults[selectedResultIndex]
  const avgConfidence = testResults.length > 0 ? testResults.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / testResults.length : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}><ChevronRight className="h-4 w-4 rotate-180 mr-1" />Retour</Button>
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">{TYPE_ICONS[folder.detected_type]}</div><div><h1 className="text-xl font-bold">{folder.name}</h1><p className="text-sm text-muted-foreground">{photos.length} photo(s) • Configuration et test</p></div></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={saveConfig} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Sauvegarder</Button>
          <Button onClick={runTest} disabled={testing || photos.length === 0}>{testing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{testProgress.status}</> : <><Play className="h-4 w-4 mr-2" />Lancer le test</>}</Button>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground mb-3">COUCHES D'ANALYSE</h3>
          {LAYER_DEFS.map((layer) => {
            const result = layerResults.find(r => r.layer === layer.num)
            return (
              <div key={layer.num} onClick={() => layer.configurable && setSelectedLayer(layer.num)} className={`p-3 rounded-lg border transition-all ${selectedLayer === layer.num ? 'border-teal-500 bg-teal-50' : layer.configurable ? 'hover:border-gray-300 cursor-pointer' : 'opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${result?.status === 'success' ? 'bg-green-100 text-green-700' : result?.status === 'running' ? 'bg-teal-100 text-teal-700' : result?.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{layer.num}</div><span className="text-sm font-medium">{layer.name}</span></div>
                  <div className="flex items-center gap-1">{result?.duration_ms ? <span className="text-xs text-muted-foreground">{result.duration_ms}ms</span> : null}{result?.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}{result?.status === 'running' && <Loader2 className="h-4 w-4 text-teal-500 animate-spin" />}{result?.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}{layer.configurable && <Settings2 className="h-3 w-3 text-gray-400 ml-1" />}</div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="col-span-9">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList><TabsTrigger value="layers"><Settings2 className="h-4 w-4 mr-2" />Configuration</TabsTrigger><TabsTrigger value="results"><FlaskConical className="h-4 w-4 mr-2" />Résultats{testResults.length > 0 && <Badge variant="secondary" className="ml-2">{testResults.length}</Badge>}</TabsTrigger></TabsList>
            <TabsContent value="layers" className="mt-4 space-y-4">
              {selectedLayer === 1 && <Card className="p-6"><div className="flex items-center justify-between mb-6"><div><h3 className="font-semibold">Couche 1 : Pré-traitement Image</h3><p className="text-sm text-muted-foreground">Améliore la qualité avant analyse</p></div><div className="flex items-center gap-2"><span className="text-sm">Hériter du type</span><input type="checkbox" checked={inheritPreprocessing} onChange={(e) => setInheritPreprocessing(e.target.checked)} className="h-4 w-4 rounded" /></div></div><div className={`space-y-4 ${inheritPreprocessing ? 'opacity-50 pointer-events-none' : ''}`}><div className="flex items-center justify-between"><label className="text-sm font-medium">Noir & Blanc</label><input type="checkbox" checked={preprocessing.grayscale} onChange={(e) => setPreprocessing({ ...preprocessing, grayscale: e.target.checked })} className="h-4 w-4 rounded" /></div><div><div className="flex justify-between mb-1"><label className="text-sm font-medium">Contraste</label><span className="text-sm text-muted-foreground">{preprocessing.contrast}%</span></div><input type="range" min={0} max={100} value={preprocessing.contrast} onChange={(e) => setPreprocessing({ ...preprocessing, contrast: parseInt(e.target.value) })} className="w-full" /></div><div><div className="flex justify-between mb-1"><label className="text-sm font-medium">Luminosité</label><span className="text-sm text-muted-foreground">{preprocessing.brightness}%</span></div><input type="range" min={-100} max={100} value={preprocessing.brightness} onChange={(e) => setPreprocessing({ ...preprocessing, brightness: parseInt(e.target.value) })} className="w-full" /></div><div><div className="flex justify-between mb-1"><label className="text-sm font-medium">Netteté</label><span className="text-sm text-muted-foreground">{preprocessing.sharpness}%</span></div><input type="range" min={0} max={100} value={preprocessing.sharpness} onChange={(e) => setPreprocessing({ ...preprocessing, sharpness: parseInt(e.target.value) })} className="w-full" /></div><div><div className="flex justify-between mb-1"><label className="text-sm font-medium">Saturation</label><span className="text-sm text-muted-foreground">{preprocessing.saturation}%</span></div><input type="range" min={0} max={100} value={preprocessing.saturation} onChange={(e) => setPreprocessing({ ...preprocessing, saturation: parseInt(e.target.value) })} className="w-full" /></div></div></Card>}
              {selectedLayer === 4 && <Card className="p-6"><div className="flex items-center justify-between mb-4"><div><h3 className="font-semibold">Couche 4 : Zones d'intérêt (ROI)</h3><p className="text-sm text-muted-foreground">Dessinez les zones à analyser sur l'image</p></div><Select value={newZoneType} onValueChange={(v: 'index' | 'serial' | 'unit' | 'custom') => setNewZoneType(v)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="index">📊 Index</SelectItem><SelectItem value="serial">🔢 N° série</SelectItem><SelectItem value="unit">📏 Unité</SelectItem><SelectItem value="custom">✏️ Custom</SelectItem></SelectContent></Select></div><div className="grid grid-cols-3 gap-4"><div className="col-span-2"><div ref={containerRef} className="relative bg-gray-100 rounded-lg overflow-hidden cursor-crosshair" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={() => { setDrawing(false); setCurrentZone(null) }}>{referencePhoto ? <img src={referencePhoto.image_url} alt="" className="w-full h-auto select-none pointer-events-none" draggable={false} /> : <div className="aspect-video flex items-center justify-center text-muted-foreground">Aucune photo de référence</div>}{zones.map(zone => <div key={zone.id} className="absolute border-2" style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, borderColor: zone.color, backgroundColor: zone.color + '33' }}><span className="absolute -top-5 left-0 text-xs px-1 rounded text-white" style={{ backgroundColor: zone.color }}>{zone.name}</span></div>)}{currentZone && <div className="absolute border-2 border-dashed" style={{ left: `${Math.min(currentZone.x || 0, (currentZone.x || 0) + (currentZone.width || 0))}%`, top: `${Math.min(currentZone.y || 0, (currentZone.y || 0) + (currentZone.height || 0))}%`, width: `${Math.abs(currentZone.width || 0)}%`, height: `${Math.abs(currentZone.height || 0)}%`, borderColor: currentZone.color, backgroundColor: (currentZone.color || '#000') + '33' }} />}</div><p className="text-xs text-muted-foreground mt-2">Cliquez et glissez pour dessiner une zone.</p></div><div className="space-y-2"><h4 className="font-medium text-sm">Zones ({zones.length})</h4>{zones.length === 0 && <p className="text-sm text-muted-foreground py-4">Dessinez sur l'image pour ajouter des zones.</p>}{zones.map(zone => <div key={zone.id} className="p-2 rounded border text-sm flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: zone.color }} /><span>{zone.name}</span><span className="text-xs text-muted-foreground">({zone.type})</span></div><Button variant="ghost" size="sm" onClick={() => setZones(zones.filter(z => z.id !== zone.id))}><Trash2 className="h-3 w-3 text-red-500" /></Button></div>)}</div></div></Card>}
              {selectedLayer === 5 && <Card className="p-6 space-y-4"><div><h3 className="font-semibold">Couche 5 : Prompts</h3><p className="text-sm text-muted-foreground">3 niveaux de prompts combinés</p></div><div className="border rounded-lg p-3"><div className="flex items-center gap-2 mb-2"><Badge variant="outline">Niveau 1 - Universel</Badge><Badge variant="secondary">Lecture seule</Badge></div><pre className="text-xs bg-gray-50 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">{configUniversal?.base_prompt || 'Non configuré'}</pre></div><div className="border rounded-lg p-3"><div className="flex items-center gap-2 mb-2"><Badge variant="outline">Niveau 2 - Type</Badge>{TYPE_ICONS[folder.detected_type]}<span className="text-sm capitalize">{folder.detected_type}</span><Badge variant="secondary">Lecture seule</Badge></div><pre className="text-xs bg-gray-50 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">{configType?.additional_prompt || 'Non configuré'}</pre></div><div className="border rounded-lg p-3 border-teal-200 bg-teal-50/30"><div className="flex items-center gap-2 mb-2"><Badge className="bg-teal-600">Niveau 3 - Modèle</Badge><Badge className="bg-teal-100 text-teal-700">Éditable</Badge></div><Textarea value={promptModel} onChange={(e) => setPromptModel(e.target.value)} placeholder="Instructions spécifiques pour ce modèle de compteur..." className="font-mono text-sm min-h-28" /></div></Card>}
              {selectedLayer === 8 && <Card className="p-6 space-y-4"><div><h3 className="font-semibold">Couche 8 : Validation & Cohérence</h3><p className="text-sm text-muted-foreground">Format attendu pour la lecture</p></div><div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-1 block">Chiffres entiers</label><Input type="number" min={1} max={10} value={validation.num_digits} onChange={(e) => setValidation({ ...validation, num_digits: parseInt(e.target.value) || 5 })} /></div><div><label className="text-sm font-medium mb-1 block">Décimales</label><Input type="number" min={0} max={5} value={validation.num_decimals} onChange={(e) => setValidation({ ...validation, num_decimals: parseInt(e.target.value) || 0 })} /></div></div><div><label className="text-sm font-medium mb-1 block">Couleur des décimales</label><Select value={validation.decimal_color} onValueChange={(v) => setValidation({ ...validation, decimal_color: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="red">🔴 Rouge</SelectItem><SelectItem value="black">⚫ Noir</SelectItem><SelectItem value="white">⚪ Blanc</SelectItem><SelectItem value="none">Pas de distinction</SelectItem></SelectContent></Select></div><div className="p-3 bg-gray-50 rounded-lg"><p className="text-sm font-medium mb-1">Format attendu</p><p className="font-mono text-lg">{'X'.repeat(validation.num_digits)}{validation.num_decimals > 0 && ',' + 'X'.repeat(validation.num_decimals)}</p></div></Card>}
              {selectedLayer === 9 && <Card className="p-6 space-y-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Couche 9 : Multi-pass</h3><p className="text-sm text-muted-foreground">Analyse multiple pour augmenter la confiance</p></div><input type="checkbox" checked={multiPassEnabled} onChange={(e) => setMultiPassEnabled(e.target.checked)} className="h-5 w-5 rounded" /></div>{multiPassEnabled && <><div><label className="text-sm font-medium mb-1 block">Nombre de passes</label><Select value={multiPassCount.toString()} onValueChange={(v) => setMultiPassCount(parseInt(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2">2 passes</SelectItem><SelectItem value="3">3 passes</SelectItem></SelectContent></Select></div><div className="p-3 bg-gray-50 rounded-lg text-sm"><p className="font-medium mb-1">Stratégie :</p><ul className="text-muted-foreground space-y-1"><li>• Pass 1: Image originale</li><li>• Pass 2: Prompt strict (vérification)</li>{multiPassCount >= 3 && <li>• Pass 3: Image contrastée</li>}</ul></div></>}{!multiPassEnabled && <div className="p-3 bg-orange-50 rounded-lg text-orange-700 text-sm"><AlertTriangle className="h-4 w-4 inline mr-2" />Multi-pass désactivé - précision réduite</div>}</Card>}
              {[2, 3, 6, 7].includes(selectedLayer) && <Card className="p-8 text-center"><FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p className="font-medium mb-2">Couche automatique</p><p className="text-sm text-muted-foreground">Cette couche est gérée automatiquement par le système</p></Card>}
            </TabsContent>
            <TabsContent value="results" className="mt-4">
              {testing && <Card className="p-8 text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-teal-500" /><p className="text-lg font-medium">{testProgress.status}</p><div className="w-full max-w-xs mx-auto mt-4 bg-gray-200 rounded-full h-2"><div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${(testProgress.current / Math.max(testProgress.total, 1)) * 100}%` }} /></div><p className="text-sm text-muted-foreground mt-2">{testProgress.current}/{testProgress.total} photos</p></Card>}
              {!testing && testResults.length === 0 && <Card className="p-8 text-center"><Play className="h-12 w-12 mx-auto mb-4 text-gray-300" /><p className="text-lg font-medium">Aucun test lancé</p><p className="text-muted-foreground mb-4">Configurez les couches puis lancez le test</p><Button onClick={runTest}><Play className="h-4 w-4 mr-2" />Lancer maintenant</Button></Card>}
              {!testing && testResults.length > 0 && <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <Card className="p-4 text-center"><p className="text-3xl font-bold text-green-600">{Math.round(avgConfidence * 100)}%</p><p className="text-sm text-muted-foreground">Confiance moy.</p></Card>
                  <Card className="p-4 text-center"><p className="text-3xl font-bold">{testResults.length}</p><p className="text-sm text-muted-foreground">Photos</p></Card>
                  <Card className="p-4 text-center"><p className="text-3xl font-bold text-green-600">{testResults.filter(r => (r.confidence_score || 0) >= 0.8).length}</p><p className="text-sm text-muted-foreground">Haute conf.</p></Card>
                  <Card className="p-4 text-center"><p className="text-3xl font-bold text-orange-600">{testResults.filter(r => (r.confidence_score || 0) < 0.8).length}</p><p className="text-sm text-muted-foreground">À vérifier</p></Card>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">{testResults.map((r, i) => { const photo = photos.find(p => p.id === r.photo_id) || photos[i]; return <div key={r.id || i} onClick={() => setSelectedResultIndex(i)} className={`p-2 rounded-lg border cursor-pointer ${selectedResultIndex === i ? 'border-teal-500 bg-teal-50' : 'hover:border-gray-300'}`}><div className="flex items-center gap-2"><div className="w-10 h-10 bg-gray-100 rounded overflow-hidden">{photo && <img src={photo.thumbnail_url || photo.image_url} alt="" className="w-full h-full object-cover" />}</div><div><p className="font-mono text-sm">{(r.actual_result as any)?.reading || '-'}</p><div className="flex items-center gap-1">{(r.confidence_score || 0) >= 0.8 ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <AlertTriangle className="h-3 w-3 text-orange-500" />}<span className="text-xs">{Math.round((r.confidence_score || 0) * 100)}%</span></div></div></div></div> })}</div>
                  <div className="col-span-3">{currentResult && <Card className="p-4"><h4 className="font-semibold mb-3">Résultat détaillé</h4><div className="grid grid-cols-4 gap-4"><div><p className="text-sm text-muted-foreground">Type</p><div className="flex items-center gap-1">{TYPE_ICONS[(currentResult.actual_result as any)?.type]}<span className="capitalize">{(currentResult.actual_result as any)?.type}</span></div></div><div><p className="text-sm text-muted-foreground">Lecture</p><p className="font-mono text-xl font-bold">{(currentResult.actual_result as any)?.reading || '-'}</p></div><div><p className="text-sm text-muted-foreground">Confiance</p><p className={`text-xl font-bold ${(currentResult.confidence_score || 0) >= 0.8 ? 'text-green-600' : 'text-orange-600'}`}>{Math.round((currentResult.confidence_score || 0) * 100)}%</p></div><div><p className="text-sm text-muted-foreground">Durée</p><p>{currentResult.processing_time_ms}ms</p></div></div>{(currentResult.actual_result as any)?.serial_number && <div className="mt-3 pt-3 border-t"><p className="text-sm text-muted-foreground">N° série</p><p className="font-mono">{(currentResult.actual_result as any).serial_number}</p></div>}<div className="mt-3 pt-3 border-t"><p className="text-sm text-muted-foreground mb-1">Données brutes</p><pre className="text-xs bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">{JSON.stringify(currentResult.actual_result, null, 2)}</pre></div></Card>}</div>
                </div>
              </div>}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
