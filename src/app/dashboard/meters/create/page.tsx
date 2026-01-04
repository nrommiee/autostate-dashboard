'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  ArrowLeft, ArrowRight, Loader2, Save, CheckCircle, Upload, 
  Sparkles, X, Trash2, Plus, Play, Check, RotateCcw, 
  AlertTriangle, Move, Edit3, Eye, EyeOff, ZoomIn
} from 'lucide-react'

// Types
const METER_TYPES = [
  { value: 'gas', label: 'Gaz', icon: '🔥', unit: 'm³' },
  { value: 'electricity', label: 'Électricité', icon: '⚡', unit: 'kWh' },
  { value: 'water_general', label: 'Eau générale', icon: '💧', unit: 'm³' },
  { value: 'water_passage', label: 'Eau passage', icon: '🚿', unit: 'm³' },
  { value: 'oil_tank', label: 'Mazout', icon: '🛢️', unit: 'L' },
  { value: 'calorimeter', label: 'Calorimètre', icon: '🌡️', unit: 'kWh' },
  { value: 'other', label: 'Autre', icon: '📊', unit: '' },
]

const DISPLAY_TYPES = [
  { 
    value: 'mechanical', 
    label: 'Mécanique', 
    description: 'Rouleaux à chiffres',
    image: '🔢'
  },
  { 
    value: 'digital', 
    label: 'Digital', 
    description: 'Écran LCD/LED',
    image: '📟'
  },
  { 
    value: 'dials', 
    label: 'Cadrans', 
    description: 'Aiguilles rotatives',
    image: '🎯'
  },
  { 
    value: 'other', 
    label: 'Autre', 
    description: 'Type personnalisé',
    image: '⚙️'
  },
]

const ZONE_TYPES = [
  { value: 'serialNumber', label: 'N° série', icon: '🔢', color: '#3B82F6' },
  { value: 'readingSingle', label: 'Index unique', icon: '📊', color: '#10B981' },
  { value: 'ean', label: 'Code EAN', icon: '📋', color: '#8B5CF6' },
  { value: 'readingDay', label: 'Index jour', icon: '☀️', color: '#F59E0B' },
  { value: 'readingNight', label: 'Index nuit', icon: '🌙', color: '#6366F1' },
]

const DECIMAL_INDICATORS = [
  { value: 'red_digits', label: 'Chiffres rouges' },
  { value: 'red_background', label: 'Fond rouge' },
  { value: 'comma', label: 'Virgule visible' },
  { value: 'none', label: 'Aucun indicateur' },
  { value: 'other', label: 'Autre' },
]

interface Zone {
  id: string
  fieldType: string
  label: string
  extractedValue: string
  position: { x: number; y: number; w: number; h: number } | null
  isValidated: boolean
  decimalDigits: number
}

interface TestResult {
  id: string
  photoUrl: string
  timestamp: Date
  success: boolean
  confidence: number
  extractedSerial?: string
  extractedReading?: string
  correctSerial?: string
  correctReading?: string
  isValidated: boolean
  isRejected: boolean
  rejectionReason?: string
}

const STEPS = [
  { id: 1, label: 'Photo & Informations', icon: '📷' },
  { id: 2, label: 'Index & Zones', icon: '🎯' },
  { id: 3, label: 'Tests', icon: '✅' },
]

export default function CreateMeterModelPage() {
  const router = useRouter()
  const photoContainerRef = useRef<HTMLDivElement>(null)
  
  const [currentStep, setCurrentStep] = useState(1)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  // Informations - tous vides au départ
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [meterType, setMeterType] = useState<string>('')
  const [customMeterType, setCustomMeterType] = useState('')
  const [unit, setUnit] = useState('')
  const [displayType, setDisplayType] = useState('')
  const [customDisplayType, setCustomDisplayType] = useState('')
  const [keywords, setKeywords] = useState<{ value: string; selected: boolean }[]>([])
  const [needsAnalysis, setNeedsAnalysis] = useState(false)

  // Index de consommation
  const [integerDigits, setIntegerDigits] = useState(5)
  const [decimalDigits, setDecimalDigits] = useState(3)
  const [decimalIndicator, setDecimalIndicator] = useState('red_digits')
  const [customDecimalIndicator, setCustomDecimalIndicator] = useState('')

  // Zones
  const [zones, setZones] = useState<Zone[]>([])
  const [showZonesOnPhoto, setShowZonesOnPhoto] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [repositioningZoneId, setRepositioningZoneId] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)

  // Tests
  const [testPhotoFile, setTestPhotoFile] = useState<File | null>(null)
  const [testPhotoUrl, setTestPhotoUrl] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [currentTestResult, setCurrentTestResult] = useState<TestResult | null>(null)
  const [testHistory, setTestHistory] = useState<TestResult[]>([])

  // Modal de correction
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [correctionSerial, setCorrectionSerial] = useState('')
  const [correctionReading, setCorrectionReading] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')

  // Modal lightbox pour agrandir image
  const [showImageLightbox, setShowImageLightbox] = useState(false)
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null)

  // Validation error
  const [validationError, setValidationError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // État pour l'animation pulse après analyse IA
  const [justAnalyzed, setJustAnalyzed] = useState(false)

  // Photo handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl)
    setPhotoFile(file)
    setPhotoUrl(URL.createObjectURL(file))
    setNeedsAnalysis(true)
  }

  const removePhoto = () => {
    if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl)
    setPhotoFile(null)
    setPhotoUrl(null)
    setName('')
    setManufacturer('')
    setMeterType('')
    setUnit('')
    setDisplayType('')
    setKeywords([])
    setZones([])
    setNeedsAnalysis(false)
  }

  // Ouvrir lightbox
  const openLightbox = (url: string) => {
    setLightboxImageUrl(url)
    setShowImageLightbox(true)
  }

  // Analysis
  const analyzePhoto = async () => {
    if (!photoFile) return
    setAnalyzing(true)
    setError(null)
    setJustAnalyzed(false)

    try {
      const base64 = await fileToBase64(photoFile)
      const response = await fetch('/api/analyze-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: [base64] })
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erreur analyse')

      if (result.name) setName(result.name)
      if (result.manufacturer) setManufacturer(result.manufacturer)
      if (result.meterType) {
        const known = METER_TYPES.find(t => t.value === result.meterType)
        if (known) {
          setMeterType(result.meterType)
          setUnit(known.unit)
        } else {
          setMeterType('other')
          setCustomMeterType(result.meterType)
        }
      }
      if (result.displayType) {
        const knownDisplay = DISPLAY_TYPES.find(d => d.value === result.displayType)
        if (knownDisplay) {
          setDisplayType(result.displayType)
        } else {
          setDisplayType('other')
          setCustomDisplayType(result.displayType)
        }
      } else if (!displayType) {
        setDisplayType('mechanical')
      }
      if (result.keywords) {
        setKeywords(result.keywords.map((kw: string) => ({ value: kw, selected: true })))
      }

      // Créer les zones depuis l'analyse
      const newZones: Zone[] = []
      if (result.serialNumber) {
        newZones.push({
          id: crypto.randomUUID(),
          fieldType: 'serialNumber',
          label: 'N° série',
          extractedValue: result.serialNumber,
          position: result.serialPosition || null,
          isValidated: false,
          decimalDigits: 0
        })
      }
      if (result.reading) {
        const typeLabel = METER_TYPES.find(t => t.value === result.meterType)?.label?.toLowerCase() || 'compteur'
        newZones.push({
          id: crypto.randomUUID(),
          fieldType: 'readingSingle',
          label: `Index ${typeLabel}`,
          extractedValue: result.reading,
          position: result.readingPosition || null,
          isValidated: false,
          decimalDigits: 3
        })
      }
      setZones(newZones)
      
      // Déclencher l'animation pulse
      setJustAnalyzed(true)
      setNeedsAnalysis(false)
      setTimeout(() => setJustAnalyzed(false), 2000)

    } catch (err: any) {
      setError(err.message || 'Erreur analyse')
    } finally {
      setAnalyzing(false)
    }
  }

  // Zones
  const startRepositioning = (zoneId: string) => {
    setRepositioningZoneId(zoneId)
    setSelectedZoneId(zoneId)
    setShowZonesOnPhoto(true)
  }

  const handlePhotoMouseDown = (e: React.MouseEvent) => {
    if (!repositioningZoneId || !photoContainerRef.current) return
    const rect = photoContainerRef.current.getBoundingClientRect()
    setDragStart({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height })
  }

  const handlePhotoMouseMove = (e: React.MouseEvent) => {
    if (!repositioningZoneId || !dragStart || !photoContainerRef.current) return
    const rect = photoContainerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    updateZone(repositioningZoneId, { 
      position: { 
        x: Math.min(dragStart.x, x), 
        y: Math.min(dragStart.y, y), 
        w: Math.abs(x - dragStart.x), 
        h: Math.abs(y - dragStart.y) 
      } 
    })
  }

  const handlePhotoMouseUp = () => { 
    setDragStart(null)
    setRepositioningZoneId(null) 
  }

  const addZone = (fieldType: string) => {
    const config = ZONE_TYPES.find(z => z.value === fieldType)
    setZones([...zones, { 
      id: crypto.randomUUID(), 
      fieldType, 
      label: config?.label || fieldType,
      extractedValue: '', 
      position: null, 
      isValidated: false,
      decimalDigits: fieldType.includes('reading') ? 3 : 0
    }])
  }

  const removeZone = (id: string) => setZones(zones.filter(z => z.id !== id))
  
  const updateZone = (id: string, updates: Partial<Zone>) => {
    setZones(zones.map(z => z.id === id ? { ...z, ...updates } : z))
  }

  const validateZone = (id: string) => {
    updateZone(id, { isValidated: true })
  }

  const validateAllZones = () => {
    setZones(zones.map(z => ({ ...z, isValidated: true })))
  }

  const allZonesValidated = zones.length > 0 && zones.every(z => z.isValidated)

  // Tests
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
      const promptText = generatePromptText()
      
      const response = await fetch('/api/test-meter', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          testPhoto: base64, 
          promptRules: promptText,
          modelData: { 
            name, 
            manufacturer, 
            meterType: meterType === 'other' ? customMeterType : meterType, 
            unit, 
            integerDigits,
            decimalDigits,
            decimalIndicator: decimalIndicator === 'other' ? customDecimalIndicator : decimalIndicator
          } 
        }) 
      })
      const result = await response.json()
      
      setCurrentTestResult({ 
        id: crypto.randomUUID(), 
        photoUrl: testPhotoUrl!, 
        timestamp: new Date(), 
        success: result.success !== false, 
        confidence: result.confidence || 0.95, 
        extractedSerial: result.extractedSerial || result.serialNumber, 
        extractedReading: result.extractedReading || result.reading, 
        isValidated: false,
        isRejected: false
      })
    } catch (err) {
      setCurrentTestResult({ 
        id: crypto.randomUUID(), 
        photoUrl: testPhotoUrl!, 
        timestamp: new Date(), 
        success: false, 
        confidence: 0, 
        isValidated: false,
        isRejected: false
      })
    } finally { 
      setTesting(false) 
    }
  }

  const validateTest = () => { 
    if (!currentTestResult) return
    const validatedTest = { ...currentTestResult, isValidated: true }
    setTestHistory([validatedTest, ...testHistory])
    resetTestPhoto()
  }

  const openCorrectionModal = () => {
    if (!currentTestResult) return
    setCorrectionSerial(currentTestResult.extractedSerial || '')
    setCorrectionReading(currentTestResult.extractedReading || '')
    setCorrectionReason('')
    setShowCorrectionModal(true)
  }

  const submitCorrection = () => {
    if (!currentTestResult) return
    
    const rejectedTest: TestResult = { 
      ...currentTestResult, 
      isValidated: false,
      isRejected: true,
      correctSerial: correctionSerial !== currentTestResult.extractedSerial ? correctionSerial : undefined,
      correctReading: correctionReading !== currentTestResult.extractedReading ? correctionReading : undefined,
      rejectionReason: correctionReason || undefined
    }
    
    setTestHistory([rejectedTest, ...testHistory])
    setShowCorrectionModal(false)
    resetTestPhoto()
  }

  const resetTestPhoto = () => { 
    if (testPhotoUrl?.startsWith('blob:')) URL.revokeObjectURL(testPhotoUrl)
    setTestPhotoFile(null)
    setTestPhotoUrl(null)
    setCurrentTestResult(null)
  }

  // Générer le prompt
  function generatePromptText(): string {
    const typeLabel = meterType === 'other' ? customMeterType : METER_TYPES.find(t => t.value === meterType)?.label || meterType
    const displayLabel = displayType === 'other' ? customDisplayType : DISPLAY_TYPES.find(d => d.value === displayType)?.label || displayType
    
    const formatExample = 'X'.repeat(integerDigits) + ',' + 'X'.repeat(decimalDigits)
    
    let prompt = `MODÈLE: ${manufacturer ? manufacturer + ' ' : ''}${name}
TYPE: ${typeLabel}
AFFICHAGE: ${displayLabel}

RÈGLES DE LECTURE:`

    const serialZone = zones.find(z => z.fieldType === 'serialNumber')
    if (serialZone) {
      const digits = serialZone.extractedValue?.replace(/[^0-9]/g, '').length || 8
      prompt += `\n- N° série: ${digits} chiffres`
    }

    prompt += `\n- Index: ${integerDigits} entiers + ${decimalDigits} décimales`
    prompt += `\n- Format attendu: ${formatExample}`

    if (decimalIndicator === 'red_digits') {
      prompt += `\n- Les ${decimalDigits} derniers chiffres en ROUGE = décimales`
    } else if (decimalIndicator === 'red_background') {
      prompt += `\n- Les ${decimalDigits} derniers chiffres sur FOND ROUGE = décimales`
    } else if (decimalIndicator === 'comma') {
      prompt += `\n- Virgule visible entre entiers et décimales`
    } else if (decimalIndicator === 'other' && customDecimalIndicator) {
      prompt += `\n- ${customDecimalIndicator}`
    }

    // Ajouter les corrections des tests
    const corrections = testHistory.filter(t => t.isRejected && t.correctReading)
    if (corrections.length > 0) {
      prompt += `\n\nCORRECTIONS (erreurs à éviter):`
      corrections.slice(0, 5).forEach(c => {
        prompt += `\n- "${c.extractedReading}" → "${c.correctReading}"`
        if (c.rejectionReason) prompt += ` (${c.rejectionReason})`
      })
    }

    return prompt
  }

  // Save - utilise l'API existante /api/meter-models
  const handleSave = async () => {
    // Validation
    const finalMeterType = meterType === 'other' ? customMeterType : meterType
    const finalDisplayType = displayType === 'other' ? customDisplayType : displayType
    
    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }
    if (!finalMeterType) {
      setError('Le type de compteur est requis')
      return
    }
    if (!photoUrl) {
      setError('La photo est requise')
      return
    }
    if (zones.length === 0) {
      setError('Au moins une zone est requise')
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

      const finalDecimalIndicator = decimalIndicator === 'other' ? customDecimalIndicator : decimalIndicator
      const promptText = generatePromptText()

      // Appel à l'API existante
      const response = await fetch('/api/meter-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          manufacturer: manufacturer || '',
          meter_type: finalMeterType,
          unit: unit || 'm³',
          ai_description: promptText,
          ai_analysis_data: {
            display_type: finalDisplayType || 'mechanical',
            keywords: keywords.filter(k => k.selected).map(k => k.value),
            integerDigits,
            decimalDigits,
            decimalIndicator: finalDecimalIndicator,
            tests: testHistory.map(t => ({
              extractedSerial: t.extractedSerial,
              extractedReading: t.extractedReading,
              correctSerial: t.correctSerial,
              correctReading: t.correctReading,
              confidence: t.confidence,
              isValidated: t.isValidated,
              isRejected: t.isRejected,
              rejectionReason: t.rejectionReason
            }))
          },
          reference_photos: [uploadedPhotoUrl],
          zones: zones.map(z => ({
            id: z.id,
            fieldType: z.fieldType,
            label: z.label,
            extractedValue: z.extractedValue,
            position: z.position,
            hasDecimals: z.fieldType?.includes('reading'),
            decimalDigits: z.decimalDigits || 0
          })),
          is_verified: testHistory.filter(t => t.isValidated).length > 0,
          is_active: true
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la création')
      }

      setSaved(true)
      setTimeout(() => router.push('/dashboard/meters'), 1500)
    } catch (err: any) { 
      setError(err.message || 'Erreur lors de la sauvegarde') 
    } finally { 
      setSaving(false) 
    }
  }

  // Navigation
  const canProceed = (step: number): boolean => { 
    switch (step) { 
      case 1: return !!photoUrl && !!name.trim() && !!(meterType === 'other' ? customMeterType : meterType)
      case 2: return allZonesValidated
      default: return true 
    } 
  }

  const goToStep = (step: number) => { 
    if (step < 1 || step > 3) return
    
    if (step > currentStep) {
      if (!canProceed(currentStep)) {
        if (currentStep === 2 && !allZonesValidated) {
          setValidationError('Veuillez valider toutes les zones en cliquant sur "OK" avant de continuer.')
          return
        }
        if (currentStep === 1) {
          if (!photoUrl) {
            setValidationError('Veuillez ajouter une photo.')
            return
          }
          if (!name.trim()) {
            setValidationError('Veuillez ajouter un nom.')
            return
          }
          const finalType = meterType === 'other' ? customMeterType : meterType
          if (!finalType) {
            setValidationError('Veuillez sélectionner un type de compteur.')
            return
          }
        }
        return
      }
    }
    
    setValidationError(null)
    setCurrentStep(step) 
  }

  // Format preview
  const formatPreview = 'X'.repeat(integerDigits) + ',' + 'X'.repeat(decimalDigits)

  return (
    <TooltipProvider>
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
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
                <span className="hidden sm:inline text-sm font-medium">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-12 md:w-24 h-0.5 mx-2 ${step.id < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Errors */}
        {error && (
          <Card className="p-3 mb-4 bg-red-50 border-red-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-red-700 text-sm">{error}</span>
          </Card>
        )}
        {validationError && (
          <Card className="p-3 mb-4 bg-yellow-50 border-yellow-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-yellow-700 text-sm">{validationError}</span>
          </Card>
        )}
        {saved && (
          <Card className="p-4 mb-4 bg-green-50 border-green-200 text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-1" />
            <p className="text-green-700 font-medium">Modèle créé avec succès !</p>
          </Card>
        )}

        {!saved && (
          <>
            {/* STEP 1 - PHOTO & INFORMATIONS */}
            {currentStep === 1 && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Photo à gauche - RÉDUITE À 70% */}
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-2">Photo de référence</h3>
                  <p className="text-gray-500 text-xs mb-3">L'IA analyse la photo pour pré-remplir les informations.</p>
                  
                  {photoUrl ? (
                    <div className="space-y-3">
                      <div className="relative flex justify-center">
                        <div className="relative w-[70%]">
                          <img 
                            src={photoUrl} 
                            alt="Compteur" 
                            className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" 
                            onClick={() => openLightbox(photoUrl)}
                          />
                          <button onClick={removePhoto} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600">
                            <X className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => openLightbox(photoUrl)} 
                            className="absolute bottom-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
                          >
                            <ZoomIn className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {needsAnalysis ? (
                        <Button onClick={analyzePhoto} disabled={analyzing} className="w-full gap-2 bg-teal-600 hover:bg-teal-700">
                          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {analyzing ? 'Analyse en cours...' : 'Analyser cette photo'}
                        </Button>
                      ) : (
                        <Button onClick={analyzePhoto} disabled={analyzing} variant="outline" className="w-full gap-2">
                          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          {analyzing ? 'Analyse en cours...' : 'Réanalyser la photo'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors">
                      <Upload className="h-10 w-10 text-gray-400 mb-2" />
                      <span className="text-gray-600 font-medium">Cliquez pour ajouter une photo</span>
                      <span className="text-gray-400 text-sm mt-1">JPG, PNG</span>
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  )}
                </Card>

                {/* Informations à droite */}
                <Card className={`p-4 transition-all duration-500 ${justAnalyzed ? 'ring-2 ring-teal-500 ring-opacity-50' : ''}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="font-semibold">Informations</h3>
                    {justAnalyzed && (
                      <Badge className="bg-teal-100 text-teal-700 animate-pulse">
                        <Sparkles className="h-3 w-3 mr-1" /> Rempli par l'IA
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500">Nom *</Label>
                        <Input 
                          value={name} 
                          onChange={(e) => setName(e.target.value)} 
                          placeholder="Ex: G4 RF1" 
                          className={`mt-1 transition-all ${justAnalyzed && name ? 'ring-2 ring-teal-300 bg-teal-50' : ''}`} 
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Fabricant</Label>
                        <Input 
                          value={manufacturer} 
                          onChange={(e) => setManufacturer(e.target.value)} 
                          placeholder="Ex: Itron" 
                          className={`mt-1 transition-all ${justAnalyzed && manufacturer ? 'ring-2 ring-teal-300 bg-teal-50' : ''}`} 
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-gray-500">Type de compteur *</Label>
                      <div className={`grid grid-cols-4 gap-2 mt-1 ${justAnalyzed && meterType ? 'ring-2 ring-teal-300 rounded-lg p-1' : ''}`}>
                        {METER_TYPES.map((type) => (
                          <button
                            key={type.value}
                            onClick={() => { setMeterType(type.value); if (type.unit) setUnit(type.unit) }}
                            className={`p-2 rounded-lg border text-center transition-colors ${
                              meterType === type.value ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="text-lg">{type.icon}</span>
                            <div className="text-xs mt-0.5">{type.label}</div>
                          </button>
                        ))}
                      </div>
                      {!meterType && !justAnalyzed && (
                        <p className="text-xs text-gray-400 mt-1">Sélectionnez un type ou analysez la photo</p>
                      )}
                      {meterType === 'other' && (
                        <Input 
                          value={customMeterType} 
                          onChange={(e) => setCustomMeterType(e.target.value)} 
                          placeholder="Type personnalisé"
                          className="mt-2" 
                        />
                      )}
                    </div>

                    <div>
                      <Label className="text-xs text-gray-500">Unité</Label>
                      <Input 
                        value={unit} 
                        onChange={(e) => setUnit(e.target.value)} 
                        placeholder="Ex: m³, kWh, L" 
                        className={`mt-1 ${justAnalyzed && unit ? 'ring-2 ring-teal-300 bg-teal-50' : ''}`} 
                      />
                    </div>

                    {/* Type d'affichage - Version liste UNIQUEMENT avec Autre */}
                    <div>
                      <Label className="text-xs text-gray-500">Type d'affichage</Label>
                      <div className={`grid grid-cols-4 gap-2 mt-2 ${justAnalyzed && displayType ? 'ring-2 ring-teal-300 rounded-lg p-1' : ''}`}>
                        {DISPLAY_TYPES.map(d => (
                          <div 
                            key={d.value} 
                            className={`p-2 rounded-lg border text-center cursor-pointer transition-colors ${
                              displayType === d.value ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setDisplayType(d.value)}
                          >
                            <div className="text-xl mb-1">{d.image}</div>
                            <div className="text-xs font-medium">{d.label}</div>
                            <div className="text-[10px] text-gray-400">{d.description}</div>
                          </div>
                        ))}
                      </div>
                      {displayType === 'other' && (
                        <Input 
                          value={customDisplayType} 
                          onChange={(e) => setCustomDisplayType(e.target.value)} 
                          placeholder="Type d'affichage personnalisé"
                          className="mt-2" 
                        />
                      )}
                    </div>

                    {keywords.length > 0 && (
                      <div>
                        <Label className="text-xs text-gray-500">Mots-clés détectés</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {keywords.map((kw, i) => (
                            <Badge 
                              key={i} 
                              variant={kw.selected ? 'default' : 'outline'} 
                              className={`cursor-pointer text-xs ${kw.selected ? 'bg-teal-600' : ''}`}
                              onClick={() => setKeywords(keywords.map((k, j) => j === i ? { ...k, selected: !k.selected } : k))}
                            >
                              {kw.selected && <Check className="h-3 w-3 mr-1" />}
                              {kw.value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* STEP 2 - INDEX & ZONES */}
            {currentStep === 2 && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Photo avec zones - RÉDUITE À 70% */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">
                      Photo
                      {repositioningZoneId && <span className="text-teal-600 ml-2">— Dessinez la zone</span>}
                    </h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowZonesOnPhoto(!showZonesOnPhoto)}
                      className="h-8 text-xs gap-1"
                    >
                      {showZonesOnPhoto ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showZonesOnPhoto ? 'Masquer zones' : 'Afficher zones'}
                    </Button>
                  </div>
                  
                  {photoUrl && (
                    <div className="flex justify-center">
                      <div 
                        ref={photoContainerRef} 
                        className={`relative select-none w-[70%] ${repositioningZoneId ? 'cursor-crosshair' : ''}`}
                        onMouseDown={handlePhotoMouseDown}
                        onMouseMove={handlePhotoMouseMove}
                        onMouseUp={handlePhotoMouseUp}
                        onMouseLeave={handlePhotoMouseUp}
                      >
                        <img 
                          src={photoUrl} 
                          alt="Compteur" 
                          className="w-full rounded-lg cursor-pointer" 
                          draggable={false} 
                          onClick={() => !repositioningZoneId && openLightbox(photoUrl)}
                        />
                        <button 
                          onClick={() => openLightbox(photoUrl)} 
                          className="absolute bottom-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </button>
                        {showZonesOnPhoto && zones.map((zone) => zone.position && (
                          <div 
                            key={zone.id}
                            className={`absolute border-2 rounded ${selectedZoneId === zone.id ? 'ring-2 ring-white' : ''}`}
                            style={{
                              left: `${zone.position.x * 100}%`,
                              top: `${zone.position.y * 100}%`,
                              width: `${zone.position.w * 100}%`,
                              height: `${zone.position.h * 100}%`,
                              borderColor: ZONE_TYPES.find(z => z.value === zone.fieldType)?.color || '#6B7280',
                              backgroundColor: `${ZONE_TYPES.find(z => z.value === zone.fieldType)?.color || '#6B7280'}30`
                            }}
                            onClick={() => setSelectedZoneId(zone.id)}
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
                    </div>
                  )}
                </Card>

                {/* Index + Zones à droite */}
                <div className="space-y-4">
                  {/* Index de consommation */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Index de consommation</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label className="text-xs text-gray-500">Chiffres entiers</Label>
                        <Input 
                          type="number" 
                          value={integerDigits} 
                          onChange={(e) => setIntegerDigits(parseInt(e.target.value) || 1)} 
                          className="mt-1" 
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Décimales à utiliser</Label>
                        <Input 
                          type="number" 
                          value={decimalDigits} 
                          onChange={(e) => setDecimalDigits(parseInt(e.target.value) || 0)} 
                          className="mt-1" 
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <Label className="text-xs text-gray-500">Comment repérer les décimales ?</Label>
                      <Select value={decimalIndicator} onValueChange={setDecimalIndicator}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DECIMAL_INDICATORS.map(d => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {decimalIndicator === 'other' && (
                        <Input 
                          value={customDecimalIndicator} 
                          onChange={(e) => setCustomDecimalIndicator(e.target.value)} 
                          placeholder="Décrivez..."
                          className="mt-2" 
                        />
                      )}
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border text-center">
                      <div className="text-xs text-gray-500 mb-2">Format attendu</div>
                      <div className="font-mono text-xl">
                        <span className="bg-gray-800 text-white px-2 py-1 rounded">{formatPreview.split(',')[0]}</span>
                        <span className="text-gray-400 mx-1">,</span>
                        <span className={`px-2 py-1 rounded ${
                          decimalIndicator === 'red_digits' || decimalIndicator === 'red_background' 
                            ? 'bg-red-500 text-white' 
                            : 'bg-gray-300'
                        }`}>
                          {formatPreview.split(',')[1]}
                        </span>
                      </div>
                    </div>
                  </Card>

                  {/* Zones */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Zones ({zones.length})</h3>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={validateAllZones}
                        disabled={zones.length === 0 || allZonesValidated}
                        className="h-7 text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" /> Tout valider
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {zones.map((zone) => {
                        const config = ZONE_TYPES.find(z => z.value === zone.fieldType)
                        return (
                          <div 
                            key={zone.id} 
                            className={`p-3 border rounded-lg ${zone.isValidated ? 'bg-green-50 border-green-200' : 'bg-white'}`}
                            style={{ borderLeftWidth: 4, borderLeftColor: config?.color || '#6B7280' }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">{zone.label}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeZone(zone.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center gap-2 mb-2">
                              <Input 
                                value={zone.extractedValue} 
                                onChange={(e) => updateZone(zone.id, { extractedValue: e.target.value })}
                                className="font-mono flex-1 h-9"
                                placeholder="Valeur..."
                              />
                              <Button 
                                size="sm" 
                                variant={zone.isValidated ? 'secondary' : 'default'}
                                onClick={() => validateZone(zone.id)}
                                disabled={zone.isValidated}
                                className="h-9 px-4"
                              >
                                {zone.isValidated ? '✓' : 'OK'}
                              </Button>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {zone.position ? (
                                <>
                                  <Badge variant="outline" className="text-xs bg-green-50">✓ Positionné</Badge>
                                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => startRepositioning(zone.id)}>
                                    <Move className="h-3 w-3 mr-1" /> Modifier
                                  </Button>
                                </>
                              ) : (
                                <Button variant="default" size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={() => startRepositioning(zone.id)}>
                                  <Move className="h-3 w-3 mr-1" /> Positionner
                                </Button>
                              )}

                              {zone.fieldType.includes('reading') && (
                                <div className="flex items-center gap-1 ml-auto">
                                  <span className="text-xs text-gray-500">Déc:</span>
                                  <div className="flex border rounded overflow-hidden">
                                    {[1, 2, 3].map(n => (
                                      <button 
                                        key={n}
                                        onClick={() => updateZone(zone.id, { decimalDigits: n })}
                                        className={`px-2 py-0.5 text-xs font-medium ${
                                          zone.decimalDigits === n ? 'bg-teal-600 text-white' : 'bg-gray-50 hover:bg-gray-100'
                                        }`}
                                      >
                                        {n}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Ajouter zone */}
                    <div className="mt-3 pt-3 border-t">
                      <span className="text-xs text-gray-500 block mb-2">Ajouter :</span>
                      <div className="flex flex-wrap gap-2">
                        {ZONE_TYPES.map((type) => (
                          <Tooltip key={type.value}>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => addZone(type.value)}
                                className="gap-1 h-8"
                              >
                                <Plus className="h-3 w-3" />
                                <span>{type.icon}</span>
                                <span className="text-xs">{type.label}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Ajouter {type.label}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* STEP 3 - TESTS */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <Card className="p-4">
                  <h2 className="font-semibold mb-1">Tests</h2>
                  <p className="text-gray-500 text-sm mb-4">Testez avec d'autres photos pour améliorer la reconnaissance. Les corrections enrichissent automatiquement le modèle.</p>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      {testPhotoUrl ? (
                        <div className="relative flex justify-center">
                          <div className="relative w-[70%]">
                            <img 
                              src={testPhotoUrl} 
                              alt="Test" 
                              className="w-full object-contain rounded-lg border cursor-pointer hover:opacity-90" 
                              onClick={() => openLightbox(testPhotoUrl)}
                            />
                            <button onClick={resetTestPhoto} className="absolute top-2 right-2 p-1.5 bg-gray-800 text-white rounded-full">
                              <RotateCcw className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => openLightbox(testPhotoUrl)} 
                              className="absolute bottom-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
                            >
                              <ZoomIn className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50">
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-500">Ajouter une photo de test</span>
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

                    <div>
                      {currentTestResult && (
                        <div className={`p-4 rounded-lg ${currentTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {currentTestResult.success ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <X className="h-5 w-5 text-red-600" />
                            )}
                            <span className={`font-medium ${currentTestResult.success ? 'text-green-700' : 'text-red-700'}`}>
                              {currentTestResult.success ? 'Reconnu' : 'Non reconnu'}
                            </span>
                            <Badge variant="outline">{Math.round(currentTestResult.confidence * 100)}%</Badge>
                          </div>
                          {currentTestResult.extractedSerial && (
                            <p className="text-sm">N°: <span className="font-mono">{currentTestResult.extractedSerial}</span></p>
                          )}
                          {currentTestResult.extractedReading && (
                            <p className="text-sm">Index: <span className="font-mono">{currentTestResult.extractedReading}</span></p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Button onClick={validateTest} className="flex-1 gap-1">
                              <Check className="h-4 w-4" /> Valider
                            </Button>
                            <Button onClick={openCorrectionModal} variant="outline" className="flex-1 gap-1">
                              <Edit3 className="h-4 w-4" /> Corriger
                            </Button>
                          </div>
                        </div>
                      )}
                      {!testPhotoUrl && !currentTestResult && (
                        <div className="h-48 flex items-center justify-center text-gray-400 text-sm text-center p-4">
                          <div>
                            <p className="mb-2">Les tests sont optionnels</p>
                            <p className="text-xs">Ils permettent d'améliorer la reconnaissance en corrigeant les erreurs</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Historique des tests */}
                {testHistory.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Historique ({testHistory.length})</h3>
                    <div className="space-y-2">
                      {testHistory.map((t, i) => (
                        <div key={t.id} className={`p-3 rounded-lg border text-sm ${t.isValidated ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            {t.isValidated ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}
                            <span className="font-medium">Test #{testHistory.length - i}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">N°:</span> <span className="font-mono">{t.extractedSerial || '-'}</span>
                              {t.correctSerial && <span className="text-green-600"> → {t.correctSerial}</span>}
                            </div>
                            <div>
                              <span className="text-gray-500">Index:</span> <span className="font-mono">{t.extractedReading || '-'}</span>
                              {t.correctReading && <span className="text-green-600"> → {t.correctReading}</span>}
                            </div>
                          </div>
                          {t.rejectionReason && <p className="text-xs text-red-600 mt-1">{t.rejectionReason}</p>}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Récapitulatif */}
                <Card className="p-4">
                  <h3 className="font-semibold mb-2">Récapitulatif</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Nom:</span>
                      <span className="ml-2 font-medium">{name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fabricant:</span>
                      <span className="ml-2 font-medium">{manufacturer || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <span className="ml-2">
                        {meterType === 'other' 
                          ? `📊 ${customMeterType || 'Autre'}`
                          : `${METER_TYPES.find(t => t.value === meterType)?.icon || ''} ${METER_TYPES.find(t => t.value === meterType)?.label || '-'}`
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Zones:</span>
                      <span className="ml-2 font-medium">{zones.filter(z => z.isValidated).length}/{zones.length}</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 1}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              {currentStep < 3 ? (
                <Button onClick={() => goToStep(currentStep + 1)} disabled={!canProceed(currentStep)}>
                  Suivant <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={saving} className="min-w-32">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Enregistrer
                </Button>
              )}
            </div>
          </>
        )}

        {/* Modal de correction */}
        <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-orange-500" />
                Corriger le test
              </DialogTitle>
              <DialogDescription>
                Indiquez les valeurs correctes pour améliorer la reconnaissance.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm">N° série lu par l'IA</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={currentTestResult?.extractedSerial || ''} disabled className="bg-gray-100 font-mono" />
                  <span className="text-gray-400">→</span>
                  <Input value={correctionSerial} onChange={(e) => setCorrectionSerial(e.target.value)} placeholder="Valeur correcte" className="font-mono" />
                </div>
              </div>
              
              <div>
                <Label className="text-sm">Index lu par l'IA</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={currentTestResult?.extractedReading || ''} disabled className="bg-gray-100 font-mono" />
                  <span className="text-gray-400">→</span>
                  <Input value={correctionReading} onChange={(e) => setCorrectionReading(e.target.value)} placeholder="Valeur correcte" className="font-mono" />
                </div>
              </div>
              
              <div>
                <Label className="text-sm">Raison du rejet (optionnel)</Label>
                <Textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Ex: Décimales mal placées..." className="mt-1" rows={2} />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCorrectionModal(false)}>Annuler</Button>
              <Button onClick={submitCorrection} className="bg-orange-500 hover:bg-orange-600">
                <Check className="h-4 w-4 mr-1" /> Enregistrer correction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Lightbox pour agrandir les images */}
        <Dialog open={showImageLightbox} onOpenChange={setShowImageLightbox}>
          <DialogContent className="max-w-4xl p-2">
            <DialogHeader className="sr-only">
              <DialogTitle>Image agrandie</DialogTitle>
            </DialogHeader>
            {lightboxImageUrl && (
              <div className="relative">
                <img 
                  src={lightboxImageUrl} 
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
      </div>
    </TooltipProvider>
  )
}

async function fileToBase64(file: File): Promise<string> { 
  return new Promise((resolve) => { 
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(file) 
  }) 
}
