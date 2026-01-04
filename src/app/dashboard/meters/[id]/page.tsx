'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { MeterModel, MeterType, METER_TYPE_CONFIG } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Save, Loader2, CheckCircle, Trash2 } from 'lucide-react'

export default function EditMeterModelPage() {
  const router = useRouter()
  const params = useParams()
  const modelId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form data
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [meterType, setMeterType] = useState<MeterType>('water_general')
  const [unit, setUnit] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isVerified, setIsVerified] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [zones, setZones] = useState<any[]>([])
  const [keywords, setKeywords] = useState<string[]>([])

  // Stats
  const [usageCount, setUsageCount] = useState(0)
  const [successRate, setSuccessRate] = useState(0)

  useEffect(() => {
    loadModel()
  }, [modelId])

  async function loadModel() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('meter_models')
        .select('*')
        .eq('id', modelId)
        .single()

      if (error) throw error
      if (!data) throw new Error('Modèle non trouvé')

      setName(data.name || '')
      setManufacturer(data.manufacturer || '')
      setMeterType(data.meter_type || 'water_general')
      setUnit(data.unit || '')
      setDescription(data.ai_description || '')
      setIsActive(data.is_active ?? true)
      setIsVerified(data.is_verified ?? false)
      setPhotoUrl(data.reference_photos?.[0] || null)
      setZones(data.zones || [])
      setKeywords(data.keywords || [])
      setUsageCount(data.usage_count || 0)
      setSuccessRate(data.total_scans > 0 ? (data.success_count / data.total_scans) * 100 : 0)

    } catch (err: any) {
      console.error('Error loading model:', err)
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('meter_models')
        .update({
          name,
          manufacturer,
          unit,
          ai_description: description,
          is_active: isActive,
          is_verified: isVerified,
          updated_at: new Date().toISOString()
        })
        .eq('id', modelId)

      if (error) throw error

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)

    } catch (err: any) {
      console.error('Error saving:', err)
      setError(err.message || 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce modèle ? Cette action est irréversible.')) return

    try {
      const { error } = await supabase
        .from('meter_models')
        .delete()
        .eq('id', modelId)

      if (error) throw error
      router.push('/dashboard/meters')

    } catch (err: any) {
      console.error('Error deleting:', err)
      setError(err.message || 'Erreur de suppression')
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const typeConfig = METER_TYPE_CONFIG[meterType]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/meters">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Modifier le modèle</h1>
            <p className="text-gray-500 text-sm">{name}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" /> Supprimer
        </Button>
      </div>

      {error && <Card className="p-3 mb-4 bg-red-50 border-red-200 text-red-700 text-sm">{error}</Card>}
      
      {saved && (
        <Card className="p-3 mb-4 bg-green-50 border-green-200 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> Modifications enregistrées
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Photo & Stats */}
        <div className="space-y-4">
          {photoUrl && (
            <Card className="p-4">
              <img src={photoUrl} alt={name} className="w-full rounded-lg" />
            </Card>
          )}

          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3">Statistiques</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Utilisations</span>
                <span className="font-medium">{usageCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Taux de succès</span>
                <span className={`font-medium ${successRate >= 80 ? 'text-green-600' : successRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {successRate.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span>{typeConfig.icon} {typeConfig.label}</span>
              </div>
            </div>
          </Card>

          {zones.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Zones ({zones.length})</h3>
              <div className="space-y-1">
                {zones.map((zone: any, i: number) => (
                  <Badge key={i} variant="outline" className="mr-1 mb-1 text-xs">
                    {zone.label || zone.field_type}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Les zones ne peuvent pas être modifiées. Créez un nouveau modèle si nécessaire.</p>
            </Card>
          )}
        </div>

        {/* Right: Form */}
        <Card className="md:col-span-2 p-6 space-y-4">
          <h2 className="font-semibold">Informations</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Fabricant</Label>
              <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-sm">Unité</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label className="text-sm">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1"
              placeholder="Description technique..."
            />
          </div>

          {keywords.length > 0 && (
            <div>
              <Label className="text-sm">Mots-clés</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {keywords.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Actif</Label>
                <p className="text-xs text-gray-500">Le modèle sera utilisé pour la reconnaissance</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Vérifié</Label>
                <p className="text-xs text-gray-500">Le modèle a été validé manuellement</p>
              </div>
              <Switch checked={isVerified} onCheckedChange={setIsVerified} />
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
