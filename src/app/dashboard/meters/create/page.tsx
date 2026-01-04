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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, ArrowRight, Loader2, Save, CheckCircle } from 'lucide-react'

import { PhotoAnalyzer, AnalysisResult } from '@/components/meters/PhotoAnalyzer'
import { Keyword } from '@/components/meters/KeywordsSelector'
import { ZoneEditor } from '@/components/meters/ZoneEditor'
import { ModelRecap } from '@/components/meters/ModelRecap'
import { ModelTester, TestResult } from '@/components/meters/ModelTester'

const STEPS = [
  { id: 1, label: 'Informations', description: 'Infos générales' },
  { id: 2, label: 'Photo & Mots-clés', description: 'Analyse IA' },
  { id: 3, label: 'Zones', description: 'Zones de lecture' },
  { id: 4, label: 'Récap & Test', description: 'Validation' },
]

export default function CreateMeterModelPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const fromUnrecognized = searchParams.get('fromUnrecognized')
  const prefilledPhoto = searchParams.get('photo')
  const prefilledType = searchParams.get('type') as MeterType | null

  const [currentStep, setCurrentStep] = useState(1)

  // Step 1: Basic info
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [meterType, setMeterType] = useState<MeterType>(prefilledType || 'water_general')
  const [unit, setUnit] = useState(prefilledType ? METER_TYPE_CONFIG[prefilledType]?.unit || 'm³' : 'm³')
  const [displayType, setDisplayType] = useState<string>('mechanical_rolls')
  const [primaryColor, setPrimaryColor] = useState('')

  // Step 2: Photo & Keywords
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(prefilledPhoto || null)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [aiDescription, setAiDescription] = useState('')

  // Step 3: Zones
  const [zones, setZones] = useState<MeterZone[]>([])

  // Step 4: Tests
  const [testHistory, setTestHistory] = useState<TestResult[]>([])

  // Saving state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handlePhotoChange = (file: File | null, url: string | null) => {
    setPhotoFile(file)
    setPhotoUrl(url)
  }

  const handleAnalysisComplete = (analysis: AnalysisResult) => {
    if (analysis.name && !name) setName(analysis.name)
    if (analysis.manufacturer && !manufacturer) setManufacturer(analysis.manufacturer)
    if (analysis.meterType) {
      setMeterType(analysis.meterType as MeterType)
      setUnit(METER_TYPE_CONFIG[analysis.meterType as MeterType]?.unit || 'm³')
    }
    if (analysis.description) setAiDescription(analysis.description)
    if (analysis.suggestedZones && analysis.suggestedZones.length > 0 && zones.length === 0) {
      setZones(analysis.suggestedZones.map((z: any) => ({
        id: crypto.randomUUID(),
        fieldType: z.fieldType,
        label: z.label || METER_FIELD_CONFIG[z.fieldType as MeterFieldType]?.label,
        hasDecimals: z.hasDecimals || false,
        decimalDigits: z.decimalDigits,
        digitCount: z.digitCount
      })))
    }
  }

  const handleTestComplete = (result: TestResult) => {
    setTestHistory(prev => [result, ...prev])
  }

  const suggestZones = async (): Promise<MeterZone[]> => {
    if (!photoFile) return []

    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve((reader.result as string).split(',')[1])
      reader.readAsDataURL(photoFile)
    })

    const response = await fetch('/api/analyze-meter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: [base64], suggestZonesOnly: true })
    })

    if (!response.ok) throw new Error('Erreur')
    const result = await response.json()

    return (result.suggestedZones || []).map((z: any) => ({
      id: crypto.randomUUID(),
      fieldType: z.fieldType,
      label: z.label || METER_FIELD_CONFIG[z.fieldType as MeterFieldType]?.label,
      hasDecimals: z.hasDecimals || false,
      decimalDigits: z.decimalDigits,
      position: z.position
    }))
  }

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1: return !!name.trim()
      case 2: return !!photoUrl
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

  const generateDescription = (): string => {
    const lines: string[] = []
    const typeLabel = meterType === 'gas' ? 'gaz' : meterType === 'electricity' ? 'électricité' : 'eau'
    lines.push(`Compteur ${typeLabel} ${manufacturer || ''} ${name}`.trim())
    
    const validKw = keywords.filter(k => k.validated)
    if (validKw.length > 0) {
      lines.push('', 'Mots-clés:')
      validKw.forEach(k => lines.push(`- ${k.value}`))
    }
    
    if (zones.length > 0) {
      lines.push('', 'Zones:')
      zones.forEach(z => {
        let desc = `- ${z.label}`
        if (z.hasDecimals) desc += ` (${z.decimalDigits} déc.)`
        lines.push(desc)
      })
    }

    if (aiDescription) lines.push('', aiDescription)
    return lines.join('\n')
  }

  const handleSave = async () => {
    if (!name.trim() || !photoUrl || zones.length === 0) {
      setError('Veuillez compléter tous les champs requis')
      return
    }

    setSaving(true)
    setError(null)

    try {
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

      const validatedKeywords = keywords.filter(k => k.validated).map(k => k.value)
      const generatedDescription = generateDescription()

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
          ai_description: generatedDescription,
          keywords: validatedKeywords,
          reference_photos: [uploadedPhotoUrl],
          zones: zones.map(z => ({
            field_type: z.fieldType,
            custom_label: z.label,
            position_x: z.position?.x,
            position_y: z.position?.y,
            position_width: z.position?.width,
            position_height: z.position?.height,
            decimal_places: z.hasDecimals ? z.decimalDigits : null,
            note: (z as any).note
          })),
          is_active: true,
          is_verified: testHistory.some(t => t.success),
          test_success_rate: testHistory.length > 0 
            ? testHistory.filter(t => t.success).length / testHistory.length 
            : 0,
          from_unrecognized_id: fromUnrecognized || null
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Erreur lors de la création')
      }

      const { id: modelId } = await response.json()
      
      // Save test history
      for (const test of testHistory) {
        await fetch('/api/meter-models/tests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model_id: modelId,
            photo_url: test.photoUrl,
            success: test.success,
            validation_type: test.validationType,
            confidence: test.confidence,
            extracted_serial: test.extractedSerial,
            extracted_reading: test.extractedReading,
            ai_response: test.aiResponse
          })
        })
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/meters">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nouveau modèle de compteur</h1>
          <p className="text-gray-500">
            {fromUnrecognized ? 'Depuis un compteur non reconnu' : 'Création manuelle'}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => goToStep(step.id)}
                disabled={step.id > currentStep && !canProceed(currentStep)}
                className={`flex items-center gap-2 ${
                  step.id === currentStep ? 'text-teal-600' :
                  step.id < currentStep ? 'text-green-600 cursor-pointer' :
                  'text-gray-400'
                }`}
              >
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step.id === currentStep ? 'bg-teal-600 text-white' :
                    step.id < currentStep ? 'bg-green-600 text-white' :
                    'bg-gray-200 text-gray-500'}
                `}>
                  {step.id < currentStep ? <CheckCircle className="h-5 w-5" /> : step.id}
                </div>
                <div className="hidden sm:block">
                  <div className="font-medium">{step.label}</div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
              </button>
              
              {index < STEPS.length - 1 && (
                <div className={`w-12 md:w-24 h-0.5 mx-2 ${
                  step.id < currentStep ? 'bg-green-600' : 'bg-gray-200'
                }`} />
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
          <p className="text-green-600 text-sm">Redirection...</p>
        </Card>
      )}

      {/* Step content */}
      {!saved && (
        <>
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <Card className="p-6 space-y-6">
              <h2 className="text-lg font-semibold">Informations générales</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom commercial *</Label>
                  <Input
                    id="name"
                    placeholder="ex: Landis+Gyr E350"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Fabricant</Label>
                  <Input
                    id="manufacturer"
                    placeholder="ex: Landis+Gyr"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Type d'énergie *</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(METER_TYPE_CONFIG).map(([type, config]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setMeterType(type as MeterType)
                        setUnit(config.unit)
                      }}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        meterType === type 
                          ? 'border-teal-500 bg-teal-50' 
                          : 'border-gray-200 hover:border-gray-300'
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
                  <Label htmlFor="unit">Unité par défaut</Label>
                  <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
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

              <div className="space-y-2">
                <Label htmlFor="color">Couleur dominante</Label>
                <Input
                  id="color"
                  placeholder="ex: gris, beige, noir"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </Card>
          )}

          {/* Step 2: Photo & Keywords */}
          {currentStep === 2 && (
            <PhotoAnalyzer
              photoUrl={photoUrl}
              photoFile={photoFile}
              keywords={keywords}
              onPhotoChange={handlePhotoChange}
              onKeywordsChange={setKeywords}
              onAnalysisComplete={handleAnalysisComplete}
            />
          )}

          {/* Step 3: Zones */}
          {currentStep === 3 && (
            <ZoneEditor
              photoUrl={photoUrl}
              zones={zones}
              onChange={setZones}
              onSuggestZones={suggestZones}
            />
          )}

          {/* Step 4: Recap & Test */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <ModelRecap
                name={name}
                manufacturer={manufacturer}
                meterType={meterType}
                unit={unit}
                keywords={keywords}
                zones={zones}
                photoUrl={photoUrl}
                description={aiDescription}
              />
              
              <ModelTester
                modelData={{
                  name,
                  manufacturer,
                  meterType,
                  unit,
                  keywords,
                  zones,
                  photoUrl,
                  description: aiDescription
                }}
                testHistory={testHistory}
                onTestComplete={handleTestComplete}
              />
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => goToStep(currentStep - 1)}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>

            {currentStep < 4 ? (
              <Button
                onClick={() => goToStep(currentStep + 1)}
                disabled={!canProceed(currentStep)}
                className="gap-2"
              >
                Suivant
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saving || !name.trim() || !photoUrl || zones.length === 0}
                className="gap-2"
              >
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
