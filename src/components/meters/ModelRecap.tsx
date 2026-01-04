'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MeterZone, MeterType, METER_TYPE_CONFIG, METER_FIELD_CONFIG } from '@/lib/supabase'
import { Keyword } from './KeywordsSelector'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'

interface ModelRecapProps {
  name: string
  manufacturer: string
  meterType: MeterType
  unit: string
  keywords: Keyword[]
  zones: MeterZone[]
  photoUrl: string | null
  description?: string
}

export function ModelRecap({
  name,
  manufacturer,
  meterType,
  unit,
  keywords,
  zones,
  photoUrl,
  description
}: ModelRecapProps) {
  const typeConfig = METER_TYPE_CONFIG[meterType]
  const validatedKeywords = keywords.filter(k => k.validated)
  
  // Calculate completeness score
  const calculateScore = () => {
    let score = 0
    let total = 0

    // Name (required) - 20 points
    total += 20
    if (name.trim()) score += 20

    // Manufacturer - 10 points
    total += 10
    if (manufacturer.trim()) score += 10

    // Photo - 20 points
    total += 20
    if (photoUrl) score += 20

    // Keywords - 15 points (at least 3 validated)
    total += 15
    if (validatedKeywords.length >= 3) score += 15
    else if (validatedKeywords.length >= 1) score += 7

    // Zones - 25 points (at least 1 serial + 1 reading)
    total += 25
    const hasSerial = zones.some(z => z.fieldType === 'serialNumber')
    const hasReading = zones.some(z => METER_FIELD_CONFIG[z.fieldType].isReading)
    if (hasSerial && hasReading) score += 25
    else if (hasSerial || hasReading) score += 12

    // Description - 10 points
    total += 10
    if (description && description.length > 20) score += 10

    return Math.round((score / total) * 100)
  }

  const score = calculateScore()

  // Validation checks
  const checks = [
    { label: 'Nom du modèle', valid: !!name.trim(), required: true },
    { label: 'Fabricant', valid: !!manufacturer.trim(), required: false },
    { label: 'Photo de référence', valid: !!photoUrl, required: true },
    { label: 'Mots-clés validés (min. 3)', valid: validatedKeywords.length >= 3, required: false },
    { label: 'Zone numéro de compteur', valid: zones.some(z => z.fieldType === 'serialNumber'), required: false },
    { label: 'Zone index/relevé', valid: zones.some(z => METER_FIELD_CONFIG[z.fieldType].isReading), required: true }
  ]

  const requiredMissing = checks.filter(c => c.required && !c.valid)
  const canSave = requiredMissing.length === 0

  // Generate AI context
  const aiContext = generateAIContext({ name, manufacturer, meterType, unit, keywords: validatedKeywords, zones, description })

  return (
    <div className="space-y-6">
      {/* Score card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Score de complétude</h3>
          <div className={`text-3xl font-bold ${score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {score}%
          </div>
        </div>

        <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${score}%` }}
          />
        </div>

        <div className="space-y-2">
          {checks.map((check, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {check.valid ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : check.required ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <Info className="h-4 w-4 text-gray-400" />
              )}
              <span className={check.valid ? 'text-gray-700' : check.required ? 'text-red-700' : 'text-gray-500'}>
                {check.label}{check.required && !check.valid && ' *'}
              </span>
            </div>
          ))}
        </div>

        {!canSave && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Les éléments marqués * sont obligatoires pour enregistrer le modèle.
          </div>
        )}
      </Card>

      {/* Summary card */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Récapitulatif du modèle</h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            {photoUrl ? (
              <img src={photoUrl} alt="Photo de référence" className="w-full rounded-lg border" />
            ) : (
              <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                Pas de photo
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold">{name || 'Sans nom'}</div>
              <div className="text-gray-500">{manufacturer || 'Fabricant non spécifié'}</div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-2xl">{typeConfig?.icon}</span>
              <Badge style={{ backgroundColor: typeConfig?.color, color: 'white' }}>
                {typeConfig?.label}
              </Badge>
              <span className="text-gray-500">({unit})</span>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Mots-clés ({validatedKeywords.length})</div>
              <div className="flex flex-wrap gap-1">
                {validatedKeywords.slice(0, 10).map(k => (
                  <Badge key={k.id} variant="outline" className="text-xs">{k.value}</Badge>
                ))}
                {validatedKeywords.length > 10 && (
                  <Badge variant="outline" className="text-xs">+{validatedKeywords.length - 10}</Badge>
                )}
                {validatedKeywords.length === 0 && (
                  <span className="text-sm text-gray-400 italic">Aucun mot-clé validé</span>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Zones ({zones.length})</div>
              <div className="space-y-1">
                {zones.map(zone => (
                  <div key={zone.id} className="flex items-center gap-2 text-sm">
                    <span>{METER_FIELD_CONFIG[zone.fieldType].icon}</span>
                    <span>{zone.label}</span>
                    {zone.hasDecimals && <span className="text-gray-400">({zone.decimalDigits} déc.)</span>}
                    {zone.position && <Badge variant="outline" className="text-xs">Position</Badge>}
                  </div>
                ))}
                {zones.length === 0 && (
                  <span className="text-sm text-gray-400 italic">Aucune zone</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* AI context preview */}
      <Card className="p-6">
        <h3 className="font-semibold mb-2">Contexte IA généré</h3>
        <p className="text-sm text-gray-500 mb-4">
          Ce texte sera utilisé par l'IA pour reconnaître ce modèle de compteur :
        </p>
        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap">
          {aiContext}
        </div>
      </Card>
    </div>
  )
}

function generateAIContext({
  name, manufacturer, meterType, unit, keywords, zones, description
}: {
  name: string
  manufacturer: string
  meterType: MeterType
  unit: string
  keywords: Keyword[]
  zones: MeterZone[]
  description?: string
}): string {
  const lines: string[] = []

  lines.push(`MODÈLE: ${name}`)
  lines.push(`FABRICANT: ${manufacturer || 'Non spécifié'}`)
  lines.push(`TYPE: ${METER_TYPE_CONFIG[meterType].label}`)
  lines.push(`UNITÉ: ${unit}`)
  lines.push('')

  if (keywords.length > 0) {
    lines.push(`MOTS-CLÉS D'IDENTIFICATION:`)
    lines.push(keywords.map(k => `- ${k.value}`).join('\n'))
    lines.push('')
  }

  if (zones.length > 0) {
    lines.push(`ZONES DE LECTURE:`)
    zones.forEach(z => {
      let zoneDesc = `- ${z.label} (${METER_FIELD_CONFIG[z.fieldType].label})`
      if (z.hasDecimals) zoneDesc += ` [${z.decimalDigits} décimales]`
      lines.push(zoneDesc)
    })
    lines.push('')
  }

  if (description) {
    lines.push(`DESCRIPTION:`)
    lines.push(description)
  }

  return lines.join('\n')
}

export default ModelRecap
