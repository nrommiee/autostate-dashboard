'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { MeterType, METER_TYPE_CONFIG } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Save, Loader2, CheckCircle, Trash2, ExternalLink, AlertTriangle } from 'lucide-react'

interface ReadingRules {
  id?: string
  serial_format: string
  serial_prefix: string
  reading_total_digits: number
  reading_decimal_digits: number
  decimal_indicator: string
  extraction_tips: string
  common_errors: string[]
  prompt_rules: string
}

export default function EditMeterModelPage() {
  const router = useRouter()
  const params = useParams()
  const modelId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Model data
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [meterType, setMeterType] = useState<MeterType>('water_general')
  const [unit, setUnit] = useState('')
  const [description, setDescription] = useState('')
  const [datasheetUrl, setDatasheetUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isVerified, setIsVerified] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [zones, setZones] = useState<any[]>([])
  const [keywords, setKeywords] = useState<string[]>([])

  // Reading rules
  const [rules, setRules] = useState<ReadingRules>({
    serial_format: '',
    serial_prefix: '',
    reading_total_digits: 7,
    reading_decimal_digits: 3,
    decimal_indicator: 'red_digits',
    extraction_tips: '',
    common_errors: [],
    prompt_rules: ''
  })

  // Stats
  const [usageCount, setUsageCount] = useState(0)
  const [totalScans, setTotalScans] = useState(0)
  const [successCount, setSuccessCount] = useState(0)

  // Corrections
  const [corrections, setCorrections] = useState<any[]>([])

  useEffect(() => {
    loadModel()
  }, [modelId])

  async function loadModel() {
    setLoading(true)
    try {
      // Load model
      const { data: model, error: modelError } = await supabase
        .from('meter_models')
        .select('*')
        .eq('id', modelId)
        .single()

      if (modelError) throw modelError
      if (!model) throw new Error('Modèle non trouvé')

      setName(model.name || '')
      setManufacturer(model.manufacturer || '')
      setMeterType(model.meter_type || 'water_general')
      setUnit(model.unit || '')
      setDescription(model.ai_description || '')
      setDatasheetUrl(model.datasheet_url || '')
      setIsActive(model.is_active ?? true)
      setIsVerified(model.is_verified ?? false)
      setPhotoUrl(model.reference_photos?.[0] || null)
      setZones(model.zones || [])
      setKeywords(model.keywords || [])
      setUsageCount(model.usage_count || 0)
      setTotalScans(model.total_scans || 0)
      setSuccessCount(model.success_count || 0)

      // Load reading rules
      const { data: rulesData } = await supabase
        .from('meter_reading_rules')
        .select('*')
        .eq('model_id', modelId)
        .single()

      if (rulesData) {
        setRules({
          id: rulesData.id,
          serial_format: rulesData.serial_format || '',
          serial_prefix: rulesData.serial_prefix || '',
          reading_total_digits: rulesData.reading_total_digits || 7,
          reading_decimal_digits: rulesData.reading_decimal_digits || 3,
          decimal_indicator: rulesData.decimal_indicator || 'red_digits',
          extraction_tips: rulesData.extraction_tips || '',
          common_errors: rulesData.common_errors || [],
          prompt_rules: rulesData.prompt_rules || ''
        })
      }

      // Load recent corrections
      const { data: correctionsData } = await supabase
        .from('meter_corrections')
        .select('*')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false })
        .limit(10)

      setCorrections(correctionsData || [])

    } catch (err: any) {
      console.error('Error loading:', err)
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
      // Update model
      const { error: modelError } = await supabase
        .from('meter_models')
        .update({
          name,
          manufacturer,
          unit,
          ai_description: description,
          datasheet_url: datasheetUrl || null,
          is_active: isActive,
          is_verified: isVerified,
          updated_at: new Date().toISOString()
        })
        .eq('id', modelId)

      if (modelError) throw modelError

      // Update or insert reading rules
      const rulesPayload = {
        model_id: modelId,
        serial_format: rules.serial_format,
        serial_prefix: rules.serial_prefix,
        reading_total_digits: rules.reading_total_digits,
        reading_decimal_digits: rules.reading_decimal_digits,
        decimal_indicator: rules.decimal_indicator,
        extraction_tips: rules.extraction_tips,
        common_errors: rules.common_errors,
        prompt_rules: rules.prompt_rules,
        updated_at: new Date().toISOString()
      }

      const { error: rulesError } = await supabase
        .from('meter_reading_rules')
        .upsert(rulesPayload, { onConflict: 'model_id' })

      if (rulesError) throw rulesError

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)

    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce modèle définitivement ?')) return

    try {
      const { error } = await supabase
        .from('meter_models')
        .delete()
        .eq('id', modelId)

      if (error) throw error
      router.push('/dashboard/meters')
    } catch (err: any) {
      setError(err.message || 'Erreur suppression')
    }
  }

  function generatePromptRules() {
    let prompt = `Index: ${rules.reading_total_digits - rules.reading_decimal_digits} chiffres + ${rules.reading_decimal_digits} décimales`
    if (rules.decimal_indicator === 'red_digits') {
      prompt += ' (chiffres rouges = décimales)'
    }
    if (rules.serial_prefix) {
      prompt += `. N° série commence par ${rules.serial_prefix}`
    }
    if (rules.serial_format) {
      prompt += `, format: ${rules.serial_format}`
    }
    setRules({ ...rules, prompt_rules: prompt })
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const typeConfig = METER_TYPE_CONFIG[meterType]
  const successRate = totalScans > 0 ? Math.round((successCount / totalScans) * 100) : null

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/meters">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{name}</h1>
            <p className="text-gray-500 text-sm">{manufacturer} • {typeConfig.label}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-1" /> Supprimer
        </Button>
      </div>

      {error && (
        <Card className="p-3 mb-4 bg-red-50 border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </Card>
      )}

      {saved && (
        <Card className="p-3 mb-4 bg-green-50 border-green-200 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> Enregistré
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {/* Left column - Photo & Stats */}
        <div className="space-y-4">
          {photoUrl && (
            <Card className="p-3">
              <img src={photoUrl} alt={name} className="w-full rounded-lg" />
            </Card>
          )}

          <Card className="p-3">
            <h3 className="font-semibold text-sm mb-2">Statistiques</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Utilisations</span>
                <span className="font-medium">{usageCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Scans totaux</span>
                <span className="font-medium">{totalScans}</span>
              </div>
              {successRate !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Taux succès</span>
                  <span className={`font-medium ${
                    successRate >= 80 ? 'text-green-600' : 
                    successRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>{successRate}%</span>
                </div>
              )}
            </div>
          </Card>

          {zones.length > 0 && (
            <Card className="p-3">
              <h3 className="font-semibold text-sm mb-2">Zones ({zones.length})</h3>
              <div className="flex flex-wrap gap-1">
                {zones.map((z: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">{z.label}</Badge>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Non modifiables. Recréez le modèle si besoin.</p>
            </Card>
          )}

          {/* Recent corrections */}
          {corrections.length > 0 && (
            <Card className="p-3">
              <h3 className="font-semibold text-sm mb-2">Corrections récentes</h3>
              <div className="space-y-1 text-xs">
                {corrections.slice(0, 5).map((c: any) => (
                  <div key={c.id} className="flex justify-between p-1.5 bg-gray-50 rounded">
                    <span className="text-red-500 line-through">{c.ai_value}</span>
                    <span className="text-green-600">{c.human_value}</span>
                  </div>
                ))}
              </div>
              <Badge variant="outline" className="mt-2 text-xs">
                {corrections.length} correction{corrections.length > 1 ? 's' : ''} enregistrée{corrections.length > 1 ? 's' : ''}
              </Badge>
            </Card>
          )}
        </div>

        {/* Right column - Form */}
        <div className="md:col-span-2 space-y-4">
          {/* Basic info */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">Informations</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nom *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Fabricant</Label>
                <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Unité</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs">Fiche technique (URL)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={datasheetUrl} onChange={(e) => setDatasheetUrl(e.target.value)} placeholder="https://..." />
                {datasheetUrl && (
                  <a href={datasheetUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label className="text-sm">Actif</Label>
                <p className="text-xs text-gray-500">Utilisé pour la reconnaissance</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Vérifié</Label>
                <p className="text-xs text-gray-500">Validé manuellement</p>
              </div>
              <Switch checked={isVerified} onCheckedChange={setIsVerified} />
            </div>
          </Card>

          {/* Reading rules */}
          <Card className="p-4 space-y-3">
            <h2 className="font-semibold">Règles de lecture</h2>
            <p className="text-gray-500 text-xs">Ces règles aident l'IA à mieux extraire les données.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Format N° série</Label>
                <Input 
                  value={rules.serial_format} 
                  onChange={(e) => setRules({ ...rules, serial_format: e.target.value })}
                  placeholder="ex: 8 chiffres"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Préfixe N° série</Label>
                <Input 
                  value={rules.serial_prefix} 
                  onChange={(e) => setRules({ ...rules, serial_prefix: e.target.value })}
                  placeholder="ex: 266"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Chiffres total index</Label>
                <Input 
                  type="number"
                  value={rules.reading_total_digits} 
                  onChange={(e) => setRules({ ...rules, reading_total_digits: parseInt(e.target.value) || 7 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Dont décimales</Label>
                <Input 
                  type="number"
                  value={rules.reading_decimal_digits} 
                  onChange={(e) => setRules({ ...rules, reading_decimal_digits: parseInt(e.target.value) || 3 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Indicateur décimales</Label>
                <Select value={rules.decimal_indicator} onValueChange={(v) => setRules({ ...rules, decimal_indicator: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red_digits">Chiffres rouges</SelectItem>
                    <SelectItem value="comma">Virgule</SelectItem>
                    <SelectItem value="dot">Point</SelectItem>
                    <SelectItem value="last_wheel">Dernière roue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Conseils d'extraction</Label>
              <Textarea 
                value={rules.extraction_tips} 
                onChange={(e) => setRules({ ...rules, extraction_tips: e.target.value })}
                placeholder="ex: Les 3 derniers chiffres sont en rouge et représentent les décimales"
                rows={2}
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Règles pour le prompt (généré)</Label>
                <Button variant="outline" size="sm" onClick={generatePromptRules}>
                  Générer
                </Button>
              </div>
              <Textarea 
                value={rules.prompt_rules} 
                onChange={(e) => setRules({ ...rules, prompt_rules: e.target.value })}
                rows={2}
                className="mt-1 font-mono text-xs"
                placeholder="Règles courtes pour le prompt Claude..."
              />
              <p className="text-xs text-gray-400 mt-1">Ce texte sera injecté dans le prompt d'analyse.</p>
            </div>
          </Card>

          {/* Save button */}
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
