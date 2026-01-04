'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  MeterType,
  MeterFieldType,
  METER_TYPE_CONFIG,
  METER_FIELD_CONFIG,
} from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  ArrowLeft, ArrowRight, Loader2, Save, CheckCircle, Upload, 
  Sparkles, X, Trash2, Plus, Play, Check, RotateCcw, 
  AlertTriangle, Move, FileText
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface Zone {
  id: string
  fieldType: MeterFieldType
  label: string
  extractedValue: string
  aiValue?: string // Valeur originale de Claude
  hasDecimals: boolean
  decimalDigits: number
  position: { x: number; y: number; w: number; h: number } | null
  isValidated: boolean
}

interface TestResult {
  id: string
  photoUrl: string
  timestamp: Date
  success: boolean
  confidence: number
  extractedSerial?: string
  extractedReading?: string
  isValidated: boolean
}

interface Keyword {
  value: string
  selected: boolean
}

// ============================================
// CONSTANTS
// ============================================
const STEPS = [
  { id: 1, label: 'Photo & Analyse', icon: '📷' },
  { id: 2, label: 'Informations', icon: '📝' },
  { id: 3, label: 'Zones', icon: '🎯' },
  { id: 4, label: 'Tests', icon: '✅' },
]

const ZONE_COLORS: Record<string, string> = {
  serialNumber: '#3B82F6',
  ean: '#8B5CF6',
  readingSingle: '#10B981',
  readingDay: '#F59E0B',
  readingNight: '#6366F1',
  readingExclusiveNight: '#EC4899',
  readingProduction: '#14B8A6',
  subscribedPower: '#EF4444',
  custom: '#6B7280',
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function CreateMeterModelPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const photoContainerRef = useRef<HTMLDivElement>(null)
  
  const [currentStep, setCurrentStep] = useState(1)

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)

  // Analysis result
  const [analysisConfidence, setAnalysisConfidence] = useState(0)
  const [requiresVerification, setRequiresVerification] = useState(false)
  const [doubleReadMatch, setDoubleReadMatch] = useState(true)
  const [qualityScore, setQualityScore] = useState(100)
  const [qualityIssues, setQualityIssues] = useState<string[]>([])

  // Info
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [meterType, setMeterType] = useState<MeterType>('gas')
  const [unit, setUnit] = useState('m³')
  const [displayType, setDisplayType] = useState('mechanical')
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [description, setDescription] = useState('')
  const [datasheetUrl, setDatasheetUrl] = useState('')

  // Zones
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [repositioningZoneId, setRepositioningZoneId] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)

  // Tests
  const [testPhotoFile, setTestPhotoFile] = useState<File | null>(null)
  const [testPhotoUrl, setTestPhotoUrl] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [currentTestResult, setCurrentTestResult] = useState<TestResult | null>(null)
  const [testHistory, setTestHistory] = useState<TestResult[]>([])

  // Save
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // ============================================
  // PHOTO UPLOAD
  // ============================================
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl)
    setPhotoFile(file)
    setPhotoUrl(URL.createObjectURL(file))
    setAnalysisComplete(false)
    resetForm()
  }

  const removePhoto = () => {
    if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl)
    setPhotoFile(null)
    setPhotoUrl(null)
    setAnalysisComplete(false)
    resetForm()
  }

  const resetForm = () => {
    setName('')
    setManufacturer('')
    setKeywords([])
    setZones([])
    setDescription('')
    setAnalysisConfidence(0)
    setRequiresVerification(false)
  }

  // ============================================
  // ANALYSIS (DOUBLE READ)
  // ============================================
  const analyzePhoto = async () => {
    if (!photoFile) return
    setAnalyzing(true)
    setError(null)

    try {
      const base64 = await fileToBase64(photoFile)
      
      const response = await fetch('/api/analyze-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          photos: [base64], 
          doubleRead: true // Dashboard = double lecture
        })
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.quality?.score < 70) {
          setQualityScore(result.quality.score)
          setQualityIssues(result.quality.issues || [])
          setError(`Photo de mauvaise qualité (${result.quality.score}%). ${result.suggestion || 'Reprenez la photo.'}`)
          return
        }
        throw new Error(result.error)
      }

      // Populate form
      if (result.name) setName(result.name)
      if (result.manufacturer) setManufacturer(result.manufacturer)
      if (result.meterType) {
        setMeterType(result.meterType)
        setUnit(METER_TYPE_CONFIG[result.meterType as MeterType]?.unit || 'm³')
      }
      if (result.description) setDescription(result.description)
      if (result.keywords) {
        setKeywords(result.keywords.map((kw: string) => ({
          value: kw,
          selected: kw.length <= 15 // Short = probably relevant
        })))
      }

      // Confidence & verification
      setAnalysisConfidence(result.confidence || 0.7)
      setRequiresVerification(result.requiresVerification || false)
      setDoubleReadMatch(result.doubleReadMatch !== false)
      setQualityScore(result.quality?.score || 80)

      // Zones with extracted values
      if (result.suggestedZones?.length > 0) {
        setZones(result.suggestedZones.map((z: any) => ({
          id: crypto.randomUUID(),
          fieldType: z.fieldType,
          label: z.label || METER_FIELD_CONFIG[z.fieldType as MeterFieldType]?.label || '',
          extractedValue: z.extractedValue || '',
          aiValue: z.extractedValue || '',
          hasDecimals: z.hasDecimals || false,
          decimalDigits: z.decimalDigits || 3,
          position: z.position,
          isValidated: false
        })))
      } else {
        setZones([
          { id: crypto.randomUUID(), fieldType: 'serialNumber', label: 'Numéro de série', extractedValue: result.serialNumber || '', aiValue: result.serialNumber || '', hasDecimals: false, decimalDigits: 0, position: null, isValidated: false },
          { id: crypto.randomUUID(), fieldType: 'readingSingle', label: 'Index', extractedValue: result.reading || '', aiValue: result.reading || '', hasDecimals: true, decimalDigits: 3, position: null, isValidated: false }
        ])
      }

      setAnalysisComplete(true)

    } catch (err: any) {
      setError(err.message || 'Erreur analyse')
    } finally {
      setAnalyzing(false)
    }
  }

  // ============================================
  // KEYWORDS
  // ============================================
  const toggleKeyword = (index: number) => {
    setKeywords(keywords.map((kw, i) => i === index ? { ...kw, selected: !kw.selected } : kw))
  }

  // ============================================
  // ZONES - REPOSITIONING
  // ============================================
  const startRepositioning = (zoneId: string) => {
    setRepositioningZoneId(zoneId)
    setSelectedZoneId(zoneId)
  }

  const handlePhotoMouseDown = (e: React.MouseEvent) => {
    if (!repositioningZoneId || !photoContainerRef.current) return
    
    const rect = photoContainerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    
    setDragStart({ x, y })
  }

  const handlePhotoMouseMove = (e: React.MouseEvent) => {
    if (!repositioningZoneId || !dragStart || !photoContainerRef.current) return
    
    const rect = photoContainerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    
    const newPosition = {
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      w: Math.abs(x - dragStart.x),
      h: Math.abs(y - dragStart.y)
    }
    
    updateZone(repositioningZoneId, { position: newPosition })
  }

  const handlePhotoMouseUp = () => {
    setDragStart(null)
    setRepositioningZoneId(null)
  }

  const removeZonePosition = (zoneId: string) => {
    updateZone(zoneId, { position: null })
  }

  const addZone = (fieldType: MeterFieldType) => {
    setZones([...zones, {
      id: crypto.randomUUID(),
      fieldType,
      label: METER_FIELD_CONFIG[fieldType].label,
      extractedValue: '',
      hasDecimals: METER_FIELD_CONFIG[fieldType].isReading,
      decimalDigits: 3,
      position: null,
      isValidated: false
    }])
  }

  const removeZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id))
  }

  const updateZone = (id: string, updates: Partial<Zone>) => {
    setZones(zones.map(z => z.id === id ? { ...z, ...updates } : z))
  }

  const validateZone = async (zone: Zone) => {
    // Si la valeur a été modifiée, enregistrer la correction
    if (zone.aiValue && zone.extractedValue !== zone.aiValue) {
      try {
        await fetch('/api/corrections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zone_type: zone.fieldType,
            ai_value: zone.aiValue,
            human_value: zone.extractedValue,
            confidence: analysisConfidence
          })
        })
      } catch (e) {
        console.error('Failed to save correction:', e)
      }
    }
    updateZone(zone.id, { isValidated: true })
  }

  // ============================================
  // TESTS
  // ============================================
  const handleTestPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (testPhotoUrl?.startsWith('blob:')) URL.revokeObjectURL(testPhotoUrl)
    setTestPhotoFile(file)
    setTestPhotoUrl(URL.createObjectURL(file))
    setCurrentTestResult(null)
  }

  const runTest = async () => {
    if (!testPhotoFile) return
    setTesting(true)

    try {
      const base64 = await fileToBase64(testPhotoFile)
      const response = await fetch('/api/test-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testPhoto: base64,
          modelData: {
            name, manufacturer, meterType, unit,
            keywords: keywords.filter(k => k.selected).map(k => k.value),
            zones, description
          }
        })
      })

      const result = await response.json()
      setCurrentTestResult({
        id: crypto.randomUUID(),
        photoUrl: testPhotoUrl!,
        timestamp: new Date(),
        success: result.success,
        confidence: result.confidence || 0,
        extractedSerial: result.extractedSerial,
        extractedReading: result.extractedReading,
        isValidated: false
      })
    } catch (err) {
      setCurrentTestResult({
        id: crypto.randomUUID(),
        photoUrl: testPhotoUrl!,
        timestamp: new Date(),
        success: false,
        confidence: 0,
        isValidated: false
      })
    } finally {
      setTesting(false)
    }
  }

  const validateTest = () => {
    if (!currentTestResult) return
    setTestHistory([{ ...currentTestResult, isValidated: true }, ...testHistory])
    resetTestPhoto()
  }

  const rejectTest = () => {
    if (!currentTestResult) return
    setTestHistory([{ ...currentTestResult, isValidated: false }, ...testHistory])
    resetTestPhoto()
  }

  const resetTestPhoto = () => {
    if (testPhotoUrl?.startsWith('blob:')) URL.revokeObjectURL(testPhotoUrl)
    setTestPhotoFile(null)
    setTestPhotoUrl(null)
    setCurrentTestResult(null)
  }

  // ============================================
  // SAVE
  // ============================================
  const handleSave = async () => {
    if (!name.trim() || !photoUrl || zones.length === 0) {
      setError('Complétez tous les champs')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Upload photo
      let uploadedPhotoUrl = photoUrl
      if (photoFile) {
        const formData = new FormData()
        formData.append('file', photoFile)
        const uploadRes = await fetch('/api/upload-meter-photo', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const { url } = await uploadRes.json()
          uploadedPhotoUrl = url
        }
      }

      const validatedTests = testHistory.filter(t => t.isValidated)

      const response = await fetch('/api/meter-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          manufacturer,
          meter_type: meterType,
          unit,
          display_type: displayType,
          ai_description: description,
          datasheet_url: datasheetUrl || null,
          keywords: keywords.filter(k => k.selected).map(k => k.value),
          reference_photos: [uploadedPhotoUrl],
          zones: zones.map(z => ({
            id: z.id,
            field_type: z.fieldType,
            label: z.label,
            has_decimals: z.hasDecimals,
            decimal_digits: z.decimalDigits,
            position: z.position,
            extracted_value: z.extractedValue
          })),
          is_active: true,
          is_verified: validatedTests.length > 0,
          test_success_rate: testHistory.length > 0 ? validatedTests.length / testHistory.length : 0
        })
      })

      if (!response.ok) throw new Error('Erreur création')

      setSaved(true)
      setTimeout(() => router.push('/dashboard/meters'), 1500)

    } catch (err: any) {
      setError(err.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================
  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1: return !!photoUrl && analysisComplete
      case 2: return !!name.trim()
      case 3: return zones.length > 0
      default: return true
    }
  }

  const goToStep = (step: number) => {
    if (step < 1 || step > 4) return
    if (step > currentStep && !canProceed(currentStep)) return
    setCurrentStep(step)
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/dashboard/meters">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="text-xl font-bold">Nouveau modèle</h1>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between mb-6 overflow-x-auto">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => goToStep(step.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
                step.id === currentStep ? 'bg-teal-100 text-teal-700' :
                step.id < currentStep ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step.id === currentStep ? 'bg-teal-600 text-white' :
                step.id < currentStep ? 'bg-green-600 text-white' : 'bg-gray-200'
              }`}>
                {step.id < currentStep ? '✓' : step.id}
              </span>
              <span className="hidden sm:inline text-sm">{step.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`w-6 md:w-12 h-0.5 mx-1 ${step.id < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <Card className="p-3 mb-4 bg-red-50 border-red-200 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-red-700 text-sm">{error}</span>
        </Card>
      )}

      {/* Success */}
      {saved && (
        <Card className="p-4 mb-4 bg-green-50 border-green-200 text-center">
          <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-1" />
          <p className="text-green-700 font-medium">Modèle créé !</p>
        </Card>
      )}

      {!saved && (
        <>
          {/* STEP 1: Photo */}
          {currentStep === 1 && (
            <Card className="p-4">
              <h2 className="font-semibold mb-1">Photo de référence</h2>
              <p className="text-gray-500 text-sm mb-4">L'IA fait une double lecture pour fiabiliser l'extraction.</p>

              {photoUrl ? (
                <div className="space-y-4">
                  <div className="relative max-w-md mx-auto">
                    <img src={photoUrl} alt="Compteur" className="w-full rounded-lg border" />
                    <button onClick={removePhoto} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {!analysisComplete ? (
                    <div className="text-center">
                      <Button onClick={analyzePhoto} disabled={analyzing} className="gap-2">
                        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {analyzing ? 'Double lecture...' : 'Analyser (2x)'}
                      </Button>
                    </div>
                  ) : (
                    <div className={`p-3 rounded-lg border text-center ${
                      doubleReadMatch ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      {doubleReadMatch ? (
                        <>
                          <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
                          <p className="text-green-700 font-medium">Double lecture concordante</p>
                          <p className="text-green-600 text-sm">Confiance: {Math.round(analysisConfidence * 100)}%</p>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-6 w-6 text-yellow-600 mx-auto mb-1" />
                          <p className="text-yellow-700 font-medium">Vérification requise</p>
                          <p className="text-yellow-600 text-sm">Les deux lectures diffèrent, vérifiez les valeurs</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50">
                  <Upload className="h-10 w-10 text-gray-400 mb-2" />
                  <span className="text-gray-600">Ajouter une photo</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              )}
            </Card>
          )}

          {/* STEP 2: Info */}
          {currentStep === 2 && (
            <Card className="p-4 space-y-4">
              <h2 className="font-semibold">Informations</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nom *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="G4 RF1" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Fabricant</Label>
                  <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Itron" className="mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Type *</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {Object.entries(METER_TYPE_CONFIG).slice(0, 4).map(([type, config]) => (
                    <button
                      key={type}
                      onClick={() => { setMeterType(type as MeterType); setUnit(config.unit) }}
                      className={`p-2 rounded-lg border text-center ${meterType === type ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`}
                    >
                      <span className="text-lg">{config.icon}</span>
                      <div className="text-xs">{config.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Unité</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Affichage</Label>
                  <Select value={displayType} onValueChange={setDisplayType}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mechanical">Mécanique</SelectItem>
                      <SelectItem value="digital">Digital</SelectItem>
                      <SelectItem value="dials">Cadrans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Datasheet URL */}
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Fiche technique (URL)
                </Label>
                <Input 
                  value={datasheetUrl} 
                  onChange={(e) => setDatasheetUrl(e.target.value)} 
                  placeholder="https://..." 
                  className="mt-1" 
                />
                <p className="text-xs text-gray-400 mt-1">Lien vers le PDF fabricant (optionnel)</p>
              </div>

              {/* Keywords */}
              {keywords.length > 0 && (
                <div>
                  <Label className="text-xs">Mots-clés (cliquez pour sélectionner)</Label>
                  <div className="flex flex-wrap gap-1 mt-1 p-2 border rounded-lg bg-gray-50 max-h-24 overflow-y-auto">
                    {keywords.map((kw, i) => (
                      <Badge
                        key={i}
                        variant={kw.selected ? 'default' : 'outline'}
                        className={`cursor-pointer text-xs ${kw.selected ? 'bg-teal-600' : 'bg-white text-gray-500'}`}
                        onClick={() => toggleKeyword(i)}
                      >
                        {kw.selected && <Check className="h-2.5 w-2.5 mr-0.5" />}
                        {kw.value}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* STEP 3: Zones */}
          {currentStep === 3 && (
            <div className="grid md:grid-cols-5 gap-4">
              {/* Photo - 2/5 */}
              <Card className="md:col-span-2 p-3">
                <h3 className="font-semibold text-sm mb-2">
                  Photo 
                  {repositioningZoneId && <span className="text-teal-600 ml-2">— Dessinez la zone</span>}
                </h3>
                {photoUrl && (
                  <div 
                    ref={photoContainerRef}
                    className={`relative select-none ${repositioningZoneId ? 'cursor-crosshair' : ''}`}
                    onMouseDown={handlePhotoMouseDown}
                    onMouseMove={handlePhotoMouseMove}
                    onMouseUp={handlePhotoMouseUp}
                    onMouseLeave={handlePhotoMouseUp}
                  >
                    <img src={photoUrl} alt="Compteur" className="w-full rounded-lg" draggable={false} />
                    
                    {/* Zone overlays */}
                    {zones.map((zone) => zone.position && (
                      <div
                        key={zone.id}
                        className={`absolute border-2 rounded transition-all ${
                          selectedZoneId === zone.id ? 'ring-2 ring-white shadow-lg' : ''
                        }`}
                        style={{
                          left: `${zone.position.x * 100}%`,
                          top: `${zone.position.y * 100}%`,
                          width: `${zone.position.w * 100}%`,
                          height: `${zone.position.h * 100}%`,
                          borderColor: ZONE_COLORS[zone.fieldType] || '#6B7280',
                          backgroundColor: `${ZONE_COLORS[zone.fieldType] || '#6B7280'}30`
                        }}
                        onClick={() => setSelectedZoneId(zone.id)}
                      >
                        <span 
                          className="absolute -top-5 left-0 px-1 text-xs text-white rounded whitespace-nowrap"
                          style={{ backgroundColor: ZONE_COLORS[zone.fieldType] || '#6B7280' }}
                        >
                          {zone.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Zones config - 3/5 */}
              <Card className="md:col-span-3 p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Zones ({zones.length})</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setZones(zones.map(z => ({ ...z, isValidated: true })))}
                  >
                    <Check className="h-3 w-3 mr-1" /> Tout valider
                  </Button>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`p-2.5 border rounded-lg ${
                        zone.isValidated ? 'bg-green-50 border-green-200' : 'bg-white'
                      } ${selectedZoneId === zone.id ? 'ring-2 ring-teal-500' : ''}`}
                      style={{ borderLeftWidth: 3, borderLeftColor: ZONE_COLORS[zone.fieldType] || '#6B7280' }}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{METER_FIELD_CONFIG[zone.fieldType]?.icon}</span>
                          <span className="font-medium text-sm">{zone.label}</span>
                          {zone.isValidated && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeZone(zone.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Value input */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <Input
                          value={zone.extractedValue}
                          onChange={(e) => updateZone(zone.id, { extractedValue: e.target.value })}
                          className="h-8 text-sm font-mono flex-1"
                          placeholder="Valeur..."
                        />
                        <Button
                          size="sm"
                          variant={zone.isValidated ? 'secondary' : 'default'}
                          onClick={() => validateZone(zone)}
                          disabled={zone.isValidated}
                          className="h-8"
                        >
                          {zone.isValidated ? '✓' : 'OK'}
                        </Button>
                      </div>

                      {/* Position controls */}
                      <div className="flex items-center gap-2 text-xs">
                        {zone.position ? (
                          <>
                            <Badge variant="outline" className="text-xs">Position définie</Badge>
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => startRepositioning(zone.id)}>
                              <Move className="h-3 w-3 mr-1" /> Repositionner
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-red-500" onClick={() => removeZonePosition(zone.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => startRepositioning(zone.id)}>
                            <Move className="h-3 w-3 mr-1" /> Positionner sur photo
                          </Button>
                        )}

                        {METER_FIELD_CONFIG[zone.fieldType]?.isReading && (
                          <div className="flex items-center gap-1 ml-auto">
                            <Switch
                              checked={zone.hasDecimals}
                              onCheckedChange={(v) => updateZone(zone.id, { hasDecimals: v })}
                              className="scale-75"
                            />
                            <span className="text-gray-500">Déc.</span>
                            {zone.hasDecimals && (
                              <Input
                                type="number"
                                min={1}
                                max={5}
                                value={zone.decimalDigits}
                                onChange={(e) => updateZone(zone.id, { decimalDigits: parseInt(e.target.value) || 3 })}
                                className="h-6 w-10 text-xs"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add zone */}
                <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t">
                  {Object.entries(METER_FIELD_CONFIG).slice(0, 5).map(([type, config]) => (
                    <Button key={type} variant="outline" size="sm" onClick={() => addZone(type as MeterFieldType)} className="text-xs h-7">
                      <Plus className="h-3 w-3 mr-1" />{config.icon}
                    </Button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* STEP 4: Tests */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <Card className="p-4">
                <h2 className="font-semibold mb-1">Tests de reconnaissance</h2>
                <p className="text-gray-500 text-sm mb-4">Vous validez manuellement chaque test.</p>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Upload */}
                  <div>
                    {testPhotoUrl ? (
                      <div className="relative">
                        <img src={testPhotoUrl} alt="Test" className="w-full max-h-56 object-contain rounded-lg border" />
                        <button onClick={resetTestPhoto} className="absolute top-2 right-2 p-1 bg-gray-800 text-white rounded-full">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg cursor-pointer hover:border-teal-500">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500">Photo de test</span>
                        <input type="file" accept="image/*" onChange={handleTestPhotoUpload} className="hidden" />
                      </label>
                    )}
                    {testPhotoUrl && !currentTestResult && (
                      <Button onClick={runTest} disabled={testing} className="w-full mt-3 gap-2">
                        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Lancer le test
                      </Button>
                    )}
                  </div>

                  {/* Result */}
                  <div>
                    {currentTestResult && (
                      <div className={`p-4 rounded-lg ${currentTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {currentTestResult.success ? <CheckCircle className="h-5 w-5 text-green-600" /> : <X className="h-5 w-5 text-red-600" />}
                          <span className={`font-medium ${currentTestResult.success ? 'text-green-700' : 'text-red-700'}`}>
                            {currentTestResult.success ? 'Reconnu' : 'Non reconnu'}
                          </span>
                          <Badge variant="outline">{Math.round(currentTestResult.confidence * 100)}%</Badge>
                        </div>
                        {currentTestResult.extractedSerial && <p className="text-sm">N°: <span className="font-mono">{currentTestResult.extractedSerial}</span></p>}
                        {currentTestResult.extractedReading && <p className="text-sm">Index: <span className="font-mono">{currentTestResult.extractedReading}</span></p>}
                        <div className="flex gap-2 mt-3">
                          <Button onClick={validateTest} className="flex-1 gap-1"><Check className="h-4 w-4" /> Valider</Button>
                          <Button onClick={rejectTest} variant="outline" className="flex-1 gap-1"><X className="h-4 w-4" /> Rejeter</Button>
                        </div>
                      </div>
                    )}
                    {!testPhotoUrl && <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Tests optionnels</div>}
                  </div>
                </div>
              </Card>

              {/* History */}
              {testHistory.length > 0 && (
                <Card className="p-3">
                  <h3 className="font-semibold text-sm mb-2">Historique ({testHistory.length})</h3>
                  <div className="space-y-1">
                    {testHistory.map((t, i) => (
                      <div key={t.id} className={`flex items-center justify-between p-2 rounded text-sm ${t.isValidated ? 'bg-green-50' : 'bg-red-50'}`}>
                        <div className="flex items-center gap-2">
                          {t.isValidated ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}
                          <span>Test #{testHistory.length - i}</span>
                        </div>
                        <Badge variant="outline">{Math.round(t.confidence * 100)}%</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Summary */}
              <Card className="p-3">
                <h3 className="font-semibold text-sm mb-2">Récapitulatif</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-gray-500">Nom:</span> {name}</div>
                  <div><span className="text-gray-500">Fabricant:</span> {manufacturer || '-'}</div>
                  <div><span className="text-gray-500">Type:</span> {METER_TYPE_CONFIG[meterType].icon} {METER_TYPE_CONFIG[meterType].label}</div>
                  <div><span className="text-gray-500">Zones:</span> {zones.filter(z => z.isValidated).length}/{zones.length}</div>
                  <div><span className="text-gray-500">Tests validés:</span> {testHistory.filter(t => t.isValidated).length}</div>
                </div>
              </Card>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 1}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
            {currentStep < 4 ? (
              <Button onClick={() => goToStep(currentStep + 1)} disabled={!canProceed(currentStep)}>
                Suivant <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving || !name.trim() || zones.length === 0}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Enregistrer
              </Button>
            )}
          </div>
        </>
      )}
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
