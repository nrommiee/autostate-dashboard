'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { 
  ArrowLeft, Save, Loader2, Check, Trash2, CheckCircle, XCircle, AlertCircle,
  Target, RotateCcw, Eye, EyeOff, Upload, Edit3, X, Move, ZoomIn, Camera, Plus
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface MeterModel {
  id: string
  name: string
  manufacturer: string | null
  meter_type: string
  unit: string
  reference_photos: string[]
  is_active: boolean
  zones?: Zone[]
}

interface ReadingRule {
  id: string
  model_id: string
  reading_integer_digits: number | null
  reading_decimal_digits: number | null
  decimal_indicator: string | null
  prompt_rules: string | null
}

interface ModelVersion {
  id: string
  prompt_text: string
  version: number
  is_active: boolean
  created_at: string
}

interface TestRecord {
  id: string
  status: 'pending' | 'validated' | 'corrected' | 'rejected'
  extracted_data: Record<string, { value: string; confidence: number }> | null
  corrected_data: Record<string, string> | null
  confidence: number
  created_at: string
}

interface Zone {
  id: string
  fieldType: string
  label: string
  position: { x: number; y: number; w: number; h: number } | null
}

const METER_TYPES = [
  { value: 'gas', label: 'Gaz', icon: '🔥', unit: 'm³' },
  { value: 'electricity', label: 'Électricité', icon: '⚡', unit: 'kWh' },
  { value: 'water_general', label: 'Eau générale', icon: '💧', unit: 'm³' },
  { value: 'water_passage', label: 'Eau passage', icon: '🚿', unit: 'm³' },
  { value: 'oil_tank', label: 'Mazout', icon: '🛢️', unit: 'L' },
  { value: 'calorimeter', label: 'Calorimètre', icon: '🌡️', unit: 'kWh' },
  { value: 'other', label: 'Autre', icon: '📊', unit: '' },
]

const DECIMAL_INDICATORS = [
  { value: 'red_digits', label: 'Chiffres rouges' },
  { value: 'red_background', label: 'Fond rouge' },
  { value: 'comma', label: 'Virgule visible' },
  { value: 'none', label: 'Aucun indicateur' },
  { value: 'other', label: 'Autre' },
]

const ZONE_TYPES = [
  { value: 'meterBounds', label: 'Zone compteur', color: '#6B7280', isParent: true },
  { value: 'serialNumber', label: 'N° série', color: '#3B82F6', isParent: false },
  { value: 'readingSingle', label: 'Index', color: '#10B981', isParent: false },
  { value: 'ean', label: 'Code EAN', color: '#8B5CF6', isParent: false },
]

export default function MeterModelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const modelId = params.id as string
  const photoContainerRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [model, setModel] = useState<MeterModel | null>(null)
  const [rules, setRules] = useState<ReadingRule | null>(null)
  const [versions, setVersions] = useState<ModelVersion[]>([])
  const [tests, setTests] = useState<TestRecord[]>([])
  
  // Form
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [meterType, setMeterType] = useState('gas')
  const [customMeterType, setCustomMeterType] = useState('')
  const [unit, setUnit] = useState('m³')
  const [isActive, setIsActive] = useState(true)
  const [integerDigits, setIntegerDigits] = useState(5)
  const [decimalDigits, setDecimalDigits] = useState(3)
  const [decimalIndicator, setDecimalIndicator] = useState('red_digits')
  const [customDecimalIndicator, setCustomDecimalIndicator] = useState('')
  
  // Zones calibration
  const [zones, setZones] = useState<Zone[]>([])
  const [showZonesOnPhoto, setShowZonesOnPhoto] = useState(true)
  const [repositioningZoneId, setRepositioningZoneId] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [calibrationPhotoFile, setCalibrationPhotoFile] = useState<File | null>(null)
  const [calibrationPhotoUrl, setCalibrationPhotoUrl] = useState<string | null>(null)
  
  // Lightbox
  const [showImageLightbox, setShowImageLightbox] = useState(false)
  
  // UI
  const [showVersionDetail, setShowVersionDetail] = useState<ModelVersion | null>(null)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [pendingActiveState, setPendingActiveState] = useState<boolean | null>(null)
  
  // Tests
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [currentTestResult, setCurrentTestResult] = useState<any>(null)
  const [correctionSerial, setCorrectionSerial] = useState('')
  const [correctionReading, setCorrectionReading] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')

  // Stats
  const testStats = {
    total: tests.length,
    validated: tests.filter(t => t.status === 'validated' || t.status === 'corrected').length,
    rejected: tests.filter(t => t.status === 'rejected').length,
    successRate: tests.length > 0 ? (tests.filter(t => t.status === 'validated' || t.status === 'corrected').length / tests.length) * 100 : null
  }

  useEffect(() => { loadModel() }, [modelId])

  async function loadModel() {
    setLoading(true)
    try {
      const { data: modelData } = await supabase.from('meter_models').select('*').eq('id', modelId).single()
      if (modelData) {
        setModel(modelData)
        setName(modelData.name)
        setManufacturer(modelData.manufacturer || '')
        const knownType = METER_TYPES.find(t => t.value === modelData.meter_type)
        if (knownType) setMeterType(modelData.meter_type)
        else { setMeterType('other'); setCustomMeterType(modelData.meter_type || '') }
        setUnit(modelData.unit || 'm³')
        setIsActive(modelData.is_active)
        
        // Load zones from ai_analysis_data or zones field
        if (modelData.zones) {
          setZones(modelData.zones)
        } else if (modelData.ai_analysis_data?.zones) {
          setZones(modelData.ai_analysis_data.zones)
        }
      }

      const { data: rulesData } = await supabase.from('meter_reading_rules').select('*').eq('model_id', modelId).single()
      if (rulesData) {
        setRules(rulesData)
        setIntegerDigits(rulesData.reading_integer_digits || 5)
        setDecimalDigits(rulesData.reading_decimal_digits || 3)
        const knownInd = DECIMAL_INDICATORS.find(d => d.value === rulesData.decimal_indicator)
        if (knownInd) setDecimalIndicator(rulesData.decimal_indicator || 'red_digits')
        else { setDecimalIndicator('other'); setCustomDecimalIndicator(rulesData.decimal_indicator || '') }
      }

      const { data: versionsData } = await supabase.from('meter_model_prompts').select('*').eq('model_id', modelId).order('version', { ascending: false })
      if (versionsData) setVersions(versionsData)

      const { data: testsData } = await supabase
        .from('labs_experiments')
        .select('*')
        .eq('meter_model_id', modelId)
        .order('created_at', { ascending: false })
      if (testsData) setTests(testsData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Zone management
  function addZone(fieldType: string) {
    const config = ZONE_TYPES.find(z => z.value === fieldType)
    // Check if zone already exists
    if (zones.find(z => z.fieldType === fieldType)) return
    setZones([...zones, { 
      id: crypto.randomUUID(), 
      fieldType, 
      label: config?.label || fieldType,
      position: null
    }])
  }

  function removeZone(id: string) {
    setZones(zones.filter(z => z.id !== id))
  }

  function startRepositioning(zoneId: string) {
    setRepositioningZoneId(zoneId)
    setShowZonesOnPhoto(true)
  }

  function handlePhotoMouseDown(e: React.MouseEvent) {
    if (!repositioningZoneId || !photoContainerRef.current) return
    e.preventDefault()
    const rect = photoContainerRef.current.getBoundingClientRect()
    setDragStart({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height })
  }

  function handlePhotoMouseMove(e: React.MouseEvent) {
    if (!repositioningZoneId || !dragStart || !photoContainerRef.current) return
    const rect = photoContainerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setZones(zones.map(z => z.id === repositioningZoneId ? { 
      ...z, 
      position: { 
        x: Math.min(dragStart.x, x), 
        y: Math.min(dragStart.y, y), 
        w: Math.abs(x - dragStart.x), 
        h: Math.abs(y - dragStart.y) 
      } 
    } : z))
  }

  function handlePhotoMouseUp() { 
    setDragStart(null)
    setRepositioningZoneId(null) 
  }

  // Calibration photo
  function handleCalibrationPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (calibrationPhotoUrl?.startsWith('blob:')) URL.revokeObjectURL(calibrationPhotoUrl)
    setCalibrationPhotoFile(file)
    setCalibrationPhotoUrl(URL.createObjectURL(file))
  }

  function removeCalibrationPhoto() {
    if (calibrationPhotoUrl?.startsWith('blob:')) URL.revokeObjectURL(calibrationPhotoUrl)
    setCalibrationPhotoFile(null)
    setCalibrationPhotoUrl(null)
  }

  // Generate prompt with zones
  function generatePromptText(): string {
    const typeLabel = meterType === 'other' ? customMeterType : METER_TYPES.find(t => t.value === meterType)?.label || meterType
    const formatExample = 'X'.repeat(integerDigits) + ',' + 'X'.repeat(decimalDigits)
    
    let prompt = `MODÈLE: ${manufacturer ? manufacturer + ' ' : ''}${name}\nTYPE: ${typeLabel}\n\nRÈGLES DE LECTURE:\n- Index: ${integerDigits} entiers + ${decimalDigits} décimales\n- Format attendu: ${formatExample}`

    if (decimalIndicator === 'red_digits') prompt += `\n- Les ${decimalDigits} derniers chiffres en ROUGE = décimales`
    else if (decimalIndicator === 'red_background') prompt += `\n- Les ${decimalDigits} derniers chiffres sur FOND ROUGE = décimales`
    else if (decimalIndicator === 'comma') prompt += `\n- Virgule visible entre entiers et décimales`
    else if (decimalIndicator === 'other' && customDecimalIndicator) prompt += `\n- ${customDecimalIndicator}`

    // Add zones positions to prompt
    const zonesWithPosition = zones.filter(z => z.position)
    if (zonesWithPosition.length > 0) {
      prompt += `\n\nZONES À ANALYSER:`
      zonesWithPosition.forEach(z => {
        if (z.position) {
          const xStart = Math.round(z.position.x * 100)
          const xEnd = Math.round((z.position.x + z.position.w) * 100)
          const yStart = Math.round(z.position.y * 100)
          const yEnd = Math.round((z.position.y + z.position.h) * 100)
          prompt += `\n- ${z.label}: zone ${xStart}-${xEnd}% horizontal, ${yStart}-${yEnd}% vertical`
        }
      })
    }

    // Add corrections
    const corrections = tests.filter(t => t.status === 'corrected' && t.corrected_data?.reading)
    if (corrections.length > 0) {
      prompt += `\n\nCORRECTIONS (erreurs à éviter):`
      corrections.slice(0, 5).forEach(c => {
        const extracted = c.extracted_data?.reading?.value || ''
        const corrected = c.corrected_data?.reading || ''
        if (extracted && corrected) prompt += `\n- "${extracted}" → "${corrected}"`
      })
    }
    return prompt
  }

  async function handleSave() {
    if (!model || !name.trim()) return
    setSaving(true)
    
    try {
      const finalMeterType = meterType === 'other' ? customMeterType : meterType
      const finalDecimalIndicator = decimalIndicator === 'other' ? customDecimalIndicator : decimalIndicator
      const promptText = generatePromptText()

      // Upload calibration photo if new
      let photoUrl = model.reference_photos?.[0]
      if (calibrationPhotoFile) {
        const formData = new FormData()
        formData.append('file', calibrationPhotoFile)
        const uploadRes = await fetch('/api/upload-meter-photo', { method: 'POST', body: formData })
        if (uploadRes.ok) { 
          const { url } = await uploadRes.json()
          photoUrl = url 
        }
      }

      // Save model with zones
      await supabase.from('meter_models').update({ 
        name, 
        manufacturer: manufacturer || null, 
        meter_type: finalMeterType, 
        unit, 
        is_active: isActive,
        reference_photos: photoUrl ? [photoUrl] : model.reference_photos,
        zones: zones
      }).eq('id', modelId)

      // Save reading rules
      const rulesData = { 
        model_id: modelId, 
        reading_integer_digits: integerDigits, 
        reading_decimal_digits: decimalDigits, 
        decimal_indicator: finalDecimalIndicator, 
        prompt_rules: promptText 
      }
      if (rules?.id) await supabase.from('meter_reading_rules').update(rulesData).eq('id', rules.id)
      else await supabase.from('meter_reading_rules').insert(rulesData)

      // Update active version prompt
      const activeVersion = versions.find(v => v.is_active)
      if (activeVersion) {
        await supabase.from('meter_model_prompts').update({ prompt_text: promptText }).eq('id', activeVersion.id)
      }

      // Clear calibration photo state
      if (calibrationPhotoFile) {
        setCalibrationPhotoFile(null)
        setCalibrationPhotoUrl(null)
      }

      await loadModel()
    } catch (error) {
      console.error('Error:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function activateVersion(version: ModelVersion) {
    await supabase.from('meter_model_prompts').update({ is_active: false }).eq('model_id', modelId)
    await supabase.from('meter_model_prompts').update({ is_active: true }).eq('id', version.id)
    if (rules?.id) await supabase.from('meter_reading_rules').update({ prompt_rules: version.prompt_text }).eq('id', rules.id)
    loadModel()
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('meter_models').delete().eq('id', modelId)
    router.push('/dashboard/meters')
  }

  async function submitCorrection() {
    if (!currentTestResult) return
    setShowCorrectionModal(false)
  }

  function formatDate(d: string) { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

  const formatPreview = 'X'.repeat(integerDigits) + ',' + 'X'.repeat(decimalDigits)
  const typeConfig = METER_TYPES.find(t => t.value === meterType) || METER_TYPES[0]
  const displayPhotoUrl = calibrationPhotoUrl || model?.reference_photos?.[0]

  if (loading) return <div className="p-6 flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>
  if (!model) return <div className="p-6 text-center"><p className="text-gray-500">Modèle non trouvé</p><Link href="/dashboard/meters"><Button variant="outline" className="mt-4">Retour</Button></Link></div>

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/meters"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><span className="text-2xl">{typeConfig.icon}</span>{model.name}</h1>
            <p className="text-gray-500 text-sm">{model.manufacturer} • {typeConfig.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/meters/${modelId}/analysis`}>
            <Button variant="outline" className="gap-2">
              <Target className="h-4 w-4" />
              Analyser les versions
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Supprimer ce modèle ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Taux de réussite */}
      <Card className={`p-4 mb-6 ${testStats.total === 0 ? 'bg-gray-50' : testStats.successRate && testStats.successRate >= 80 ? 'bg-green-50 border-green-200' : testStats.successRate && testStats.successRate >= 50 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
        {testStats.total === 0 ? (
          <div className="flex items-center gap-3"><Target className="h-6 w-6 text-gray-400" /><span className="text-gray-500">Pas encore de tests</span></div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {testStats.successRate && testStats.successRate >= 80 ? <CheckCircle className="h-6 w-6 text-green-600" /> : testStats.successRate && testStats.successRate >= 50 ? <AlertCircle className="h-6 w-6 text-orange-600" /> : <XCircle className="h-6 w-6 text-red-600" />}
              <span className={`text-2xl font-bold ${testStats.successRate && testStats.successRate >= 80 ? 'text-green-700' : testStats.successRate && testStats.successRate >= 50 ? 'text-orange-700' : 'text-red-700'}`}>{testStats.successRate?.toFixed(0)}%</span>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center"><div className="font-bold">{testStats.total}</div><div className="text-gray-500">Tests</div></div>
              <div className="text-center"><div className="font-bold text-green-600">{testStats.validated}</div><div className="text-gray-500">Validés</div></div>
              <div className="text-center"><div className="font-bold text-red-600">{testStats.rejected}</div><div className="text-gray-500">Rejetés</div></div>
            </div>
          </div>
        )}
      </Card>

      {/* Photo avec zones + Informations */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Photo avec zones */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">
              Photo
              {repositioningZoneId && <span className="text-teal-600 ml-2">— Dessinez la zone</span>}
            </h3>
            <div className="flex items-center gap-2">
              {zones.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowZonesOnPhoto(!showZonesOnPhoto)}
                  className="h-8 text-xs gap-1"
                >
                  {showZonesOnPhoto ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showZonesOnPhoto ? 'Masquer' : 'Afficher'}
                </Button>
              )}
            </div>
          </div>
          
          {displayPhotoUrl ? (
            <div className="space-y-3">
              <div 
                ref={photoContainerRef} 
                className={`relative select-none ${repositioningZoneId ? 'cursor-crosshair' : 'cursor-pointer'}`}
                onMouseDown={handlePhotoMouseDown}
                onMouseMove={handlePhotoMouseMove}
                onMouseUp={handlePhotoMouseUp}
                onMouseLeave={handlePhotoMouseUp}
                onClick={() => !repositioningZoneId && !dragStart && setShowImageLightbox(true)}
              >
                <img 
                  src={displayPhotoUrl} 
                  alt={model.name} 
                  className="w-full rounded-lg" 
                  draggable={false}
                />
                {!repositioningZoneId && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowImageLightbox(true) }} 
                    className="absolute bottom-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                )}
                
                {/* Zones overlay */}
                {showZonesOnPhoto && zones.map((zone) => zone.position && (
                  <div 
                    key={zone.id}
                    className="absolute border-2 rounded"
                    style={{
                      left: `${zone.position.x * 100}%`,
                      top: `${zone.position.y * 100}%`,
                      width: `${zone.position.w * 100}%`,
                      height: `${zone.position.h * 100}%`,
                      borderColor: ZONE_TYPES.find(z => z.value === zone.fieldType)?.color || '#6B7280',
                      backgroundColor: `${ZONE_TYPES.find(z => z.value === zone.fieldType)?.color || '#6B7280'}30`
                    }}
                  >
                    <span 
                      className="absolute -top-5 left-0 px-1 text-xs text-white rounded"
                      style={{ backgroundColor: ZONE_TYPES.find(z => z.value === zone.fieldType)?.color || '#6B7280' }}
                    >
                      {zone.label}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Change photo button */}
              <div className="flex gap-2">
                <label className="flex-1">
                  <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                    <span>
                      <Camera className="h-4 w-4" />
                      {calibrationPhotoFile ? 'Changer la photo' : 'Nouvelle photo de calibration'}
                    </span>
                  </Button>
                  <input type="file" accept="image/*" onChange={handleCalibrationPhotoUpload} className="hidden" />
                </label>
                {calibrationPhotoFile && (
                  <Button variant="outline" size="sm" onClick={removeCalibrationPhoto}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors">
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <span className="text-gray-600 text-sm">Ajouter une photo</span>
              <input type="file" accept="image/*" onChange={handleCalibrationPhotoUpload} className="hidden" />
            </label>
          )}
        </Card>

        {/* Informations */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Informations</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-gray-500">Nom *</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs text-gray-500">Fabricant</Label><Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Type</Label>
                <Select value={meterType} onValueChange={(v) => { setMeterType(v); if (v !== 'other') { const t = METER_TYPES.find(t => t.value === v); if (t) setUnit(t.unit) } }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{METER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-gray-500">Unité</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1" /></div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div><div className="font-medium text-sm">Actif</div><div className="text-xs text-gray-500">Utilisé pour la reconnaissance</div></div>
              <Switch 
                checked={isActive} 
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setPendingActiveState(false)
                    setShowDeactivateConfirm(true)
                  } else {
                    setIsActive(true)
                  }
                }}
                className={isActive ? 'data-[state=checked]:bg-green-500' : 'data-[state=unchecked]:bg-red-400'}
              />
            </div>
            
            {/* Version active */}
            <div className="pt-3 border-t mt-3">
              <Label className="text-xs text-gray-500">Version active</Label>
              {versions.length > 0 ? (
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-green-600 text-white">v{versions.find(v => v.is_active)?.version || versions[0].version}</Badge>
                  <span className="text-sm text-gray-500">{formatDate(versions.find(v => v.is_active)?.created_at || versions[0].created_at)}</span>
                </div>
              ) : (
                <p className="text-sm text-gray-400 mt-1">Aucune version</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Zones de calibration */}
      <Card className="p-4 mb-6">
        <h3 className="font-semibold mb-3">Zones de lecture</h3>
        
        {/* Zone compteur (parent) */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">1. Zone compteur</span>
          </div>
          {!zones.find(z => z.fieldType === 'meterBounds') ? (
            <Button 
              onClick={() => addZone('meterBounds')} 
              className="w-full gap-2 bg-gray-600 hover:bg-gray-700"
            >
              <Plus className="h-4 w-4" />
              Délimiter le compteur
            </Button>
          ) : (
            <div className="p-3 border rounded-lg" style={{ borderLeftWidth: 4, borderLeftColor: '#6B7280' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">🔲 Zone compteur</span>
                  {zones.find(z => z.fieldType === 'meterBounds')?.position ? (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700">✓ Définie</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">À définir</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startRepositioning(zones.find(z => z.fieldType === 'meterBounds')!.id)}>
                    <Move className="h-3 w-3 mr-1" />Modifier
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeZone(zones.find(z => z.fieldType === 'meterBounds')!.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Zones de données */}
        <div className={`space-y-2 ${!zones.find(z => z.fieldType === 'meterBounds')?.position ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">2. Zones de données</span>
            <div className="flex gap-2">
              {ZONE_TYPES.filter(t => !t.isParent).map((type) => (
                <Button 
                  key={type.value}
                  variant="outline" 
                  size="sm" 
                  onClick={() => addZone(type.value)}
                  disabled={zones.some(z => z.fieldType === type.value)}
                  className="gap-1 h-8 text-xs"
                  style={{ borderColor: zones.some(z => z.fieldType === type.value) ? type.color : undefined }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }} />
                  {type.label}
                </Button>
              ))}
            </div>
          </div>
          
          {zones.filter(z => z.fieldType !== 'meterBounds').length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">Ajoutez des zones pour N° série, Index, etc.</p>
          ) : (
            <div className="space-y-2">
              {zones.filter(z => z.fieldType !== 'meterBounds').map((zone) => {
                const config = ZONE_TYPES.find(z => z.value === zone.fieldType)
                return (
                  <div 
                    key={zone.id} 
                    className="p-3 border rounded-lg"
                    style={{ borderLeftWidth: 4, borderLeftColor: config?.color || '#6B7280' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">{zone.label}</span>
                        {zone.position ? (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">✓ Positionné</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">Non positionné</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant={zone.position ? "outline" : "default"}
                          size="sm" 
                          className={`h-7 text-xs gap-1 ${!zone.position ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
                          onClick={() => startRepositioning(zone.id)}
                        >
                          <Move className="h-3 w-3" />
                          {zone.position ? 'Modifier' : 'Positionner'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeZone(zone.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Index de consommation */}
      <Card className="p-4 mb-6">
        <h3 className="font-semibold mb-3">Index de consommation</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-gray-500">Chiffres entiers</Label><Input type="number" value={integerDigits} onChange={(e) => setIntegerDigits(parseInt(e.target.value) || 1)} className="mt-1" /></div>
              <div><Label className="text-xs text-gray-500">Décimales à utiliser</Label><Input type="number" value={decimalDigits} onChange={(e) => setDecimalDigits(parseInt(e.target.value) || 0)} className="mt-1" /></div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Comment repérer les décimales ?</Label>
              <Select value={decimalIndicator} onValueChange={setDecimalIndicator}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{DECIMAL_INDICATORS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
              {decimalIndicator === 'other' && <Input value={customDecimalIndicator} onChange={(e) => setCustomDecimalIndicator(e.target.value)} placeholder="Décrivez..." className="mt-2" />}
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="p-4 bg-gray-50 rounded-lg border text-center">
              <div className="text-xs text-gray-500 mb-2">Format attendu</div>
              <div className="font-mono text-xl">
                <span className="bg-gray-800 text-white px-2 py-1 rounded">{'X'.repeat(integerDigits)}</span>
                {decimalDigits > 0 && (
                  <>
                    <span className="text-gray-400 mx-1">,</span>
                    <span className="bg-red-500 text-white px-2 py-1 rounded">{'X'.repeat(decimalDigits)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Historique tests */}
      {tests.length > 0 && (
        <Card className="p-4 mb-6">
          <h4 className="font-semibold mb-3">Historique des tests ({tests.length})</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tests.slice(0, 10).map((t) => (
              <div key={t.id} className={`flex items-center justify-between p-2 rounded text-xs ${t.status === 'validated' || t.status === 'corrected' ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center gap-2">
                  {t.status === 'validated' || t.status === 'corrected' ? <Check className="h-3 w-3 text-green-600" /> : <X className="h-3 w-3 text-red-600" />}
                  <span className="font-mono">{t.extracted_data?.reading?.value || '-'}</span>
                  {t.corrected_data?.reading && <span className="text-green-600">→ {t.corrected_data.reading}</span>}
                </div>
                <span className="text-gray-400">{formatDate(t.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Enregistrer */}
      <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full h-12 text-base">
        {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
        Enregistrer
      </Button>

      {/* Modals */}
      {/* Lightbox */}
      <Dialog open={showImageLightbox} onOpenChange={setShowImageLightbox}>
        <DialogContent className="max-w-4xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Image agrandie</DialogTitle>
          </DialogHeader>
          {displayPhotoUrl && (
            <div className="relative">
              <img 
                src={displayPhotoUrl} 
                alt="Image agrandie" 
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
                onClick={() => setShowImageLightbox(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Popup désactivation */}
      <Dialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Désactiver ce modèle ?
            </DialogTitle>
            <DialogDescription>
              Ce modèle ne sera plus utilisé pour la reconnaissance automatique des compteurs dans l'application.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeactivateConfirm(false); setPendingActiveState(null) }}>Annuler</Button>
            <Button 
              variant="destructive" 
              onClick={() => { 
                setIsActive(false)
                setShowDeactivateConfirm(false)
                setPendingActiveState(null)
              }}
            >
              Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showVersionDetail} onOpenChange={() => setShowVersionDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Version {showVersionDetail?.version} {showVersionDetail?.is_active && <Badge className="bg-green-600 ml-2">Actif</Badge>}</DialogTitle>
            <DialogDescription>{showVersionDetail && formatDate(showVersionDetail.created_at)}</DialogDescription>
          </DialogHeader>
          <pre className="bg-gray-50 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto border">{showVersionDetail?.prompt_text}</pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVersionDetail(null)}>Fermer</Button>
            {showVersionDetail && !showVersionDetail.is_active && <Button onClick={() => { activateVersion(showVersionDetail); setShowVersionDetail(null) }}><RotateCcw className="h-4 w-4 mr-2" /> Activer</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit3 className="h-5 w-5 text-orange-500" />Corriger le test</DialogTitle>
            <DialogDescription>Indiquez les valeurs correctes pour améliorer la reconnaissance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm">N° série lu par l'IA</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={currentTestResult?.extractedSerial || ''} disabled className="bg-gray-100 font-mono" />
                <span className="text-gray-400">→</span>
                <Input value={correctionSerial} onChange={(e) => setCorrectionSerial(e.target.value)} className="font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Index lu par l'IA</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={currentTestResult?.extractedReading || ''} disabled className="bg-gray-100 font-mono" />
                <span className="text-gray-400">→</span>
                <Input value={correctionReading} onChange={(e) => setCorrectionReading(e.target.value)} className="font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Raison (optionnel)</Label>
              <Textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Ex: Décimales mal placées" className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCorrectionModal(false)}>Annuler</Button>
            <Button onClick={submitCorrection} className="bg-orange-500 hover:bg-orange-600"><Check className="h-4 w-4 mr-1" /> Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
