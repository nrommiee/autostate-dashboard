'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MeterZone, MeterFieldType, METER_FIELD_CONFIG } from '@/lib/supabase'
import { Plus, Trash2, Sparkles, Move, Loader2 } from 'lucide-react'

interface ZoneEditorProps {
  photoUrl: string | null
  zones: MeterZone[]
  onChange: (zones: MeterZone[]) => void
  onSuggestZones?: () => Promise<MeterZone[]>
  disabled?: boolean
}

// Zone colors for visual distinction
const ZONE_COLORS: Record<MeterFieldType, string> = {
  serialNumber: '#3B82F6', // blue
  ean: '#8B5CF6', // purple
  readingSingle: '#10B981', // green
  readingDay: '#F59E0B', // amber
  readingNight: '#6366F1', // indigo
  readingExclusiveNight: '#EC4899', // pink
  readingProduction: '#14B8A6', // teal
  subscribedPower: '#EF4444', // red
  custom: '#6B7280', // gray
}

export function ZoneEditor({
  photoUrl,
  zones,
  onChange,
  onSuggestZones,
  disabled
}: ZoneEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [pendingFieldType, setPendingFieldType] = useState<MeterFieldType | null>(null)
  const [suggesting, setSuggesting] = useState(false)

  // Create new zone
  const createZone = (fieldType: MeterFieldType): MeterZone => ({
    id: crypto.randomUUID(),
    fieldType,
    label: METER_FIELD_CONFIG[fieldType].label,
    hasDecimals: METER_FIELD_CONFIG[fieldType].isReading,
    decimalDigits: METER_FIELD_CONFIG[fieldType].isReading ? 2 : undefined
  })

  // Add zone without position (for manual config)
  const addZoneManual = (fieldType: MeterFieldType) => {
    onChange([...zones, createZone(fieldType)])
  }

  // Start drawing mode
  const startDrawing = (fieldType: MeterFieldType) => {
    setPendingFieldType(fieldType)
    setIsDrawing(true)
  }

  // Handle mouse down on image
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !pendingFieldType || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    setDrawStart({ x, y })
  }

  // Handle mouse up on image
  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !pendingFieldType || !drawStart || !containerRef.current) {
      setIsDrawing(false)
      setDrawStart(null)
      setPendingFieldType(null)
      return
    }

    const rect = containerRef.current.getBoundingClientRect()
    const endX = (e.clientX - rect.left) / rect.width
    const endY = (e.clientY - rect.top) / rect.height

    // Calculate zone bounds
    const x = Math.min(drawStart.x, endX)
    const y = Math.min(drawStart.y, endY)
    const width = Math.abs(endX - drawStart.x)
    const height = Math.abs(endY - drawStart.y)

    // Only create zone if it has meaningful size
    if (width > 0.02 && height > 0.02) {
      const newZone: MeterZone = {
        ...createZone(pendingFieldType),
        position: {
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
          width: Math.min(1 - x, width),
          height: Math.min(1 - y, height)
        }
      }
      onChange([...zones, newZone])
    }

    setIsDrawing(false)
    setDrawStart(null)
    setPendingFieldType(null)
  }

  // Remove zone
  const removeZone = (id: string) => {
    onChange(zones.filter(z => z.id !== id))
    if (selectedZoneId === id) setSelectedZoneId(null)
  }

  // Update zone
  const updateZone = (id: string, updates: Partial<MeterZone>) => {
    onChange(zones.map(z => {
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

  // Suggest zones with AI
  const handleSuggestZones = async () => {
    if (!onSuggestZones) return

    setSuggesting(true)
    try {
      const suggested = await onSuggestZones()
      if (suggested.length > 0) {
        onChange([...zones, ...suggested])
      }
    } catch (err) {
      console.error('Error suggesting zones:', err)
    } finally {
      setSuggesting(false)
    }
  }

  const selectedZone = zones.find(z => z.id === selectedZoneId)

  return (
    <div className="space-y-6">
      {/* Zone type buttons */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">Ajouter une zone</h3>
            <p className="text-xs text-gray-500">
              Cliquez sur un type puis dessinez sur la photo, ou ajoutez sans position
            </p>
          </div>
          {onSuggestZones && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSuggestZones}
              disabled={suggesting || disabled || !photoUrl}
              className="gap-2"
            >
              {suggesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Suggestion IA
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(METER_FIELD_CONFIG).map(([type, config]) => {
            const fieldType = type as MeterFieldType
            const hasZone = zones.some(z => z.fieldType === fieldType)
            
            return (
              <div key={type} className="flex">
                <Button
                  type="button"
                  variant={pendingFieldType === fieldType ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => photoUrl ? startDrawing(fieldType) : addZoneManual(fieldType)}
                  disabled={disabled}
                  className="rounded-r-none gap-1"
                  style={{
                    borderColor: hasZone ? ZONE_COLORS[fieldType] : undefined,
                    backgroundColor: pendingFieldType === fieldType ? ZONE_COLORS[fieldType] : undefined
                  }}
                >
                  <span>{config.icon}</span>
                  <span className="hidden sm:inline">{config.label}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addZoneManual(fieldType)}
                  disabled={disabled}
                  className="rounded-l-none border-l-0 px-2"
                  title="Ajouter sans position"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>

        {isDrawing && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            🎯 Mode dessin actif: Dessinez un rectangle sur la photo pour placer la zone "{METER_FIELD_CONFIG[pendingFieldType!].label}"
          </div>
        )}
      </Card>

      {/* Photo with zones overlay */}
      {photoUrl && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Zones sur la photo</h3>
          
          <div
            ref={containerRef}
            className={`relative select-none ${isDrawing ? 'cursor-crosshair' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          >
            <img
              src={photoUrl}
              alt="Photo du compteur"
              className="w-full rounded-lg"
              draggable={false}
            />

            {/* Render zones */}
            {zones.map((zone) => zone.position && (
              <div
                key={zone.id}
                className={`absolute border-2 rounded cursor-pointer transition-all ${
                  selectedZoneId === zone.id ? 'ring-2 ring-offset-1' : ''
                }`}
                style={{
                  left: `${zone.position.x * 100}%`,
                  top: `${zone.position.y * 100}%`,
                  width: `${zone.position.width * 100}%`,
                  height: `${zone.position.height * 100}%`,
                  borderColor: ZONE_COLORS[zone.fieldType],
                  backgroundColor: `${ZONE_COLORS[zone.fieldType]}20`,
                  ringColor: ZONE_COLORS[zone.fieldType]
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedZoneId(zone.id)
                }}
              >
                <div
                  className="absolute -top-5 left-0 px-1.5 py-0.5 text-xs font-medium text-white rounded-t whitespace-nowrap"
                  style={{ backgroundColor: ZONE_COLORS[zone.fieldType] }}
                >
                  {zone.label}
                </div>
              </div>
            ))}

            {/* Drawing preview */}
            {isDrawing && drawStart && (
              <div
                className="absolute border-2 border-dashed pointer-events-none"
                style={{
                  left: `${drawStart.x * 100}%`,
                  top: `${drawStart.y * 100}%`,
                  borderColor: pendingFieldType ? ZONE_COLORS[pendingFieldType] : '#666'
                }}
              />
            )}
          </div>
        </Card>
      )}

      {/* Zones list */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-3">
          Zones configurées ({zones.length})
        </h3>

        {zones.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucune zone configurée. Cliquez sur un type de zone ci-dessus pour commencer.
          </div>
        ) : (
          <div className="space-y-3">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className={`p-3 border rounded-lg transition-all ${
                  selectedZoneId === zone.id ? 'ring-2 border-teal-300' : 'bg-gray-50'
                }`}
                onClick={() => setSelectedZoneId(zone.id)}
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: ZONE_COLORS[zone.fieldType]
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Field type */}
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={zone.fieldType}
                        onValueChange={(v) => updateZone(zone.id, { fieldType: v as MeterFieldType })}
                        disabled={disabled}
                      >
                        <SelectTrigger className="h-9">
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
                        disabled={disabled}
                        className="h-9"
                      />
                    </div>

                    {/* Decimals */}
                    <div className="space-y-1">
                      <Label className="text-xs">Décimales</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={zone.hasDecimals}
                          onCheckedChange={(v) => updateZone(zone.id, { hasDecimals: v })}
                          disabled={disabled}
                        />
                        {zone.hasDecimals && (
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={zone.decimalDigits || 2}
                            onChange={(e) => updateZone(zone.id, { decimalDigits: parseInt(e.target.value) })}
                            disabled={disabled}
                            className="w-16 h-9"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Position indicator & remove */}
                  <div className="flex items-center gap-2">
                    {zone.position && (
                      <Badge variant="outline" className="text-xs">
                        <Move className="h-3 w-3 mr-1" />
                        Position
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeZone(zone.id)
                      }}
                      disabled={disabled}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Zone note/format */}
                {selectedZoneId === zone.id && (
                  <div className="mt-3 pt-3 border-t">
                    <Label className="text-xs">Note (aide pour la lecture)</Label>
                    <Input
                      placeholder="ex: Ignorer les chiffres rouges, Format: 8 chiffres..."
                      value={(zone as any).note || ''}
                      onChange={(e) => updateZone(zone.id, { ...zone, note: e.target.value } as any)}
                      disabled={disabled}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default ZoneEditor
