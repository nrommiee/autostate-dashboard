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
  Sparkles, X, Trash2, Plus, Check, 
  AlertTriangle, Move, Eye, EyeOff, ZoomIn, ExternalLink,
  Square, Circle, RectangleHorizontal, MessageSquare
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
  { value: 'mechanical', label: 'Mécanique', description: 'Rouleaux à chiffres', image: '🔢' },
  { value: 'digital', label: 'Digital', description: 'Écran LCD/LED', image: '📟' },
  { value: 'dials', label: 'Cadrans', description: 'Aiguilles rotatives', image: '🎯' },
  { value: 'other', label: 'Autre', description: 'Type personnalisé', image: '⚙️' },
]

const ZONE_TYPES = [
  { value: 'meterBounds', label: 'Zone compteur', icon: '🔲', color: '#6B7280', isParent: true },
  { value: 'serialNumber', label: 'N° série', icon: '🔢', color: '#3B82F6', isParent: false },
  { value: 'readingSingle', label: 'Index', icon: '📊', color: '#10B981', isParent: false },
  { value: 'ean', label: 'Code EAN', icon: '📋', color: '#8B5CF6', isParent: false },
]

const ZONE_SHAPES = [
  { value: 'rectangle', label: 'Rectangle', icon: RectangleHorizontal },
  { value: 'square', label: 'Carré', icon: Square },
  { value: 'circle', label: 'Rond', icon: Circle },
]

const DECIMAL_INDICATORS = [
  { value: 'red_digits', label: 'Chiffres rouges' },
  { value: 'red_background', label: 'Fond rouge' },
  { value: 'comma', label: 'Virgule visible' },
  { value: 'none', label: 'Aucun indicateur' },
  { value: 'other', label: 'Autre' },
]

interface ZonePosition {
  x: number
  y: number
  w: number
  h: number
}

interface Zone {
  id: string
  fieldType: string
  label: string
  shape: 'rectangle' | 'square' | 'circle'
  position: ZonePosition | null
  positionRelative: ZonePosition | null // Position relative à la zone parent (compteur)
  remark: string // Remarque pour améliorer le prompt
  isValidated: boolean
}

interface DuplicateMatch {
  id: string
  name: string
  manufacturer: string | null
  meter_type: string
  photo: string
}

const STEPS = [
  { id: 1, label: 'Photo & Informations', icon: '📷' },
  { id: 2, label: 'Zones & Index', icon: '🎯' },
]

export default function CreateMeterModelPage() {
  const router = useRouter()
  const photoContainerRef = useRef<HTMLDivElement>(null)
  
  const [currentStep, setCurrentStep] = useState(1)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  // Informations
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
  const [decimalDigits, setDecimalDigits] = useState(0)
  const [decimalIndicator, setDecimalIndicator] = useState('none')
  const [customDecimalIndicator, setCustomDecimalIndicator] = useState('')

  // Zones - nouveau système
  const [zones, setZones] = useState<Zone[]>([])
  const [showZonesOnPhoto, setShowZonesOnPhoto] = useState(true)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [repositioningZoneId, setRepositioningZoneId] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [selectedShape, setSelectedShape] = useState<'rectangle' | 'square' | 'circle'>('rectangle')
  const [selectedZoneType, setSelectedZoneType] = useState<string | null>(null)
  const [editingRemarkZoneId, setEditingRemarkZoneId] = useState<string | null>(null)

  // Modal lightbox
  const [showImageLightbox, setShowImageLightbox] = useState(false)
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null)

  // Duplicate check
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null)
  const [duplicateConfidence, setDuplicateConfidence] = useState(0)
  const [duplicateReason, setDuplicateReason] = useState('')

  // Validation
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [justAnalyzed, setJustAnalyzed] = useState(false)

  // Store pending analysis
  const [pendingAnalysis, setPendingAnalysis] = useState<any>(null)
  const [pendingBase64, setPendingBase64] = useState<string | null>(null)

  // Computed values
  const meterBoundsZone = zones.find(z => z.fieldType === 'meterBounds')
  const childZones = zones.filter(z => z.fieldType !== 'meterBounds')
  const hasMeterBounds = !!meterBoundsZone?.position

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

  const openLightbox = (url: string) => {
    setLightboxImageUrl(url)
    setShowImageLightbox(true)
  }

  // Check duplicate
  const checkDuplicate = async (base64: string, detectedName: string, detectedManufacturer: string, detectedType: string): Promise<boolean> => {
    setCheckingDuplicate(true)
    try {
      const response = await fetch('/api/check-duplicate-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_base64: base64,
          detected_name: detectedName,
          detected_manufacturer: detectedManufacturer,
          detected_type: detectedType
        })
      })
      const result = await response.json()
      if (result.isDuplicate && result.matchedModel) {
        setDuplicateMatch(result.matchedModel)
        setDuplicateConfidence(result.confidence)
        setDuplicateReason(result.reason || '')
        setShowDuplicateModal(true)
        return true
      }
      return false
    } catch (err) {
      console.error('Duplicate check error:', err)
      return false
    } finally {
      setCheckingDuplicate(false)
    }
  }

  // Apply analysis results
  const applyAnalysisResults = (result: any) => {
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
      if (knownDisplay) setDisplayType(result.displayType)
      else { setDisplayType('other'); setCustomDisplayType(result.displayType) }
    } else if (!displayType) {
      setDisplayType('mechanical')
    }
    if (result.keywords) {
      setKeywords(result.keywords.map((kw: string) => ({ value: kw, selected: true })))
    }
    
    setJustAnalyzed(true)
    setNeedsAnalysis(false)
    setTimeout(() => setJustAnalyzed(false), 2000)
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

      setPendingAnalysis(result)
      setPendingBase64(base64)

      const isDuplicate = await checkDuplicate(
        base64, 
        result.name || '', 
        result.manufacturer || '', 
        result.meterType || ''
      )

      if (!isDuplicate) {
        applyAnalysisResults(result)
        setPendingAnalysis(null)
        setPendingBase64(null)
      }
    } catch (err: any) {
      setError(err.message || 'Erreur analyse')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleContinueAfterDuplicate = () => {
    setShowDuplicateModal(false)
    if (pendingAnalysis) {
      applyAnalysisResults(pendingAnalysis)
      setPendingAnalysis(null)
      setPendingBase64(null)
    }
  }

  const handleCancelAfterDuplicate = () => {
    setShowDuplicateModal(false)
    removePhoto()
    setPendingAnalysis(null)
    setPendingBase64(null)
  }

  // Zone management
  const addZone = (fieldType: string) => {
    const config = ZONE_TYPES.find(z => z.value === fieldType)
    if (!config) return
    
    // Check if already exists (except for meterBounds which is unique)
    if (zones.find(z => z.fieldType === fieldType)) return
    
    const newZone: Zone = {
      id: crypto.randomUUID(),
      fieldType,
      label: config.label,
      shape: selectedShape,
      position: null,
      positionRelative: null,
      remark: '',
      isValidated: false
    }
    
    setZones([...zones, newZone])
    setSelectedZoneType(fieldType)
    setRepositioningZoneId(newZone.id)
    setShowZonesOnPhoto(true)
  }

  const removeZone = (id: string) => {
    const zone = zones.find(z => z.id === id)
    // If removing meterBounds, remove all child zones too
    if (zone?.fieldType === 'meterBounds') {
      setZones([])
    } else {
      setZones(zones.filter(z => z.id !== id))
    }
  }

  const updateZone = (id: string, updates: Partial<Zone>) => {
    setZones(zones.map(z => z.id === id ? { ...z, ...updates } : z))
  }

  const startRepositioning = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId)
    if (zone) {
      setSelectedShape(zone.shape)
      setSelectedZoneType(zone.fieldType)
    }
    setRepositioningZoneId(zoneId)
    setShowZonesOnPhoto(true)
  }

  // Calculate relative position within meter bounds
  const calculateRelativePosition = (absolutePos: ZonePosition, boundsPos: ZonePosition): ZonePosition => {
    return {
      x: (absolutePos.x - boundsPos.x) / boundsPos.w,
      y: (absolutePos.y - boundsPos.y) / boundsPos.h,
      w: absolutePos.w / boundsPos.w,
      h: absolutePos.h / boundsPos.h
    }
  }

  const handlePhotoMouseDown = (e: React.MouseEvent) => {
    if (!repositioningZoneId || !photoContainerRef.current) return
    e.preventDefault()
    const rect = photoContainerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setDragStart({ x, y })
  }

  const handlePhotoMouseMove = (e: React.MouseEvent) => {
    if (!repositioningZoneId || !dragStart || !photoContainerRef.current) return
    const rect = photoContainerRef.current.getBoundingClientRect()
    const currentX = (e.clientX - rect.left) / rect.width
    const currentY = (e.clientY - rect.top) / rect.height
    
    const zone = zones.find(z => z.id === repositioningZoneId)
    if (!zone) return

    let newPosition: ZonePosition

    if (zone.shape === 'square' || zone.shape === 'circle') {
      // Force equal width and height
      const size = Math.max(Math.abs(currentX - dragStart.x), Math.abs(currentY - dragStart.y))
      newPosition = {
        x: currentX > dragStart.x ? dragStart.x : dragStart.x - size,
        y: currentY > dragStart.y ? dragStart.y : dragStart.y - size,
        w: size,
        h: size
      }
    } else {
      // Rectangle
      newPosition = {
        x: Math.min(dragStart.x, currentX),
        y: Math.min(dragStart.y, currentY),
        w: Math.abs(currentX - dragStart.x),
        h: Math.abs(currentY - dragStart.y)
      }
    }

    // Calculate relative position for child zones
    let relativePosition: ZonePosition | null = null
    if (zone.fieldType !== 'meterBounds' && meterBoundsZone?.position) {
      relativePosition = calculateRelativePosition(newPosition, meterBoundsZone.position)
    }

    updateZone(repositioningZoneId, { 
      position: newPosition,
      positionRelative: relativePosition
    })
  }

  const handlePhotoMouseUp = () => {
    // Only finish repositioning if we actually drew something (dragStart was set)
    if (dragStart) {
      setDragStart(null)
      // Check if zone has a valid size before finishing
      const zone = zones.find(z => z.id === repositioningZoneId)
      if (zone?.position && zone.position.w > 0.01 && zone.position.h > 0.01) {
        setRepositioningZoneId(null)
        setSelectedZoneType(null)
      }
    }
  }

  const handlePhotoMouseLeave = () => {
    // Only stop drag, don't cancel repositioning mode
    setDragStart(null)
  }

  // Generate prompt with zones
  function generatePromptText(): string {
    const typeLabel = meterType === 'other' ? customMeterType : METER_TYPES.find(t => t.value === meterType)?.label || meterType
    const displayLabel = displayType === 'other' ? customDisplayType : DISPLAY_TYPES.find(d => d.value === displayType)?.label || displayType
    const formatExample = 'X'.repeat(integerDigits) + (decimalDigits > 0 ? ',' + 'X'.repeat(decimalDigits) : '')
    
    let prompt = `MODÈLE: ${manufacturer ? manufacturer + ' ' : ''}${name}
TYPE: ${typeLabel}
AFFICHAGE: ${displayLabel}

RÈGLES DE LECTURE:
- Index: ${integerDigits} chiffres entiers${decimalDigits > 0 ? ` + ${decimalDigits} décimales` : ' (pas de décimales)'}
- Format attendu: ${formatExample}`

    if (decimalDigits > 0) {
      if (decimalIndicator === 'red_digits') {
        prompt += `\n- Les ${decimalDigits} derniers chiffres en ROUGE = décimales`
      } else if (decimalIndicator === 'red_background') {
        prompt += `\n- Les ${decimalDigits} derniers chiffres sur FOND ROUGE = décimales`
      } else if (decimalIndicator === 'comma') {
        prompt += `\n- Virgule visible entre entiers et décimales`
      } else if (decimalIndicator === 'other' && customDecimalIndicator) {
        prompt += `\n- ${customDecimalIndicator}`
      }
    }

    // Add zones with relative positions and remarks
    if (meterBoundsZone?.position) {
      prompt += `\n\nINSTRUCTIONS DE LECTURE:`
      prompt += `\n1. D'abord, localiser le compteur dans l'image`
      
      const childZonesWithPos = childZones.filter(z => z.positionRelative)
      if (childZonesWithPos.length > 0) {
        prompt += `\n2. Dans la zone du compteur, identifier:`
        childZonesWithPos.forEach(z => {
          if (z.positionRelative) {
            const xStart = Math.round(z.positionRelative.x * 100)
            const xEnd = Math.round((z.positionRelative.x + z.positionRelative.w) * 100)
            const yStart = Math.round(z.positionRelative.y * 100)
            const yEnd = Math.round((z.positionRelative.y + z.positionRelative.h) * 100)
            
            // Position description
            let posDesc = ''
            if (yStart < 33) posDesc = 'partie supérieure'
            else if (yStart < 66) posDesc = 'partie centrale'
            else posDesc = 'partie inférieure'
            
            prompt += `\n   - ${z.label}: ${posDesc} du compteur (${xStart}-${xEnd}% horizontal, ${yStart}-${yEnd}% vertical)`
            
            // Add remark if present
            if (z.remark) {
              prompt += `\n     ⚠️ ${z.remark}`
            }
          }
        })
      }
    }

    return prompt
  }

  // Save
  const handleSave = async () => {
    const finalMeterType = meterType === 'other' ? customMeterType : meterType
    const finalDisplayType = displayType === 'other' ? customDisplayType : displayType
    
    if (!name.trim()) { setError('Le nom est requis'); return }
    if (!finalMeterType) { setError('Le type de compteur est requis'); return }
    if (!photoUrl) { setError('La photo est requise'); return }
    if (!meterBoundsZone?.position) { setError('La zone compteur est requise'); return }
    
    setSaving(true)
    setError(null)
    
    try {
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
            decimalIndicator: finalDecimalIndicator
          },
          reference_photos: [uploadedPhotoUrl],
          zones: zones.map(z => ({
            id: z.id,
            fieldType: z.fieldType,
            label: z.label,
            shape: z.shape,
            position: z.position,
            positionRelative: z.positionRelative,
            remark: z.remark
          })),
          is_verified: false,
          is_active: true,
          prompt_text: promptText // For creating initial prompt version
        })
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erreur lors de la création')

      setSaved(true)
      setShowSuccessModal(true)
    } catch (err: any) { 
      setError(err.message || 'Erreur lors de la sauvegarde') 
    } finally { 
      setSaving(false) 
    }
  }

  // Reset form for new model
  const resetForm = () => {
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
    setCurrentStep(1)
    setSaved(false)
    setShowSuccessModal(false)
    setIntegerDigits(5)
    setDecimalDigits(0)
    setDecimalIndicator('none')
  }

  // Navigation
  const canProceed = (step: number): boolean => { 
    switch (step) { 
      case 1: return !!photoUrl && !!name.trim() && !!(meterType === 'other' ? customMeterType : meterType)
      case 2: return !!meterBoundsZone?.position
      default: return true 
    } 
  }

  const goToStep = (step: number) => { 
    if (step < 1 || step > 2) return
    if (step > currentStep && !canProceed(currentStep)) {
      if (currentStep === 1) {
        if (!photoUrl) { setValidationError('Veuillez ajouter une photo.'); return }
        if (!name.trim()) { setValidationError('Veuillez ajouter un nom.'); return }
        if (!(meterType === 'other' ? customMeterType : meterType)) { setValidationError('Veuillez sélectionner un type.'); return }
      }
      return
    }
    setValidationError(null)
    setCurrentStep(step) 
  }

  const formatPreview = 'X'.repeat(integerDigits) + (decimalDigits > 0 ? ',' + 'X'.repeat(decimalDigits) : '')
  const typeConfig = METER_TYPES.find(t => t.value === meterType)

  // Render zone on photo
  const renderZone = (zone: Zone) => {
    if (!zone.position) return null
    const config = ZONE_TYPES.find(z => z.value === zone.fieldType)
    const isSelected = repositioningZoneId === zone.id
    
    const style: React.CSSProperties = {
      left: `${zone.position.x * 100}%`,
      top: `${zone.position.y * 100}%`,
      width: `${zone.position.w * 100}%`,
      height: `${zone.position.h * 100}%`,
      borderColor: config?.color || '#6B7280',
      backgroundColor: `${config?.color || '#6B7280'}20`,
      borderWidth: isSelected ? 3 : 2,
    }

    if (zone.shape === 'circle') {
      style.borderRadius = '50%'
    } else if (zone.shape === 'square') {
      style.borderRadius = '4px'
    } else {
      style.borderRadius = '4px'
    }

    return (
      <div 
        key={zone.id}
        className={`absolute border-2 ${isSelected ? 'ring-2 ring-white' : ''}`}
        style={style}
        onClick={(e) => { e.stopPropagation(); setSelectedZoneId(zone.id) }}
      >
        <span 
          className="absolute -top-6 left-0 px-2 py-0.5 text-xs text-white rounded whitespace-nowrap"
          style={{ backgroundColor: config?.color || '#6B7280' }}
        >
          {zone.label}
        </span>
      </div>
    )
  }

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

        {/* STEP 1 - PHOTO & INFORMATIONS */}
        {currentStep === 1 && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Photo */}
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-2">Photo de référence</h3>
              <p className="text-gray-500 text-xs mb-3">L'IA analyse la photo pour pré-remplir les informations.</p>
              
              {photoUrl ? (
                <div className="space-y-3">
                  <div className="relative flex justify-center">
                    <div className="relative w-[85%]">
                      <img 
                        src={photoUrl} 
                        alt="Compteur" 
                        className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" 
                        onClick={() => openLightbox(photoUrl)}
                      />
                          <button onClick={removePhoto} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600">
                            <X className="h-4 w-4" />
                          </button>
                          <button onClick={() => openLightbox(photoUrl)} className="absolute bottom-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70">
                            <ZoomIn className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {needsAnalysis ? (
                        <Button onClick={analyzePhoto} disabled={analyzing || checkingDuplicate} className="w-full gap-2 bg-teal-600 hover:bg-teal-700">
                          {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" />Analyse...</> : 
                           checkingDuplicate ? <><Loader2 className="h-4 w-4 animate-spin" />Vérification doublons...</> :
                           <><Sparkles className="h-4 w-4" />Analyser cette photo</>}
                        </Button>
                      ) : (
                        <Button onClick={analyzePhoto} disabled={analyzing || checkingDuplicate} variant="outline" className="w-full gap-2">
                          {analyzing ? <><Loader2 className="h-4 w-4 animate-spin" />Analyse...</> :
                           <><Sparkles className="h-4 w-4" />Réanalyser</>}
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

                {/* Informations */}
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
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: G4 RF1" className={`mt-1 ${justAnalyzed && name ? 'ring-2 ring-teal-300 bg-teal-50' : ''}`} />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Fabricant</Label>
                        <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Ex: Itron" className={`mt-1 ${justAnalyzed && manufacturer ? 'ring-2 ring-teal-300 bg-teal-50' : ''}`} />
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
                      {meterType === 'other' && (
                        <Input value={customMeterType} onChange={(e) => setCustomMeterType(e.target.value)} placeholder="Type personnalisé" className="mt-2" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500">Unité</Label>
                        <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Ex: m³, kWh" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Type d'affichage</Label>
                        <Select value={displayType} onValueChange={setDisplayType}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                          <SelectContent>
                            {DISPLAY_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.image} {d.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* STEP 2 - ZONES & INDEX */}
            {currentStep === 2 && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Photo avec zones */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">
                      Photo
                      {repositioningZoneId && <span className="text-teal-600 ml-2">— Dessinez la zone</span>}
                    </h3>
                    {zones.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setShowZonesOnPhoto(!showZonesOnPhoto)} className="h-8 text-xs gap-1">
                        {showZonesOnPhoto ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {showZonesOnPhoto ? 'Masquer' : 'Afficher'}
                      </Button>
                    )}
                  </div>
                  
                  {photoUrl && (
                    <div 
                      ref={photoContainerRef} 
                      className={`relative select-none ${repositioningZoneId ? 'cursor-crosshair' : ''}`}
                      onMouseDown={handlePhotoMouseDown}
                      onMouseMove={handlePhotoMouseMove}
                      onMouseUp={handlePhotoMouseUp}
                      onMouseLeave={handlePhotoMouseLeave}
                    >
                      <img src={photoUrl} alt="Compteur" className="w-full rounded-lg" draggable={false} />
                      
                      {/* Zones overlay */}
                      {showZonesOnPhoto && zones.map(zone => renderZone(zone))}
                      
                      {!repositioningZoneId && (
                        <button onClick={() => openLightbox(photoUrl)} className="absolute bottom-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70">
                          <ZoomIn className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Shape selector - visible when adding/modifying zone */}
                  {repositioningZoneId && (
                    <div className="mt-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-teal-700">Forme :</span>
                          {ZONE_SHAPES.map(shape => (
                            <Button
                              key={shape.value}
                              variant={selectedShape === shape.value ? 'default' : 'outline'}
                              size="sm"
                              className={`h-8 gap-1 ${selectedShape === shape.value ? 'bg-teal-600' : ''}`}
                              onClick={() => {
                                setSelectedShape(shape.value as any)
                                if (repositioningZoneId) {
                                  updateZone(repositioningZoneId, { shape: shape.value as any })
                                }
                              }}
                            >
                              <shape.icon className="h-3 w-3" />
                              <span className="text-xs">{shape.label}</span>
                            </Button>
                          ))}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs text-gray-500"
                          onClick={() => {
                            setRepositioningZoneId(null)
                            setSelectedZoneType(null)
                            setDragStart(null)
                          }}
                        >
                          Annuler
                        </Button>
                      </div>
                      <p className="text-xs text-teal-600">Cliquez et glissez sur la photo pour dessiner la zone</p>
                    </div>
                  )}
                </Card>

                {/* Zones + Index */}
                <div className="space-y-4">
                  {/* Zones de lecture */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Zones de lecture</h3>
                    
                    {/* Zone compteur (parent) - toujours en premier */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">1. Zone compteur (obligatoire)</span>
                      </div>
                      {!meterBoundsZone ? (
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
                              {meterBoundsZone.position ? (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">✓ Définie</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">À définir</Badge>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startRepositioning(meterBoundsZone.id)}>
                                <Move className="h-3 w-3 mr-1" />{meterBoundsZone.position ? 'Modifier' : 'Dessiner'}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeZone(meterBoundsZone.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Child zones */}
                    <div className={`space-y-2 ${!hasMeterBounds ? 'opacity-50 pointer-events-none' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">2. Zones de données</span>
                      </div>
                      
                      {/* Add zone buttons */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {ZONE_TYPES.filter(t => !t.isParent).map(type => {
                          const exists = zones.find(z => z.fieldType === type.value)
                          return (
                            <Button
                              key={type.value}
                              variant="outline"
                              size="sm"
                              onClick={() => addZone(type.value)}
                              disabled={!!exists || !hasMeterBounds}
                              className="gap-1 h-8"
                              style={{ borderColor: exists ? type.color : undefined }}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }} />
                              {type.label}
                              {exists && <Check className="h-3 w-3 ml-1" />}
                            </Button>
                          )
                        })}
                      </div>

                      {/* Child zones list */}
                      {childZones.map(zone => {
                        const config = ZONE_TYPES.find(z => z.value === zone.fieldType)
                        return (
                          <div 
                            key={zone.id} 
                            className="p-3 border rounded-lg"
                            style={{ borderLeftWidth: 4, borderLeftColor: config?.color || '#6B7280' }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{config?.icon} {zone.label}</span>
                                {zone.position ? (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">✓ Positionné</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">À positionner</Badge>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startRepositioning(zone.id)}>
                                  <Move className="h-3 w-3 mr-1" />{zone.position ? 'Modifier' : 'Dessiner'}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeZone(zone.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Remark field */}
                            <div className="mt-2">
                              <div className="flex items-center gap-1 mb-1">
                                <MessageSquare className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500">Remarque (optionnel)</span>
                              </div>
                              <Input
                                value={zone.remark}
                                onChange={(e) => updateZone(zone.id, { remark: e.target.value })}
                                placeholder="Ex: Ne pas inclure les lettres 'Nr' devant le numéro"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        )
                      })}

                      {childZones.length === 0 && hasMeterBounds && (
                        <p className="text-gray-400 text-sm text-center py-4">
                          Ajoutez des zones pour N° série, Index, etc.
                        </p>
                      )}
                    </div>
                  </Card>

                  {/* Index de consommation */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3">Index de consommation</h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500">Chiffres entiers</Label>
                          <Input type="number" min={1} max={10} value={integerDigits} onChange={(e) => setIntegerDigits(parseInt(e.target.value) || 1)} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Décimales</Label>
                          <Input type="number" min={0} max={5} value={decimalDigits} onChange={(e) => setDecimalDigits(parseInt(e.target.value) || 0)} className="mt-1" />
                        </div>
                      </div>
                      
                      {decimalDigits > 0 && (
                        <div>
                          <Label className="text-xs text-gray-500">Comment repérer les décimales ?</Label>
                          <Select value={decimalIndicator} onValueChange={setDecimalIndicator}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DECIMAL_INDICATORS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {decimalIndicator === 'other' && (
                            <Input value={customDecimalIndicator} onChange={(e) => setCustomDecimalIndicator(e.target.value)} placeholder="Décrivez..." className="mt-2" />
                          )}
                        </div>
                      )}
                      
                      <div className="p-3 bg-gray-50 rounded-lg border text-center">
                        <div className="text-xs text-gray-500 mb-2">Format attendu</div>
                        <div className="font-mono text-xl">
                          <span className="bg-gray-800 text-white px-2 py-1 rounded">{'X'.repeat(integerDigits)}</span>
                          {decimalDigits > 0 && (
                            <>
                              <span className="text-gray-400 mx-1">,</span>
                              <span className="bg-red-500 text-white px-2 py-1 rounded">
                                {'X'.repeat(decimalDigits)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 1}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              {currentStep === 1 ? (
                <Button onClick={() => goToStep(2)} disabled={!canProceed(1)}>
                  Suivant <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={saving || !meterBoundsZone?.position} className="min-w-32">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Enregistrer
                </Button>
              )}
            </div>

        {/* Lightbox */}
        <Dialog open={showImageLightbox} onOpenChange={setShowImageLightbox}>
          <DialogContent className="max-w-4xl p-2">
            <DialogHeader className="sr-only"><DialogTitle>Image agrandie</DialogTitle></DialogHeader>
            {lightboxImageUrl && (
              <div className="relative">
                <img src={lightboxImageUrl} alt="Image agrandie" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70" onClick={() => setShowImageLightbox(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Duplicate Modal */}
        <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                Modèle similaire détecté
              </DialogTitle>
              <DialogDescription>
                Ce compteur semble correspondre à un modèle existant.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 mb-2">Votre photo</p>
                <div className="border rounded-lg p-2 bg-gray-50">
                  {photoUrl && <img src={photoUrl} alt="Nouveau" className="w-full h-48 object-contain rounded" />}
                </div>
                <p className="text-sm text-gray-500 mt-2">{pendingAnalysis?.name || 'Nouveau modèle'}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 mb-2">Modèle existant</p>
                <div className="border rounded-lg p-2 bg-orange-50 border-orange-200">
                  {duplicateMatch?.photo && <img src={duplicateMatch.photo} alt="Existant" className="w-full h-48 object-contain rounded" />}
                </div>
                <p className="text-sm text-gray-900 font-medium mt-2">{duplicateMatch?.name}</p>
                <p className="text-xs text-gray-500">{duplicateMatch?.manufacturer}</p>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <p className="text-sm text-orange-800">
                <strong>Confiance : {duplicateConfidence}%</strong>
                {duplicateReason && <span className="block text-xs mt-1">{duplicateReason}</span>}
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setShowDuplicateModal(false); if (duplicateMatch?.id) router.push(`/dashboard/meters/${duplicateMatch.id}`) }} className="gap-2">
                <ExternalLink className="h-4 w-4" />Voir existant
              </Button>
              <Button variant="outline" onClick={handleCancelAfterDuplicate}>Annuler</Button>
              <Button onClick={handleContinueAfterDuplicate} className="bg-orange-600 hover:bg-orange-700">Continuer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-6 w-6" />
                Modèle créé avec succès !
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 text-center">
              <p className="text-gray-600">Le modèle <strong>{name}</strong> a été créé.</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => router.push('/dashboard/meters')} className="flex-1">
                Retour à la liste
              </Button>
              <Button onClick={resetForm} className="flex-1 bg-teal-600 hover:bg-teal-700">
                Créer un autre modèle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

async function fileToBase64(file: File): Promise<string> { 
  const maxSize = 1 * 1024 * 1024
  if (file.size > maxSize) {
    return compressImage(file, 0.7, 1200)
  }
  return new Promise((resolve) => { 
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(file) 
  }) 
}

async function compressImage(file: File, quality: number = 0.7, maxWidth: number = 1200): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      let width = img.width
      let height = img.height
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
    }
    img.src = URL.createObjectURL(file)
  })
}
