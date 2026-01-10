'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Move, 
  Trash2, 
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  BarChart3,
  Hash,
  QrCode
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

export type ZoneType = 'meter' | 'serial' | 'index' | 'ean'

export interface ROIZone {
  id: string
  type: ZoneType
  label: string
  x: number      // percentage 0-100
  y: number      // percentage 0-100
  width: number  // percentage 0-100
  height: number // percentage 0-100
  note?: string
}

export interface IndexConfig {
  integerDigits: number
  decimalDigits: number
}

interface ROIEditorProps {
  imageUrl: string
  zones: ROIZone[]
  indexConfig: IndexConfig
  onZonesChange: (zones: ROIZone[]) => void
  onIndexConfigChange: (config: IndexConfig) => void
  onSave: () => void
}

// ============================================
// CONSTANTS
// ============================================

const ZONE_CONFIG: Record<ZoneType, { label: string; color: string; icon: React.ReactNode; required?: boolean }> = {
  meter: { label: 'Zone compteur', color: '#64748b', icon: <Eye className="h-4 w-4" />, required: true },
  serial: { label: 'N° série', color: '#3b82f6', icon: <Hash className="h-4 w-4" /> },
  index: { label: 'Index', color: '#22c55e', icon: <BarChart3 className="h-4 w-4" /> },
  ean: { label: 'Code EAN', color: '#8b5cf6', icon: <QrCode className="h-4 w-4" /> },
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ROIEditor({ 
  imageUrl, 
  zones, 
  indexConfig,
  onZonesChange, 
  onIndexConfigChange,
  onSave 
}: ROIEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [currentZone, setCurrentZone] = useState<Partial<ROIZone> | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [activeZoneType, setActiveZoneType] = useState<ZoneType>('index')
  const [showOverlay, setShowOverlay] = useState(true)
  const [scale, setScale] = useState(1)

  // Get position relative to image
  const getRelativePosition = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }, [])

  // Start drawing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    const pos = getRelativePosition(e)
    setDrawing(true)
    setDrawStart(pos)
    setCurrentZone({
      id: crypto.randomUUID(),
      type: activeZoneType,
      label: ZONE_CONFIG[activeZoneType].label,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
    })
  }

  // Continue drawing
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !drawStart) return
    const pos = getRelativePosition(e)
    setCurrentZone(prev => prev ? {
      ...prev,
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      width: Math.abs(pos.x - drawStart.x),
      height: Math.abs(pos.y - drawStart.y),
    } : null)
  }

  // Finish drawing
  const handleMouseUp = () => {
    if (currentZone && currentZone.width && currentZone.height && currentZone.width > 2 && currentZone.height > 2) {
      const newZone: ROIZone = {
        id: currentZone.id!,
        type: currentZone.type!,
        label: currentZone.label!,
        x: currentZone.x!,
        y: currentZone.y!,
        width: currentZone.width!,
        height: currentZone.height!,
      }
      onZonesChange([...zones, newZone])
      setSelectedZoneId(newZone.id)
    }
    setDrawing(false)
    setDrawStart(null)
    setCurrentZone(null)
  }

  // Delete zone
  const deleteZone = (id: string) => {
    onZonesChange(zones.filter(z => z.id !== id))
    if (selectedZoneId === id) setSelectedZoneId(null)
  }

  // Update zone note
  const updateZoneNote = (id: string, note: string) => {
    onZonesChange(zones.map(z => z.id === id ? { ...z, note } : z))
  }

  // Check which zones are defined
  const hasZone = (type: ZoneType) => zones.some(z => z.type === type)
  const meterZone = zones.find(z => z.type === 'meter')
  const serialZone = zones.find(z => z.type === 'serial')
  const indexZone = zones.find(z => z.type === 'index')

  // Format attendu
  const formatPreview = 'X'.repeat(indexConfig.integerDigits) + 
    (indexConfig.decimalDigits > 0 ? ',' + 'X'.repeat(indexConfig.decimalDigits) : '')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Image with zones */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium">Photo</span>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowOverlay(!showOverlay)}
              title={showOverlay ? 'Masquer les zones' : 'Afficher les zones'}
            >
              {showOverlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="ml-1">Masquer</span>
            </Button>
          </div>
        </div>

        <div 
          ref={containerRef}
          className="relative bg-gray-100 rounded-lg overflow-hidden cursor-crosshair select-none"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img 
            src={imageUrl} 
            alt="Compteur" 
            className="w-full h-auto"
            draggable={false}
          />

          {/* Existing zones */}
          {showOverlay && zones.map(zone => (
            <div
              key={zone.id}
              className={`absolute border-2 transition-all ${
                selectedZoneId === zone.id ? 'ring-2 ring-offset-2' : ''
              }`}
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.width}%`,
                height: `${zone.height}%`,
                borderColor: ZONE_CONFIG[zone.type].color,
                backgroundColor: `${ZONE_CONFIG[zone.type].color}20`,
              }}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedZoneId(zone.id)
              }}
            >
              <div 
                className="absolute -top-6 left-0 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
                style={{ backgroundColor: ZONE_CONFIG[zone.type].color }}
              >
                {zone.label}
              </div>
            </div>
          ))}

          {/* Current drawing zone */}
          {currentZone && currentZone.width && currentZone.height && (
            <div
              className="absolute border-2 border-dashed"
              style={{
                left: `${currentZone.x}%`,
                top: `${currentZone.y}%`,
                width: `${currentZone.width}%`,
                height: `${currentZone.height}%`,
                borderColor: ZONE_CONFIG[activeZoneType].color,
                backgroundColor: `${ZONE_CONFIG[activeZoneType].color}20`,
              }}
            />
          )}

          {/* Zoom indicator */}
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            <ZoomIn className="h-3 w-3 inline mr-1" />
            {Math.round(scale * 100)}%
          </div>
        </div>
      </Card>

      {/* Configuration panel */}
      <div className="space-y-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Zones de lecture</h3>
          
          {/* 1. Zone compteur (obligatoire) */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">1. Zone compteur (obligatoire)</p>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <div 
                className="w-5 h-5 rounded flex items-center justify-center"
                style={{ backgroundColor: `${ZONE_CONFIG.meter.color}20`, color: ZONE_CONFIG.meter.color }}
              >
                {ZONE_CONFIG.meter.icon}
              </div>
              <span className="font-medium flex-1">Zone compteur</span>
              {meterZone ? (
                <Badge className="bg-green-100 text-green-700">✓ Définie</Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600 border-orange-300">À définir</Badge>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setActiveZoneType('meter')}
                className={activeZoneType === 'meter' ? 'border-teal-500 bg-teal-50' : ''}
              >
                <Move className="h-4 w-4 mr-1" />
                {meterZone ? 'Modifier' : 'Dessiner'}
              </Button>
              {meterZone && (
                <Button variant="ghost" size="sm" onClick={() => deleteZone(meterZone.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>

          {/* 2. Zones de données */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">2. Zones de données</p>
            
            {/* Zone type selector */}
            <div className="flex gap-2 mb-3">
              {(['serial', 'index', 'ean'] as ZoneType[]).map(type => (
                <Button
                  key={type}
                  variant={activeZoneType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveZoneType(type)}
                  className="gap-1"
                  style={activeZoneType === type ? { backgroundColor: ZONE_CONFIG[type].color } : {}}
                >
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ZONE_CONFIG[type].color }}
                  />
                  {ZONE_CONFIG[type].label}
                  {hasZone(type) && <span>✓</span>}
                </Button>
              ))}
            </div>

            {/* Serial zone */}
            {serialZone && (
              <div className="flex items-center gap-2 p-3 border rounded-lg mb-2" style={{ borderColor: `${ZONE_CONFIG.serial.color}40` }}>
                <div 
                  className="w-5 h-5 rounded flex items-center justify-center"
                  style={{ backgroundColor: `${ZONE_CONFIG.serial.color}20`, color: ZONE_CONFIG.serial.color }}
                >
                  {ZONE_CONFIG.serial.icon}
                </div>
                <span className="font-medium">N° série</span>
                <Badge className="bg-green-100 text-green-700">✓ Positionné</Badge>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setActiveZoneType('serial')}>
                  <Move className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteZone(serialZone.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            )}
            {serialZone && (
              <div className="ml-7 mb-3">
                <Input 
                  placeholder="Ex: Ne pas inclure les lettres 'Nr' devant le numéro"
                  value={serialZone.note || ''}
                  onChange={(e) => updateZoneNote(serialZone.id, e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">💬 Remarque (optionnel)</p>
              </div>
            )}

            {/* Index zone */}
            {indexZone && (
              <div className="flex items-center gap-2 p-3 border rounded-lg mb-2" style={{ borderColor: `${ZONE_CONFIG.index.color}40` }}>
                <div 
                  className="w-5 h-5 rounded flex items-center justify-center"
                  style={{ backgroundColor: `${ZONE_CONFIG.index.color}20`, color: ZONE_CONFIG.index.color }}
                >
                  {ZONE_CONFIG.index.icon}
                </div>
                <span className="font-medium">Index</span>
                <Badge className="bg-green-100 text-green-700">✓ Positionné</Badge>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setActiveZoneType('index')}>
                  <Move className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteZone(indexZone.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            )}
            {indexZone && (
              <div className="ml-7 mb-3">
                <Input 
                  placeholder="Ex: Ne pas inclure les lettres 'Nr' devant le numéro"
                  value={indexZone.note || ''}
                  onChange={(e) => updateZoneNote(indexZone.id, e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">💬 Remarque (optionnel)</p>
              </div>
            )}
          </div>

          {/* Index format configuration */}
          <Card className="p-4 bg-gray-50">
            <h4 className="font-medium mb-3">Index de consommation</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Chiffres entiers</label>
                <Select 
                  value={indexConfig.integerDigits.toString()} 
                  onValueChange={(v) => onIndexConfigChange({ ...indexConfig, integerDigits: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 4, 5, 6, 7, 8].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Décimales</label>
                <Select 
                  value={indexConfig.decimalDigits.toString()} 
                  onValueChange={(v) => onIndexConfigChange({ ...indexConfig, decimalDigits: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-3 bg-white rounded-lg border text-center">
              <p className="text-xs text-muted-foreground mb-1">Format attendu</p>
              <p className="font-mono text-xl font-bold tracking-wider">{formatPreview}</p>
            </div>
          </Card>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => onZonesChange([])}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
          <Button onClick={onSave} className="bg-teal-600 hover:bg-teal-700">
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  )
}
