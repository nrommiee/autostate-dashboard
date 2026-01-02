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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { X, Upload, Sparkles, Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

// Helper to create empty zone
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
  
  // Pre-fill from unrecognized meter if coming from there
  const fromUnrecognized = searchParams.get('fromUnrecognized')
  const prefilledPhoto = searchParams.get('photo')
  const prefilledType = searchParams.get('type') as MeterType | null

  // Form state
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [meterType, setMeterType] = useState<MeterType>(prefilledType || 'water_general')
  const [unit, setUnit] = useState(prefilledType ? METER_TYPE_CONFIG[prefilledType]?.unit || 'm³' : 'm³')
  const [aiDescription, setAiDescription] = useState('')
  const [zones, setZones] = useState<MeterZone[]>([createEmptyZone('serialNumber')])
  const [isVerified, setIsVerified] = useState(false)
  
  // Photos state
  const [photos, setPhotos] = useState<File[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>(prefilledPhoto ? [prefilledPhoto] : [])
  
  // AI analysis state
  const [analyzing, setAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  
  // Submission state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle photo upload
  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    // Add to photos array
    setPhotos(prev => [...prev, ...files])
    
    // Create preview URLs
    files.forEach(file => {
      const url = URL.createObjectURL(file)
      setPhotoUrls(prev => [...prev, url])
    })
  }, [])

  // Remove photo
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoUrls(prev => {
      // Revoke object URL to prevent memory leak
      if (prev[index]?.startsWith('blob:')) {
        URL.revokeObjectURL(prev[index])
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  // Analyze with Claude
  const analyzeWithClaude = async () => {
    if (photoUrls.length === 0) {
      setError('Veuillez ajouter au moins une photo')
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      // Convert photos to base64
      const photoBase64s = await Promise.all(
        photos.map(async (file) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1]
              resolve(base64)
            }
            reader.readAsDataURL(file)
          })
        })
      )

      // Call our API route
      const response = await fetch('/api/analyze-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          photos: photoBase64s,
          existingType: meterType 
        })
      })

      if (!response.ok) {
        throw new Error('Erreur lors de l\'analyse')
      }

      const result = await response.json()
      setAiAnalysis(result)

      // Auto-fill form with AI suggestions
      if (result.name) setName(result.name)
      if (result.manufacturer) setManufacturer(result.manufacturer)
      if (result.meterType) {
        setMeterType(result.meterType)
        setUnit(METER_TYPE_CONFIG[result.meterType as MeterType]?.unit || 'm³')
      }
      if (result.description) setAiDescription(result.description)
      if (result.suggestedZones && result.suggestedZones.length > 0) {
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
      console.error('Analysis error:', err)
      setError('Erreur lors de l\'analyse Claude. Veuillez réessayer.')
    } finally {
      setAnalyzing(false)
    }
  }

  // Add zone
  const addZone = () => {
    setZones(prev => [...prev, createEmptyZone('readingSingle')])
  }

  // Remove zone
  const removeZone = (id: string) => {
    setZones(prev => prev.filter(z => z.id !== id))
  }

  // Update zone
  const updateZone = (id: string, updates: Partial<MeterZone>) => {
    setZones(prev => prev.map(z => {
      if (z.id !== id) return z
      
      // If fieldType changed, update label too
      if (updates.fieldType && updates.fieldType !== z.fieldType) {
        return {
          ...z,
          ...updates,
          label: METER_FIELD_CONFIG[updates.fieldType].label
        }
      }
      
      return { ...z, ...updates }
    }))
  }

  // Save model
  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Le nom du modèle est requis')
      return
    }
    if (zones.length === 0) {
      setError('Au moins une zone est requise')
      return
    }
    if (photoUrls.length === 0) {
      setError('Au moins une photo de référence est requise')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Upload photos to Supabase Storage
      const uploadedUrls: string[] = []
      
      for (const file of photos) {
        const formData = new FormData()
        formData.append('file', file)
        
        const uploadResponse = await fetch('/api/upload-meter-photo', {
          method: 'POST',
          body: formData
        })
        
        if (!uploadResponse.ok) {
          throw new Error('Erreur upload photo')
        }
        
        const { url } = await uploadResponse.json()
        uploadedUrls.push(url)
      }

      // Create meter model
      const response = await fetch('/api/meter-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          manufacturer,
          meter_type: meterType,
          unit,
          ai_description: aiDescription,
          ai_analysis_data: aiAnalysis || {},
          reference_photos: uploadedUrls,
          zones,
          is_verified: isVerified,
          is_active: true,
          from_unrecognized_id: fromUnrecognized
        })
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la création')
      }

      // Redirect to meters list
      router.push('/dashboard/meters')

    } catch (err) {
      console.error('Save error:', err)
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/meters">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nouveau modèle de compteur</h1>
          <p className="text-gray-500">
            Ajoutez des photos et laissez Claude analyser le compteur
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {/* From unrecognized banner */}
      {fromUnrecognized && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2">
            <span className="text-xl">📸</span>
            <div>
              <p className="font-medium text-blue-900">
                Création depuis un compteur non reconnu
              </p>
              <p className="text-sm text-blue-700">
                La photo a été pré-chargée. Vous pouvez en ajouter d'autres.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Photos section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Photos de référence</h2>
            <p className="text-sm text-gray-500">
              Ajoutez des photos claires du compteur sous différents angles
            </p>
          </div>
          <Button
            onClick={analyzeWithClaude}
            disabled={analyzing || photoUrls.length === 0}
            className="gap-2"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {analyzing ? 'Analyse...' : 'Analyser avec Claude'}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Photo previews */}
          {photoUrls.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border"
              />
              <button
                onClick={() => removePhoto(index)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Upload button */}
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors">
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">Ajouter</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* AI Analysis result */}
        {aiAnalysis && (
          <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-purple-900">Analyse Claude</span>
            </div>
            <p className="text-sm text-purple-700">
              {aiAnalysis.rawAnalysis || 'Analyse terminée. Les champs ont été pré-remplis.'}
            </p>
          </div>
        )}
      </Card>

      {/* Basic info */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Informations générales</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du modèle *</Label>
            <Input
              id="name"
              placeholder="ex: Itron Aquadis+"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manufacturer">Fabricant</Label>
            <Input
              id="manufacturer"
              placeholder="ex: Itron"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type de compteur *</Label>
            <Select value={meterType} onValueChange={(v) => {
              setMeterType(v as MeterType)
              setUnit(METER_TYPE_CONFIG[v as MeterType]?.unit || 'm³')
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METER_TYPE_CONFIG).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    {config.icon} {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unité</Label>
            <Input
              id="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (générée par IA)</Label>
          <Textarea
            id="description"
            placeholder="Description du compteur..."
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={isVerified}
            onCheckedChange={setIsVerified}
          />
          <Label>Marquer comme vérifié manuellement</Label>
        </div>
      </Card>

      {/* Zones configuration */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Zones de lecture</h2>
            <p className="text-sm text-gray-500">
              Définissez les champs à extraire de ce compteur
            </p>
          </div>
          <Button variant="outline" onClick={addZone} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter une zone
          </Button>
        </div>

        <div className="space-y-3">
          {zones.map((zone, index) => (
            <div
              key={zone.id}
              className="flex items-start gap-3 p-4 border rounded-lg bg-gray-50"
            >
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Field type */}
                <div className="space-y-1">
                  <Label className="text-xs">Type de champ</Label>
                  <Select
                    value={zone.fieldType}
                    onValueChange={(v) => updateZone(zone.id, { fieldType: v as MeterFieldType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(METER_FIELD_CONFIG).map(([type, config]) => (
                        <SelectItem key={type} value={type}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Label */}
                <div className="space-y-1">
                  <Label className="text-xs">Libellé</Label>
                  <Input
                    value={zone.label}
                    onChange={(e) => updateZone(zone.id, { label: e.target.value })}
                    placeholder="Libellé..."
                  />
                </div>

                {/* Decimals */}
                <div className="space-y-1">
                  <Label className="text-xs">Décimales</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={zone.hasDecimals}
                      onCheckedChange={(v) => updateZone(zone.id, { hasDecimals: v })}
                    />
                    {zone.hasDecimals && (
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={zone.decimalDigits || 2}
                        onChange={(e) => updateZone(zone.id, { decimalDigits: parseInt(e.target.value) })}
                        className="w-20"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Remove button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeZone(zone.id)}
                disabled={zones.length === 1}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {zones.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Aucune zone configurée. Cliquez sur "Ajouter une zone" pour commencer.
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href="/dashboard/meters">
          <Button variant="outline">Annuler</Button>
        </Link>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Enregistrement...' : 'Créer le modèle'}
        </Button>
      </div>
    </div>
  )
}
