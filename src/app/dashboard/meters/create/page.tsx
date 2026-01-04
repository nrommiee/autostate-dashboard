'use client'
import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { X, Upload, Sparkles, Plus, Trash2, ArrowLeft, Loader2, Check, ArrowRight, Play, Edit3 } from 'lucide-react'
import Link from 'next/link'

// Steps
const STEPS = [
  { id: 1, label: 'Photo & Infos' },
  { id: 2, label: 'Zones' },
  { id: 3, label: 'Tests & Validation' },
]

function createEmptyZone(fieldType: MeterFieldType = 'serialNumber'): MeterZone {
  return {
    id: crypto.randomUUID(),
    fieldType,
    label: METER_FIELD_CONFIG[fieldType].label,
    hasDecimals: false
  }
}

export default function CreateMeterModelPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const fromUnrecognized = searchParams.get('fromUnrecognized')
  const prefilledPhoto = searchParams.get('photo')
  const prefilledType = searchParams.get('type') as MeterType | null

  // Step state
  const [currentStep, setCurrentStep] = useState(1)

  // Form state
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [meterType, setMeterType] = useState<MeterType>(prefilledType || 'water_general')
  const [unit, setUnit] = useState(prefilledType ? METER_TYPE_CONFIG[prefilledType]?.unit || 'm³' : 'm³')
  const [aiDescription, setAiDescription] = useState('')
  const [zones, setZones] = useState<MeterZone[]>([createEmptyZone('serialNumber')])
  const [isVerified, setIsVerified] = useState(false)
  
  // Photos
  const [photos, setPhotos] = useState<File[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>(prefilledPhoto ? [prefilledPhoto] : [])
  
  // AI
  const [analyzing, setAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  
  // Test
  const [testPhoto, setTestPhoto] = useState<File | null>(null)
  const [testPhotoUrl, setTestPhotoUrl] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  
  // Save
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Photo handlers
  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setPhotos(prev => [...prev, ...files])
    files.forEach(file => {
      const url = URL.createObjectURL(file)
      setPhotoUrls(prev => [...prev, url])
    })
  }, [])

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoUrls(prev => {
      if (prev[index]?.startsWith('blob:')) URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
  }

  // AI Analysis
  const analyzeWithClaude = async () => {
    if (photoUrls.length === 0) {
      setError('Veuillez ajouter au moins une photo')
      return
    }
    setAnalyzing(true)
    setError(null)
    try {
      const photoBase64s = await Promise.all(
        photos.map(async (file) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve((reader.result as string).split(',')[1])
            reader.readAsDataURL(file)
          })
        })
      )

      const response = await fetch('/api/analyze-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: photoBase64s, existingType: meterType })
      })

      if (!response.ok) throw new Error('Erreur lors de l\'analyse')

      const result = await response.json()
      setAiAnalysis(result)
      
      if (result.name) setName(result.name)
      if (result.manufacturer) setManufacturer(result.manufacturer)
      if (result.meterType) {
        setMeterType(result.meterType)
        setUnit(METER_TYPE_CONFIG[result.meterType as MeterType]?.unit || 'm³')
      }
      if (result.description) setAiDescription(result.description)
      if (result.suggestedZones?.length > 0) {
        setZones(result.suggestedZones.map((z: any) => ({
          id: crypto.randomUUID(),
          fieldType: z.fieldType,
          label: z.label || METER_FIELD_CONFIG[z.fieldType as MeterFieldType]?.label,
          hasDecimals: z.hasDecimals || false,
          decimalDigits: z.decimalDigits,
          digitCount: z.digitCount
        })))
      }
    } catch (err) {
      setError('Erreur lors de l\'analyse Claude.')
    } finally {
      setAnalyzing(false)
    }
  }

  // Zone handlers
  const addZone = () => setZones(prev => [...prev, createEmptyZone('readingSingle')])
  const removeZone = (id: string) => setZones(prev => prev.filter(z => z.id !== id))
  const updateZone = (id: string, updates: Partial<MeterZone>) => {
    setZones(prev => prev.map(z => {
      if (z.id !== id) return z
      if (updates.fieldType && updates.fieldType !== z.fieldType) {
        return { ...z, ...updates, label: METER_FIELD_CONFIG[updates.fieldType].label }
      }
      return { ...z, ...updates }
    }))
  }

  // Test handlers
  const handleTestPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (testPhotoUrl?.startsWith('blob:')) URL.revokeObjectURL(testPhotoUrl)
    setTestPhoto(file)
    setTestPhotoUrl(URL.createObjectURL(file))
    setTestResult(null)
  }

  const runTest = async () => {
    if (!testPhoto) return
    setTesting(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1]
        const response = await fetch('/api/analyze-meter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photos: [base64], existingType: meterType })
        })
        const result = await response.json()
        setTestResult({
          success: true,
          serialNumber: result.serialNumber || result.suggestedZones?.find((z: any) => z.fieldType === 'serialNumber')?.extractedValue,
          reading: result.reading || result.suggestedZones?.find((z: any) => z.fieldType === 'readingSingle')?.extractedValue,
        })
        setTesting(false)
      }
      reader.readAsDataURL(testPhoto)
    } catch {
      setTestResult({ success: false })
      setTesting(false)
    }
  }

  const resetTest = () => {
    if (testPhotoUrl?.startsWith('blob:')) URL.revokeObjectURL(testPhotoUrl)
    setTestPhoto(null)
    setTestPhotoUrl(null)
    setTestResult(null)
  }

  // Save
  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom du modèle est requis'); return }
    if (zones.length === 0) { setError('Au moins une zone est requise'); return }
    if (photoUrls.length === 0) { setError('Au moins une photo est requise'); return }

    setSaving(true)
    setError(null)
    try {
      const uploadedUrls: string[] = []
      for (const file of photos) {
        const formData = new FormData()
        formData.append('file', file)
        const uploadResponse = await fetch('/api/upload-meter-photo', { method: 'POST', body: formData })
        if (!uploadResponse.ok) throw new Error('Erreur upload photo')
        const { url } = await uploadResponse.json()
        uploadedUrls.push(url)
      }

      const response = await fetch('/api/meter-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, manufacturer, meter_type: meterType, unit, ai_description: aiDescription,
          ai_analysis_data: aiAnalysis || {}, reference_photos: uploadedUrls, zones,
          is_verified: isVerified, is_active: true, from_unrecognized_id: fromUnrecognized
        })
      })
      if (!response.ok) throw new Error('Erreur lors de la création')
      router.push('/dashboard/meters')
    } catch {
      setError('Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  // Navigation
  const canProceed = (step: number): boolean => {
    if (step === 1) return photoUrls.length > 0 && name.trim() !== ''
    if (step === 2) return zones.length > 0
    return true
  }

  const goToStep = (step: number) => {
    if (step < 1 || step > 3) return
    if (step > currentStep && !canProceed(currentStep)) {
      if (currentStep === 1) setError('Ajoutez une photo et un nom.')
      if (currentStep === 2) setError('Ajoutez au moins une zone.')
      return
    }
    setError(null)
    setCurrentStep(step)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/meters">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nouveau modèle de compteur</h1>
          <p className="text-gray-500">Étape {currentStep} sur 3</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => goToStep(step.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                step.id === currentStep ? 'bg-teal-100 text-teal-700' :
                step.id < currentStep ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                step.id === currentStep ? 'bg-teal-600 text-white' :
                step.id < currentStep ? 'bg-green-600 text-white' : 'bg-gray-200'
              }`}>
                {step.id < currentStep ? '✓' : step.id}
              </span>
              <span className="hidden sm:inline font-medium">{step.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={`w-16 h-0.5 mx-2 ${step.id < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {/* STEP 1: Photo & Infos */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Photos de référence</h2>
                <p className="text-sm text-gray-500">Ajoutez des photos claires du compteur</p>
              </div>
              <Button onClick={analyzeWithClaude} disabled={analyzing || photoUrls.length === 0} className="gap-2">
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {analyzing ? 'Analyse...' : 'Analyser'}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photoUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img src={url} alt={`Photo ${index + 1}`} className="w-full h-32 object-cover rounded-lg border" />
                  <button onClick={() => removePhoto(index)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Ajouter</span>
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>
            {aiAnalysis && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-purple-900">Analyse terminée</span>
                </div>
                <p className="text-sm text-purple-700">Les champs ont été pré-remplis.</p>
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Informations générales</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du modèle *</Label>
                <Input id="name" placeholder="ex: Itron Aquadis+" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricant</Label>
                <Input id="manufacturer" placeholder="ex: Itron" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de compteur *</Label>
                <Select value={meterType} onValueChange={(v) => { setMeterType(v as MeterType); setUnit(METER_TYPE_CONFIG[v as MeterType]?.unit || 'm³') }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METER_TYPE_CONFIG).map(([type, config]) => (
                      <SelectItem key={type} value={type}>{config.icon} {config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unité</Label>
                <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* STEP 2: Zones */}
      {currentStep === 2 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Zones de lecture</h2>
              <p className="text-sm text-gray-500">Définissez les champs à extraire</p>
            </div>
            <Button variant="outline" onClick={addZone} className="gap-2">
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </div>
          <div className="space-y-3">
            {zones.map((zone) => (
              <div key={zone.id} className="flex items-start gap-3 p-4 border rounded-lg bg-gray-50">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={zone.fieldType} onValueChange={(v) => updateZone(zone.id, { fieldType: v as MeterFieldType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(METER_FIELD_CONFIG).map(([type, config]) => (
                          <SelectItem key={type} value={type}>{config.icon} {config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Libellé</Label>
                    <Input value={zone.label} onChange={(e) => updateZone(zone.id, { label: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Décimales</Label>
                    <div className="flex items-center gap-2">
                      <Switch checked={zone.hasDecimals} onCheckedChange={(v) => updateZone(zone.id, { hasDecimals: v })} />
                      {zone.hasDecimals && (
                        <Input type="number" min={1} max={5} value={zone.decimalDigits || 2} onChange={(e) => updateZone(zone.id, { decimalDigits: parseInt(e.target.value) })} className="w-20" />
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeZone(zone.id)} disabled={zones.length === 1} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* STEP 3: Tests */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Tester le modèle</h2>
            <p className="text-sm text-gray-500 mb-4">Optionnel : testez avec une autre photo pour vérifier la reconnaissance.</p>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                {testPhotoUrl ? (
                  <div className="relative">
                    <img src={testPhotoUrl} alt="Test" className="w-full max-h-48 object-contain rounded-lg border" />
                    <button onClick={resetTest} className="absolute top-2 right-2 p-1.5 bg-gray-800 text-white rounded-full">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50">
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Photo de test</span>
                    <input type="file" accept="image/*" onChange={handleTestPhotoUpload} className="hidden" />
                  </label>
                )}
                {testPhotoUrl && !testResult && (
                  <Button onClick={runTest} disabled={testing} className="w-full mt-3 gap-2">
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Tester
                  </Button>
                )}
              </div>
              
              <div>
                {testResult ? (
                  <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {testResult.success ? <Check className="h-5 w-5 text-green-600" /> : <X className="h-5 w-5 text-red-600" />}
                      <span className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                        {testResult.success ? 'Reconnu' : 'Erreur'}
                      </span>
                    </div>
                    {testResult.serialNumber && <p className="text-sm">N°: <span className="font-mono">{testResult.serialNumber}</span></p>}
                    {testResult.reading && <p className="text-sm">Index: <span className="font-mono">{testResult.reading}</span></p>}
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm text-center">
                    Les tests sont optionnels mais recommandés pour vérifier la qualité du modèle.
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Récapitulatif</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">Nom:</span> <span className="font-medium">{name}</span></div>
              <div><span className="text-gray-500">Fabricant:</span> <span className="font-medium">{manufacturer || '-'}</span></div>
              <div><span className="text-gray-500">Type:</span> {METER_TYPE_CONFIG[meterType]?.icon} {METER_TYPE_CONFIG[meterType]?.label}</div>
              <div><span className="text-gray-500">Zones:</span> <span className="font-medium">{zones.length}</span></div>
            </div>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t">
              <Switch checked={isVerified} onCheckedChange={setIsVerified} />
              <Label>Marquer comme vérifié</Label>
            </div>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 1}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        {currentStep < 3 ? (
          <Button onClick={() => goToStep(currentStep + 1)} disabled={!canProceed(currentStep)}>
            Suivant <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Enregistrement...' : 'Créer le modèle'}
          </Button>
        )}
      </div>
    </div>
  )
}
