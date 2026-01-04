'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  MeterType,
  MeterFieldType,
  MeterZone,
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
import { ArrowLeft, ArrowRight, Loader2, Save, CheckCircle, Upload, Sparkles, X, Trash2, Plus, Play, Check, RotateCcw, Edit2 } from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface ExtendedZone extends MeterZone {
  extractedValue?: string
  isValidated?: boolean
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
  { id: 1, label: 'Photo & Analyse', description: 'Upload + IA' },
  { id: 2, label: 'Informations', description: 'Validation' },
  { id: 3, label: 'Zones', description: 'Vérification' },
  { id: 4, label: 'Tests', description: 'Validation finale' },
]

const ZONE_COLORS: Record<MeterFieldType, string> = {
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
  
  const fromUnrecognized = searchParams.get('fromUnrecognized')
  const prefilledPhoto = searchParams.get('photo')
  const prefilledType = searchParams.get('type') as MeterType | null

  const [currentStep, setCurrentStep] = useState(1)

  // Step 1: Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(prefilledPhoto || null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)

  // Step 2: Info
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [meterType, setMeterType] = useState<MeterType>(prefilledType || 'water_general')
  const [unit, setUnit] = useState(prefilledType ? METER_TYPE_CONFIG[prefilledType]?.unit || 'm³' : 'm³')
  const [displayType, setDisplayType] = useState<string>('mechanical_rolls')
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [aiDescription, setAiDescription] = useState('')

  // Step 3: Zones with extracted values
  const [zones, setZones] = useState<ExtendedZone[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)

  // Step 4: Tests
  const [testPhotoFile, setTestPhotoFile] = useState<File | null>(null)
  const [testPhotoUrl, setTestPhotoUrl] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [currentTestResult, setCurrentTestResult] = useState<TestResult | null>(null)
  const [testHistory, setTestHistory] = useState<TestResult[]>([])

  // Save state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // ============================================
  // STEP 1: Photo & Analysis
  // ============================================
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl)
    setPhotoFile(file)
    setPhotoUrl(URL.createObjectURL(file))
    setAnalysisComplete(false)
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
    setAiDescription('')
  }

  const analyzePhoto = async () => {
    if (!photoFile) return
    setAnalyzing(true)
    setError(null)

    try {
      const base64 = await fileToBase64(photoFile)
      const response = await fetch('/api/analyze-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: [base64], extractKeywords: true, extractValues: true })
      })

      if (!response.ok) throw new Error('Erreur analyse')
      const result = await response.json()

      // Fill info
      if (result.name) setName(result.name)
      if (result.manufacturer) setManufacturer(result.manufacturer)
      if (result.meterType && METER_TYPE_CONFIG[result.meterType as MeterType]) {
        setMeterType(result.meterType as MeterType)
        setUnit(METER_TYPE_CONFIG[result.meterType as MeterType].unit)
      }
      if (result.description) setAiDescription(result.description)

      // Keywords with selection
      if (result.keywords) {
        const validKeywords = ['Itron', 'G4', 'RF1', 'M15', 'CE', 'EN', 'Klasse', 'Qmax', 'Qmin', 'bar', 'm³', 'kWh']
        setKeywords(result.keywords.map((kw: string) => ({
          value: kw,
          selected: validKeywords.some(v => kw.toUpperCase().includes(v.toUpperCase())) || 
                   kw.length <= 10 // Short keywords are usually relevant
        })))
      }

      // Zones with extracted values
      if (result.suggestedZones && result.suggestedZones.length > 0) {
        setZones(result.suggestedZones.map((z: any) => ({
          id: crypto.randomUUID(),
          fieldType: z.fieldType as MeterFieldType,
          label: z.label || METER_FIELD_CONFIG[z.fieldType as MeterFieldType]?.label || '',
          hasDecimals: z.hasDecimals || false,
          decimalDigits: z.decimalDigits || 3,
          position: z.position,
          extractedValue: z.extractedValue || '',
          isValidated: false
        })))
      } else {
        // Default zones
        setZones([
          { id: crypto.randomUUID(), fieldType: 'serialNumber', label: 'Numéro de série', hasDecimals: false, extractedValue: result.serialNumber || '', isValidated: false },
          { id: crypto.randomUUID(), fieldType: 'readingSingle', label: 'Index', hasDecimals: true, decimalDigits: 3, extractedValue: result.reading || '', isValidated: false }
        ])
      }

      setAnalysisComplete(true)
    } catch (err) {
      console.error('Analysis error:', err)
      setError('Erreur lors de l\'analyse. Réessayez.')
    } finally {
      setAnalyzing(false)
    }
  }

  // ============================================
  // STEP 2: Keywords
  // ============================================
  const toggleKeyword = (index: number) => {
    setKeywords(keywords.map((kw, i) => i === index ? { ...kw, selected: !kw.selected } : kw))
  }

  const selectAllKeywords = (selected: boolean) => {
    setKeywords(keywords.map(kw => ({ ...kw, selected })))
  }

  // ============================================
  // STEP 3: Zones
  // ============================================
  const addZone = (fieldType: MeterFieldType) => {
    setZones([...zones, {
      id: crypto.randomUUID(),
      fieldType,
      label: METER_FIELD_CONFIG[fieldType].label,
      hasDecimals: METER_FIELD_CONFIG[fieldType].isReading,
      decimalDigits: 3,
      extractedValue: '',
      isValidated: false
    }])
  }

  const removeZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id))
    if (selectedZoneId === id) setSelectedZoneId(null)
    if (editingZoneId === id) setEditingZoneId(null)
  }

  const updateZone = (id: string, updates: Partial<ExtendedZone>) => {
    setZones(zones.map(z => z.id === id ? { ...z, ...updates } : z))
  }

  const validateZone = (id: string) => {
    updateZone(id, { isValidated: true })
  }

  const validateAllZones = () => {
    setZones(zones.map(z => ({ ...z, isValidated: true })))
  }

  // ============================================
  // STEP 4: Tests
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
            zones, description: aiDescription
          }
        })
      })

      if (!response.ok) throw new Error('Erreur test')
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
      console.error('Test error:', err)
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

  const validateCurrentTest = () => {
    if (!currentTestResult) return
    const validated = { ...currentTestResult, isValidated: true }
    setTestHistory([validated, ...testHistory])
    resetTestPhoto()
  }

  const rejectCurrentTest = () => {
    if (!currentTestResult) return
    const rejected = { ...currentTestResult, isValidated: false, success: false }
    setTestHistory([rejected, ...testHistory])
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
      setError('Complétez tous les champs requis')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let uploadedPhotoUrl = photoUrl
      if (photoFile) {
        const formData = new FormData()
        formData.append('file', photoFile)
        const uploadResponse = await fetch('/api/upload-meter-photo', { method: 'POST', body: formData })
        if (!uploadResponse.ok) throw new Error('Erreur upload')
        const { url } = await uploadResponse.json()
        uploadedPhotoUrl = url
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
          ai_description: aiDescription,
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
          test_success_rate: validatedTests.length > 0 ? validatedTests.length / testHistory.length : 0,
          from_unrecognized_id: fromUnrecognized || null
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
      case 4: return true
      default: return false
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/meters">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nouveau modèle</h1>
          <p className="text-gray-500 text-sm">{fromUnrecognized ? 'Depuis compteur non reconnu' : 'Création manuelle'}</p>
        </div>
      </div>

      {/* Steps */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => goToStep(step.id)}
                className={`flex items-center gap-2 ${
                  step.id === currentStep ? 'text-teal-600' :
                  step.id < currentStep ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.id === currentStep ? 'bg-teal-600 text-white' :
                  step.id < currentStep ? 'bg-green-600 text-white' : 'bg-gray-200'
                }`}>
                  {step.id < currentStep ? <CheckCircle className="h-5 w-5" /> : step.id}
                </div>
                <div className="hidden md:block text-sm">
                  <div className="font-medium">{step.label}</div>
                </div>
              </button>
              {index < STEPS.length - 1 && <div className={`w-8 md:w-16 h-0.5 mx-2 ${step.id < currentStep ? 'bg-green-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {error && <Card className="p-3 mb-4 bg-red-50 border-red-200 text-red-700 text-sm">{error}</Card>}
      
      {saved && (
        <Card className="p-6 mb-4 bg-green-50 border-green-200 text-center">
          <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-2" />
          <p className="text-green-700 font-medium">Modèle créé !</p>
        </Card>
      )}

      {!saved && (
        <>
          {/* STEP 1 */}
          {currentStep === 1 && (
            <Card className="p-6">
              <h2 className="font-semibold mb-2">Photo de référence</h2>
              <p className="text-gray-500 text-sm mb-4">L'IA analysera et pré-remplira les informations.</p>

              {photoUrl ? (
                <div className="space-y-4">
                  <div className="relative max-w-sm mx-auto">
                    <img src={photoUrl} alt="Compteur" className="w-full rounded-lg border" />
                    <button onClick={removePhoto} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"><X className="h-4 w-4" /></button>
                  </div>
                  {!analysisComplete ? (
                    <div className="text-center">
                      <Button onClick={analyzePhoto} disabled={analyzing} className="gap-2">
                        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {analyzing ? 'Analyse...' : 'Analyser'}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
                      <p className="text-green-700 text-sm font-medium">Analyse terminée</p>
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

          {/* STEP 2 */}
          {currentStep === 2 && (
            <Card className="p-6 space-y-4">
              <h2 className="font-semibold">Informations</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Nom *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: G4 RF1" className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Fabricant</Label>
                  <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="ex: Itron" className="mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-sm">Type *</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {Object.entries(METER_TYPE_CONFIG).slice(0, 4).map(([type, config]) => (
                    <button
                      key={type}
                      onClick={() => { setMeterType(type as MeterType); setUnit(config.unit) }}
                      className={`p-2 rounded-lg border text-center text-sm ${meterType === type ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`}
                    >
                      <div className="text-xl">{config.icon}</div>
                      <div className="text-xs">{config.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Unité</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Affichage</Label>
                  <Select value={displayType} onValueChange={setDisplayType}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mechanical_rolls">Rouleaux</SelectItem>
                      <SelectItem value="digital_lcd">LCD</SelectItem>
                      <SelectItem value="dials">Cadrans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Keywords with checkboxes */}
              {keywords.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Mots-clés (sélectionnez les pertinents)</Label>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => selectAllKeywords(true)}>Tout</Button>
                      <Button variant="ghost" size="sm" onClick={() => selectAllKeywords(false)}>Aucun</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                    {keywords.map((kw, i) => (
                      <Badge
                        key={i}
                        variant={kw.selected ? 'default' : 'outline'}
                        className={`cursor-pointer text-xs ${kw.selected ? 'bg-teal-600' : 'bg-white text-gray-500'}`}
                        onClick={() => toggleKeyword(i)}
                      >
                        {kw.selected && <Check className="h-3 w-3 mr-1" />}
                        {kw.value}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{keywords.filter(k => k.selected).length} sélectionnés</p>
                </div>
              )}
            </Card>
          )}

          {/* STEP 3 - Zones with smaller photo */}
          {currentStep === 3 && (
            <div className="grid md:grid-cols-5 gap-4">
              {/* Photo - 2/5 width */}
              <Card className="md:col-span-2 p-4">
                <h3 className="font-semibold text-sm mb-2">Photo</h3>
                {photoUrl && (
                  <div className="relative">
                    <img src={photoUrl} alt="Compteur" className="w-full rounded-lg" />
                    {zones.map((zone) => zone.position && (
                      <div
                        key={zone.id}
                        className={`absolute border-2 rounded cursor-pointer transition-all ${selectedZoneId === zone.id ? 'ring-2 ring-white' : ''}`}
                        style={{
                          left: `${zone.position.x * 100}%`,
                          top: `${zone.position.y * 100}%`,
                          width: `${zone.position.width * 100}%`,
                          height: `${zone.position.height * 100}%`,
                          borderColor: ZONE_COLORS[zone.fieldType],
                          backgroundColor: `${ZONE_COLORS[zone.fieldType]}30`
                        }}
                        onClick={() => setSelectedZoneId(zone.id)}
                      />
                    ))}
                  </div>
                )}
              </Card>

              {/* Zones - 3/5 width */}
              <Card className="md:col-span-3 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Zones détectées ({zones.length})</h3>
                  <Button variant="outline" size="sm" onClick={validateAllZones}>
                    <Check className="h-3 w-3 mr-1" /> Tout valider
                  </Button>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`p-3 border rounded-lg ${zone.isValidated ? 'bg-green-50 border-green-200' : 'bg-white'} ${selectedZoneId === zone.id ? 'ring-2 ring-teal-500' : ''}`}
                      style={{ borderLeftWidth: 4, borderLeftColor: ZONE_COLORS[zone.fieldType] }}
                      onClick={() => setSelectedZoneId(zone.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span>{METER_FIELD_CONFIG[zone.fieldType].icon}</span>
                          <span className="font-medium text-sm">{zone.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {zone.isValidated && <CheckCircle className="h-4 w-4 text-green-600" />}
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeZone(zone.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Extracted value */}
                      <div className="flex items-center gap-2">
                        {editingZoneId === zone.id ? (
                          <Input
                            value={zone.extractedValue || ''}
                            onChange={(e) => updateZone(zone.id, { extractedValue: e.target.value })}
                            onBlur={() => setEditingZoneId(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingZoneId(null)}
                            autoFocus
                            className="h-8 text-sm font-mono"
                          />
                        ) : (
                          <div
                            className="flex-1 p-2 bg-gray-100 rounded text-sm font-mono cursor-pointer hover:bg-gray-200"
                            onClick={() => setEditingZoneId(zone.id)}
                          >
                            {zone.extractedValue || <span className="text-gray-400 italic">Cliquez pour ajouter</span>}
                          </div>
                        )}
                        <Button
                          variant={zone.isValidated ? 'secondary' : 'default'}
                          size="sm"
                          onClick={() => validateZone(zone.id)}
                          disabled={zone.isValidated}
                        >
                          {zone.isValidated ? '✓' : 'Valider'}
                        </Button>
                      </div>

                      {/* Decimals toggle for readings */}
                      {METER_FIELD_CONFIG[zone.fieldType].isReading && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Switch
                            checked={zone.hasDecimals}
                            onCheckedChange={(v) => updateZone(zone.id, { hasDecimals: v })}
                            className="scale-75"
                          />
                          <span>Décimales</span>
                          {zone.hasDecimals && (
                            <Input
                              type="number"
                              min={1}
                              max={5}
                              value={zone.decimalDigits || 3}
                              onChange={(e) => updateZone(zone.id, { decimalDigits: parseInt(e.target.value) })}
                              className="h-6 w-12 text-xs"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add zone */}
                <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t">
                  {Object.entries(METER_FIELD_CONFIG).slice(0, 6).map(([type, config]) => (
                    <Button key={type} variant="outline" size="sm" onClick={() => addZone(type as MeterFieldType)} className="text-xs">
                      <Plus className="h-3 w-3 mr-1" />{config.icon}
                    </Button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* STEP 4 - Tests */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <Card className="p-6">
                <h2 className="font-semibold mb-2">Test de reconnaissance</h2>
                <p className="text-gray-500 text-sm mb-4">Testez avec d'autres photos du même modèle. Vous validez manuellement chaque test.</p>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Upload test */}
                  <div>
                    {testPhotoUrl ? (
                      <div className="relative">
                        <img src={testPhotoUrl} alt="Test" className="w-full max-h-64 object-contain rounded-lg border" />
                        <button onClick={resetTestPhoto} className="absolute top-2 right-2 p-1 bg-gray-800 text-white rounded-full">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg cursor-pointer hover:border-teal-500">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500">Nouvelle photo de test</span>
                        <input type="file" accept="image/*" onChange={handleTestPhotoUpload} className="hidden" />
                      </label>
                    )}

                    {testPhotoUrl && !currentTestResult && (
                      <Button onClick={runTest} disabled={testing} className="w-full mt-3 gap-2">
                        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {testing ? 'Test...' : 'Lancer le test'}
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

                        {currentTestResult.extractedSerial && (
                          <p className="text-sm">N° série: <span className="font-mono">{currentTestResult.extractedSerial}</span></p>
                        )}
                        {currentTestResult.extractedReading && (
                          <p className="text-sm">Index: <span className="font-mono">{currentTestResult.extractedReading}</span></p>
                        )}

                        <div className="flex gap-2 mt-3">
                          <Button onClick={validateCurrentTest} className="flex-1 gap-1" variant="default">
                            <Check className="h-4 w-4" /> Valider
                          </Button>
                          <Button onClick={rejectCurrentTest} className="flex-1 gap-1" variant="outline">
                            <X className="h-4 w-4" /> Rejeter
                          </Button>
                        </div>
                      </div>
                    )}

                    {!testPhotoUrl && !currentTestResult && (
                      <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                        Tests optionnels mais recommandés
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Test history */}
              {testHistory.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-3">Historique ({testHistory.length} tests)</h3>
                  <div className="space-y-2">
                    {testHistory.map((test, i) => (
                      <div key={test.id} className={`flex items-center justify-between p-2 rounded ${test.isValidated ? 'bg-green-50' : 'bg-red-50'}`}>
                        <div className="flex items-center gap-2">
                          {test.isValidated ? <CheckCircle className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}
                          <span className="text-sm">Test #{testHistory.length - i}</span>
                          <span className="text-xs text-gray-500">{test.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{Math.round(test.confidence * 100)}%</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Summary */}
              <Card className="p-4">
                <h3 className="font-semibold text-sm mb-3">Récapitulatif</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-gray-500">Nom:</span> <span className="font-medium">{name}</span></div>
                  <div><span className="text-gray-500">Fabricant:</span> <span className="font-medium">{manufacturer || '-'}</span></div>
                  <div><span className="text-gray-500">Type:</span> <span className="font-medium">{METER_TYPE_CONFIG[meterType].icon} {METER_TYPE_CONFIG[meterType].label}</span></div>
                  <div><span className="text-gray-500">Zones:</span> <span className="font-medium">{zones.filter(z => z.isValidated).length}/{zones.length} validées</span></div>
                  <div><span className="text-gray-500">Tests:</span> <span className="font-medium">{testHistory.filter(t => t.isValidated).length} validés</span></div>
                </div>
              </Card>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 1}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour
            </Button>

            {currentStep < 4 ? (
              <Button onClick={() => goToStep(currentStep + 1)} disabled={!canProceed(currentStep)}>
                Suivant <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving || !name.trim() || zones.length === 0}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? 'Enregistrement...' : 'Enregistrer'}
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
