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
import { ArrowLeft, ArrowRight, Loader2, Save, CheckCircle, Upload, Sparkles, X, Trash2, Plus, Play, Check, RotateCcw } from 'lucide-react'

// ============================================
// STEP CONFIGURATION - Nouveau flux
// ============================================
const STEPS = [
  { id: 1, label: 'Photo & Analyse', description: 'Upload + IA' },
  { id: 2, label: 'Informations', description: 'Validation' },
  { id: 3, label: 'Zones', description: 'Configuration' },
  { id: 4, label: 'Test & Enregistrer', description: 'Validation finale' },
]

// Zone colors
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

  // Step 1: Photo & Analysis
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(prefilledPhoto || null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)

  // Step 2: Basic info (pre-filled by AI)
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [meterType, setMeterType] = useState<MeterType>(prefilledType || 'water_general')
  const [unit, setUnit] = useState(prefilledType ? METER_TYPE_CONFIG[prefilledType]?.unit || 'm³' : 'm³')
  const [displayType, setDisplayType] = useState<string>('mechanical_rolls')
  const [primaryColor, setPrimaryColor] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [aiDescription, setAiDescription] = useState('')

  // Step 3: Zones (pre-filled by AI)
  const [zones, setZones] = useState<MeterZone[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)

  // Step 4: Test
  const [testPhotoFile, setTestPhotoFile] = useState<File | null>(null)
  const [testPhotoUrl, setTestPhotoUrl] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [testValidated, setTestValidated] = useState(false)

  // Saving state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // ============================================
  // STEP 1: Photo Upload & Analysis
  // ============================================
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (photoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(photoUrl)
    }
    
    setPhotoFile(file)
    setPhotoUrl(URL.createObjectURL(file))
    setAnalysisComplete(false)
  }

  const removePhoto = () => {
    if (photoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(photoUrl)
    }
    setPhotoFile(null)
    setPhotoUrl(null)
    setAnalysisComplete(false)
    setName('')
    setManufacturer('')
    setKeywords([])
    setZones([])
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
        body: JSON.stringify({ photos: [base64], extractKeywords: true })
      })

      if (!response.ok) throw new Error('Erreur analyse')

      const result = await response.json()

      // Pre-fill all fields
      if (result.name) setName(result.name)
      if (result.manufacturer) setManufacturer(result.manufacturer)
      if (result.meterType && METER_TYPE_CONFIG[result.meterType as MeterType]) {
        setMeterType(result.meterType as MeterType)
        setUnit(METER_TYPE_CONFIG[result.meterType as MeterType].unit)
      }
      if (result.keywords) setKeywords(result.keywords)
      if (result.description) setAiDescription(result.description)
      
      // Pre-fill zones
      if (result.suggestedZones && result.suggestedZones.length > 0) {
        setZones(result.suggestedZones.map((z: any) => ({
          id: crypto.randomUUID(),
          fieldType: z.fieldType as MeterFieldType,
          label: z.label || METER_FIELD_CONFIG[z.fieldType as MeterFieldType]?.label || '',
          hasDecimals: z.hasDecimals || false,
          decimalDigits: z.decimalDigits || 2,
          position: z.position
        })))
      } else {
        // Default zones if AI didn't suggest any
        setZones([
          { id: crypto.randomUUID(), fieldType: 'serialNumber', label: 'Numéro de série', hasDecimals: false },
          { id: crypto.randomUUID(), fieldType: 'readingSingle', label: 'Index', hasDecimals: true, decimalDigits: 3 }
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
  // STEP 3: Zone Management
  // ============================================
  const addZone = (fieldType: MeterFieldType) => {
    setZones([...zones, {
      id: crypto.randomUUID(),
      fieldType,
      label: METER_FIELD_CONFIG[fieldType].label,
      hasDecimals: METER_FIELD_CONFIG[fieldType].isReading,
      decimalDigits: 2
    }])
  }

  const removeZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id))
    if (selectedZoneId === id) setSelectedZoneId(null)
  }

  const updateZone = (id: string, updates: Partial<MeterZone>) => {
    setZones(zones.map(z => {
      if (z.id !== id) return z
      if (updates.fieldType && updates.fieldType !== z.fieldType) {
        return { ...z, ...updates, label: METER_FIELD_CONFIG[updates.fieldType].label }
      }
      return { ...z, ...updates }
    }))
  }

  // ============================================
  // STEP 4: Test
  // ============================================
  const handleTestPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (testPhotoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(testPhotoUrl)
    }
    
    setTestPhotoFile(file)
    setTestPhotoUrl(URL.createObjectURL(file))
    setTestResult(null)
    setTestValidated(false)
  }

  const runTest = async () => {
    if (!testPhotoFile) return

    setTesting(true)
    setTestResult(null)

    try {
      const base64 = await fileToBase64(testPhotoFile)

      const response = await fetch('/api/test-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testPhoto: base64,
          modelData: { name, manufacturer, meterType, unit, keywords, zones, description: aiDescription }
        })
      })

      if (!response.ok) throw new Error('Erreur test')

      const result = await response.json()
      setTestResult(result)
      
      if (result.success && result.confidence >= 0.7) {
        setTestValidated(true)
      }

    } catch (err) {
      console.error('Test error:', err)
      setTestResult({ success: false, error: 'Erreur lors du test' })
    } finally {
      setTesting(false)
    }
  }

  const resetTest = () => {
    if (testPhotoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(testPhotoUrl)
    }
    setTestPhotoFile(null)
    setTestPhotoUrl(null)
    setTestResult(null)
    setTestValidated(false)
  }

  // ============================================
  // SAVE
  // ============================================
  const handleSave = async () => {
    if (!name.trim() || !photoUrl || zones.length === 0) {
      setError('Veuillez compléter tous les champs requis')
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
        
        const uploadResponse = await fetch('/api/upload-meter-photo', {
          method: 'POST',
          body: formData
        })
        
        if (!uploadResponse.ok) throw new Error('Erreur upload photo')
        const { url } = await uploadResponse.json()
        uploadedPhotoUrl = url
      }

      // Create model
      const response = await fetch('/api/meter-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          manufacturer,
          meter_type: meterType,
          unit,
          display_type: displayType,
          primary_color: primaryColor,
          ai_description: aiDescription,
          keywords,
          reference_photos: [uploadedPhotoUrl],
          zones: zones.map(z => ({
            id: z.id,
            field_type: z.fieldType,
            label: z.label,
            has_decimals: z.hasDecimals,
            decimal_digits: z.decimalDigits,
            position: z.position
          })),
          is_active: true,
          is_verified: testValidated,
          test_success_rate: testValidated ? 1 : 0,
          from_unrecognized_id: fromUnrecognized || null
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur création')
      }

      setSaved(true)
      setTimeout(() => router.push('/dashboard/meters'), 1500)

    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'Erreur lors de l\'enregistrement')
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
          <h1 className="text-2xl font-bold">Nouveau modèle de compteur</h1>
          <p className="text-gray-500">{fromUnrecognized ? 'Depuis compteur non reconnu' : 'Création manuelle'}</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => goToStep(step.id)}
                disabled={step.id > currentStep && !canProceed(currentStep)}
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
                <div className="hidden sm:block">
                  <div className="font-medium text-sm">{step.label}</div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
              </button>
              {index < STEPS.length - 1 && (
                <div className={`w-12 md:w-20 h-0.5 mx-2 ${step.id < currentStep ? 'bg-green-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {/* Success */}
      {saved && (
        <Card className="p-6 mb-6 bg-green-50 border-green-200 text-center">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
          <p className="text-green-700 font-medium">Modèle créé avec succès !</p>
        </Card>
      )}

      {!saved && (
        <>
          {/* ============================================ */}
          {/* STEP 1: Photo & Analyse */}
          {/* ============================================ */}
          {currentStep === 1 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Photo de référence</h2>
              <p className="text-gray-500 mb-6">Uploadez une photo du compteur. L'IA analysera et pré-remplira les informations.</p>

              {photoUrl ? (
                <div className="space-y-4">
                  <div className="relative max-w-md mx-auto">
                    <img src={photoUrl} alt="Compteur" className="w-full rounded-lg border" />
                    <button
                      onClick={removePhoto}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {!analysisComplete ? (
                    <div className="text-center">
                      <Button onClick={analyzePhoto} disabled={analyzing} size="lg" className="gap-2">
                        {analyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                        {analyzing ? 'Analyse en cours...' : 'Analyser avec l\'IA'}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-green-700 font-medium">Analyse terminée !</p>
                      <p className="text-green-600 text-sm">Les informations ont été pré-remplies. Cliquez sur Suivant pour vérifier.</p>
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors">
                  <Upload className="h-12 w-12 text-gray-400 mb-3" />
                  <span className="text-gray-600 font-medium">Cliquez pour ajouter une photo</span>
                  <span className="text-gray-400 text-sm mt-1">Photo frontale, bonne lumière</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              )}
            </Card>
          )}

          {/* ============================================ */}
          {/* STEP 2: Informations */}
          {/* ============================================ */}
          {currentStep === 2 && (
            <Card className="p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Informations générales</h2>
                <p className="text-gray-500">Vérifiez et modifiez les informations détectées par l'IA.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom commercial *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Itron G4 RF1" />
                </div>
                <div className="space-y-2">
                  <Label>Fabricant</Label>
                  <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="ex: Itron" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Type d'énergie *</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(METER_TYPE_CONFIG).map(([type, config]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setMeterType(type as MeterType); setUnit(config.unit) }}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        meterType === type ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{config.icon}</div>
                      <div className="font-medium text-sm">{config.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unité</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Type d'affichage</Label>
                  <Select value={displayType} onValueChange={setDisplayType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mechanical_rolls">Rouleaux mécaniques</SelectItem>
                      <SelectItem value="digital_lcd">Écran LCD</SelectItem>
                      <SelectItem value="dials">Cadrans</SelectItem>
                      <SelectItem value="mixed">Mixte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Keywords */}
              {keywords.length > 0 && (
                <div className="space-y-2">
                  <Label>Mots-clés détectés</Label>
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((kw, i) => (
                      <Badge key={i} variant="secondary">{kw}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ============================================ */}
          {/* STEP 3: Zones - Layout côte à côte */}
          {/* ============================================ */}
          {currentStep === 3 && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: Photo with zones */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Photo de référence</h3>
                {photoUrl && (
                  <div className="relative">
                    <img src={photoUrl} alt="Compteur" className="w-full rounded-lg" />
                    {zones.map((zone) => zone.position && (
                      <div
                        key={zone.id}
                        className={`absolute border-2 rounded cursor-pointer ${selectedZoneId === zone.id ? 'ring-2' : ''}`}
                        style={{
                          left: `${zone.position.x * 100}%`,
                          top: `${zone.position.y * 100}%`,
                          width: `${zone.position.width * 100}%`,
                          height: `${zone.position.height * 100}%`,
                          borderColor: ZONE_COLORS[zone.fieldType],
                          backgroundColor: `${ZONE_COLORS[zone.fieldType]}20`
                        }}
                        onClick={() => setSelectedZoneId(zone.id)}
                      >
                        <div
                          className="absolute -top-5 left-0 px-1 py-0.5 text-xs text-white rounded-t whitespace-nowrap"
                          style={{ backgroundColor: ZONE_COLORS[zone.fieldType] }}
                        >
                          {zone.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Right: Zone configuration */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Zones ({zones.length})</h3>
                </div>

                {/* Add zone buttons */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {Object.entries(METER_FIELD_CONFIG).slice(0, 5).map(([type, config]) => (
                    <Button key={type} variant="outline" size="sm" onClick={() => addZone(type as MeterFieldType)}>
                      <Plus className="h-3 w-3 mr-1" />{config.icon}
                    </Button>
                  ))}
                </div>

                {/* Zone list */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`p-3 border rounded-lg ${selectedZoneId === zone.id ? 'ring-2 ring-teal-500' : 'bg-gray-50'}`}
                      style={{ borderLeftWidth: 4, borderLeftColor: ZONE_COLORS[zone.fieldType] }}
                      onClick={() => setSelectedZoneId(zone.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Select value={zone.fieldType} onValueChange={(v) => updateZone(zone.id, { fieldType: v as MeterFieldType })}>
                          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(METER_FIELD_CONFIG).map(([t, c]) => (
                              <SelectItem key={t} value={t}>{c.icon} {c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => removeZone(zone.id)} className="h-8 w-8 text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        value={zone.label}
                        onChange={(e) => updateZone(zone.id, { label: e.target.value })}
                        className="h-8 text-sm mb-2"
                      />
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={zone.hasDecimals}
                          onCheckedChange={(v) => updateZone(zone.id, { hasDecimals: v })}
                        />
                        <span className="text-xs text-gray-500">Décimales</span>
                        {zone.hasDecimals && (
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={zone.decimalDigits || 2}
                            onChange={(e) => updateZone(zone.id, { decimalDigits: parseInt(e.target.value) })}
                            className="h-8 w-16"
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  {zones.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Ajoutez au moins une zone
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* ============================================ */}
          {/* STEP 4: Test & Save */}
          {/* ============================================ */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Test section */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-2">Test de reconnaissance</h2>
                <p className="text-gray-500 mb-4">Testez avec une autre photo du même modèle pour valider.</p>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Upload test photo */}
                  <div>
                    {testPhotoUrl ? (
                      <div className="relative">
                        <img src={testPhotoUrl} alt="Test" className="w-full rounded-lg border" />
                        <button onClick={resetTest} className="absolute top-2 right-2 p-1.5 bg-gray-800 text-white rounded-full">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">Photo de test</span>
                        <input type="file" accept="image/*" onChange={handleTestPhotoUpload} className="hidden" />
                      </label>
                    )}

                    {testPhotoUrl && !testResult && (
                      <Button onClick={runTest} disabled={testing} className="w-full mt-4 gap-2">
                        {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {testing ? 'Test...' : 'Lancer le test'}
                      </Button>
                    )}
                  </div>

                  {/* Test result */}
                  <div>
                    {testResult && (
                      <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {testResult.success ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <X className="h-5 w-5 text-red-600" />
                          )}
                          <span className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                            {testResult.success ? 'Reconnu !' : 'Non reconnu'}
                          </span>
                          <Badge variant="outline">{Math.round((testResult.confidence || 0) * 100)}%</Badge>
                        </div>

                        {testResult.extractedSerial && (
                          <div className="text-sm">N° série: <span className="font-mono">{testResult.extractedSerial}</span></div>
                        )}
                        {testResult.extractedReading && (
                          <div className="text-sm">Index: <span className="font-mono">{testResult.extractedReading}</span></div>
                        )}

                        {!testValidated && testResult.success && (
                          <Button onClick={() => setTestValidated(true)} className="mt-3 gap-2" variant="outline">
                            <Check className="h-4 w-4" /> Valider manuellement
                          </Button>
                        )}

                        {testValidated && (
                          <div className="mt-3 p-2 bg-green-100 rounded text-green-700 text-sm flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" /> Test validé
                          </div>
                        )}
                      </div>
                    )}

                    {!testPhotoUrl && (
                      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                        Le test est optionnel mais recommandé
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Summary */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Récapitulatif</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Nom</div>
                    <div className="font-medium">{name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Fabricant</div>
                    <div className="font-medium">{manufacturer || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Type</div>
                    <div className="font-medium">{METER_TYPE_CONFIG[meterType].icon} {METER_TYPE_CONFIG[meterType].label}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Zones</div>
                    <div className="font-medium">{zones.length} zone(s)</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Test</div>
                    <div className="font-medium">{testValidated ? '✓ Validé' : 'Non testé'}</div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 1} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>

            {currentStep < 4 ? (
              <Button onClick={() => goToStep(currentStep + 1)} disabled={!canProceed(currentStep)} className="gap-2">
                Suivant <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving || !name.trim() || zones.length === 0} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Helper
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(file)
  })
}
