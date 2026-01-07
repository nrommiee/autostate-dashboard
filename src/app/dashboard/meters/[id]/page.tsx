'use client'

import { useEffect, useState } from 'react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  ArrowLeft, Save, Loader2, Check, Trash2, CheckCircle, XCircle, AlertCircle,
  Target, MoreHorizontal, RotateCcw, Eye, Upload, Play, Edit3, X
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
  status: 'draft' | 'active' | 'archived'
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
  extracted_serial: string | null
  extracted_reading: string | null
  correct_serial: string | null
  correct_reading: string | null
  confidence: number
  is_validated: boolean
  is_rejected: boolean
  rejection_reason: string | null
  created_at: string
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

export default function MeterModelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const modelId = params.id as string

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
  
  // UI
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [showVersionDetail, setShowVersionDetail] = useState<ModelVersion | null>(null)
  
  // Tests
  const [testPhotoFile, setTestPhotoFile] = useState<File | null>(null)
  const [testPhotoUrl, setTestPhotoUrl] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [currentTestResult, setCurrentTestResult] = useState<any>(null)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [correctionSerial, setCorrectionSerial] = useState('')
  const [correctionReading, setCorrectionReading] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')

  // Stats
  const testStats = {
    total: tests.length,
    validated: tests.filter(t => t.is_validated).length,
    rejected: tests.filter(t => t.is_rejected).length,
    successRate: tests.length > 0 ? (tests.filter(t => t.is_validated).length / tests.length) * 100 : null
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

      const { data: testsData } = await supabase.from('meter_model_tests').select('*').eq('model_id', modelId).order('created_at', { ascending: false })
      if (testsData) setTests(testsData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  function generatePromptText(): string {
    const typeLabel = meterType === 'other' ? customMeterType : METER_TYPES.find(t => t.value === meterType)?.label || meterType
    const formatExample = 'X'.repeat(integerDigits) + ',' + 'X'.repeat(decimalDigits)
    
    let prompt = `MODÈLE: ${manufacturer ? manufacturer + ' ' : ''}${name}\nTYPE: ${typeLabel}\n\nRÈGLES DE LECTURE:\n- Index: ${integerDigits} entiers + ${decimalDigits} décimales\n- Format attendu: ${formatExample}`

    if (decimalIndicator === 'red_digits') prompt += `\n- Les ${decimalDigits} derniers chiffres en ROUGE = décimales`
    else if (decimalIndicator === 'red_background') prompt += `\n- Les ${decimalDigits} derniers chiffres sur FOND ROUGE = décimales`
    else if (decimalIndicator === 'comma') prompt += `\n- Virgule visible entre entiers et décimales`
    else if (decimalIndicator === 'other' && customDecimalIndicator) prompt += `\n- ${customDecimalIndicator}`

    const corrections = tests.filter(t => t.is_rejected && t.correct_reading)
    if (corrections.length > 0) {
      prompt += `\n\nCORRECTIONS (erreurs à éviter):`
      corrections.slice(0, 5).forEach(c => {
        prompt += `\n- "${c.extracted_reading}" → "${c.correct_reading}"`
        if (c.rejection_reason) prompt += ` (${c.rejection_reason})`
      })
    }
    return prompt
  }

  async function handleSave() {
    if (!model || !name.trim()) return
    setSaving(true)
    setShowSaveConfirm(false)
    
    try {
      const finalMeterType = meterType === 'other' ? customMeterType : meterType
      const finalDecimalIndicator = decimalIndicator === 'other' ? customDecimalIndicator : decimalIndicator
      const promptText = generatePromptText()

      await supabase.from('meter_models').update({ name, manufacturer: manufacturer || null, meter_type: finalMeterType, unit, is_active: isActive }).eq('id', modelId)

      const rulesData = { model_id: modelId, reading_integer_digits: integerDigits, reading_decimal_digits: decimalDigits, decimal_indicator: finalDecimalIndicator, prompt_rules: promptText }
      if (rules?.id) await supabase.from('meter_reading_rules').update(rulesData).eq('id', rules.id)
      else await supabase.from('meter_reading_rules').insert(rulesData)

      await supabase.from('meter_model_prompts').update({ is_active: false }).eq('model_id', modelId)
      const newVersion = Math.max(...versions.map(v => v.version), 0) + 1
      await supabase.from('meter_model_prompts').insert({ model_id: modelId, prompt_text: promptText, version: newVersion, is_active: true })

      router.push('/dashboard/meters')
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

  // Tests
  function handleTestPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (testPhotoUrl?.startsWith('blob:')) URL.revokeObjectURL(testPhotoUrl)
    setTestPhotoFile(file)
    setTestPhotoUrl(URL.createObjectURL(file))
    setCurrentTestResult(null)
  }

  async function runTest() {
    if (!testPhotoFile) return
    setTesting(true)
    try {
      const base64 = await fileToBase64(testPhotoFile)
      const promptText = rules?.prompt_rules || generatePromptText()
      const response = await fetch('/api/test-meter', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ testPhoto: base64, promptRules: promptText, modelData: { name, manufacturer, meterType, unit, integerDigits, decimalDigits } }) 
      })
      const result = await response.json()
      setCurrentTestResult({ 
        success: result.success !== false, 
        confidence: result.confidence || 0.95, 
        extractedSerial: result.extractedSerial || result.serialNumber, 
        extractedReading: result.extractedReading || result.reading
      })
    } catch { 
      setCurrentTestResult({ success: false, confidence: 0 }) 
    } finally { 
      setTesting(false) 
    }
  }

  async function validateTest() { 
    if (!currentTestResult) return
    await supabase.from('meter_model_tests').insert({ model_id: modelId, extracted_serial: currentTestResult.extractedSerial, extracted_reading: currentTestResult.extractedReading, confidence: currentTestResult.confidence, is_validated: true, is_rejected: false })
    resetTest()
    loadModel()
  }

  function openCorrectionModal() {
    if (!currentTestResult) return
    setCorrectionSerial(currentTestResult.extractedSerial || '')
    setCorrectionReading(currentTestResult.extractedReading || '')
    setCorrectionReason('')
    setShowCorrectionModal(true)
  }

  async function submitCorrection() {
    if (!currentTestResult) return
    await supabase.from('meter_model_tests').insert({
      model_id: modelId,
      extracted_serial: currentTestResult.extractedSerial,
      extracted_reading: currentTestResult.extractedReading,
      correct_serial: correctionSerial !== currentTestResult.extractedSerial ? correctionSerial : null,
      correct_reading: correctionReading !== currentTestResult.extractedReading ? correctionReading : null,
      confidence: currentTestResult.confidence,
      is_validated: false,
      is_rejected: true,
      rejection_reason: correctionReason || null
    })
    setShowCorrectionModal(false)
    resetTest()
    loadModel()
  }

  function resetTest() { 
    if (testPhotoUrl?.startsWith('blob:')) URL.revokeObjectURL(testPhotoUrl)
    setTestPhotoFile(null)
    setTestPhotoUrl(null)
    setCurrentTestResult(null)
  }

  function formatDate(d: string) { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

  const formatPreview = 'X'.repeat(integerDigits) + ',' + 'X'.repeat(decimalDigits)
  const typeConfig = METER_TYPES.find(t => t.value === meterType) || METER_TYPES[0]

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
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Supprimer ce modèle ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

      {/* Photo + Informations */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className="p-4">{model.reference_photos?.[0] && <img src={model.reference_photos[0]} alt={model.name} className="w-full rounded-lg" />}</Card>
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
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </Card>
      </div>

      {/* Index + Versions */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Index de consommation</h3>
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
            <div className="p-3 bg-gray-50 rounded-lg border text-center">
              <div className="text-xs text-gray-500 mb-2">Format attendu</div>
              <div className="font-mono text-xl">
                <span className="bg-gray-800 text-white px-2 py-1 rounded">{formatPreview.split(',')[0]}</span>
                <span className="text-gray-400 mx-1">,</span>
                <span className={`px-2 py-1 rounded ${decimalIndicator === 'red_digits' || decimalIndicator === 'red_background' ? 'bg-red-500 text-white' : 'bg-gray-300'}`}>{formatPreview.split(',')[1]}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Versions du modèle</h3>
          {versions.length <= 1 ? (
            <div className={`p-3 rounded-lg ${versions.length === 1 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
              {versions.length === 1 ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">v1</span>
                  <Badge className="bg-green-600 text-white">Actif</Badge>
                  <span className="text-sm text-gray-500 ml-auto">{formatDate(versions[0].created_at)}</span>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Enregistrez pour créer la première version.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {versions.map(v => (
                <div key={v.id} className={`flex items-center justify-between p-2 rounded-lg border ${v.is_active ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">v{v.version}</span>
                    {v.is_active && <Badge className="bg-green-600 text-white text-xs">Actif</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatDate(v.created_at)}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setShowVersionDetail(v)}><Eye className="h-4 w-4 mr-2" /> Voir</DropdownMenuItem>
                        {!v.is_active && <DropdownMenuItem onClick={() => activateVersion(v)}><RotateCcw className="h-4 w-4 mr-2" /> Activer</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Lien vers Tests dans Labs */}
      {model?.status === 'active' && (
        <Card className="p-4 mb-6 bg-purple-50 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-purple-900">Tester ce modèle</h3>
              <p className="text-sm text-purple-700">Les tests se font dans le Labs Vision Compteurs</p>
            </div>
            <Button onClick={() => router.push('/dashboard/labs/meters?tab=tests')} className="bg-purple-600 hover:bg-purple-700">
              Aller aux Tests
            </Button>
          </div>
        </Card>
      )}

      {/* Enregistrer */}
      <Button onClick={() => setShowSaveConfirm(true)} disabled={saving || !name.trim()} className="w-full h-12 text-base">
        {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
        Enregistrer
      </Button>

      {/* Modals */}
      <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer les modifications</DialogTitle>
            <DialogDescription>Une nouvelle version (v{Math.max(...versions.map(v => v.version), 0) + 1}) sera créée. Les versions précédentes restent disponibles.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveConfirm(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}Confirmer</Button>
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

async function fileToBase64(file: File): Promise<string> { 
  return new Promise((resolve) => { 
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(file) 
  }) 
}
