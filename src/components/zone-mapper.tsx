"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Trash2, Move, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

// Types
export interface Zone {
  id: string
  fieldType: string
  label: string
  x: number      // percentage 0-100
  y: number      // percentage 0-100
  width: number  // percentage 0-100
  height: number // percentage 0-100
  hasDecimals: boolean
  decimalDigits?: number
}

interface ZoneMapperProps {
  imageUrl: string
  zones: Zone[]
  onZonesChange: (zones: Zone[]) => void
  fieldTypes: { value: string; label: string; icon: string }[]
}

type DrawingState = {
  isDrawing: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function ZoneMapper({ imageUrl, zones, onZonesChange, fieldTypes }: ZoneMapperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  })
  const [mode, setMode] = useState<'select' | 'draw'>('draw')
  const [dragging, setDragging] = useState<{ zoneId: string; offsetX: number; offsetY: number } | null>(null)

  // Convert pixel coordinates to percentage
  const toPercentage = useCallback((pixelX: number, pixelY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, (pixelX / rect.width) * 100)),
      y: Math.max(0, Math.min(100, (pixelY / rect.height) * 100)),
    }
  }, [])

  // Get mouse position relative to container
  const getRelativePosition = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  // Start drawing a new zone
  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'draw') return
    
    const pos = getRelativePosition(e)
    const pct = toPercentage(pos.x, pos.y)
    
    setDrawing({
      isDrawing: true,
      startX: pct.x,
      startY: pct.y,
      currentX: pct.x,
      currentY: pct.y,
    })
    setSelectedZoneId(null)
  }

  // Update drawing rectangle
  const handleMouseMove = (e: React.MouseEvent) => {
    if (drawing.isDrawing) {
      const pos = getRelativePosition(e)
      const pct = toPercentage(pos.x, pos.y)
      setDrawing(prev => ({
        ...prev,
        currentX: pct.x,
        currentY: pct.y,
      }))
    }
    
    if (dragging) {
      const pos = getRelativePosition(e)
      const pct = toPercentage(pos.x, pos.y)
      
      onZonesChange(zones.map(z => {
        if (z.id === dragging.zoneId) {
          return {
            ...z,
            x: Math.max(0, Math.min(100 - z.width, pct.x - dragging.offsetX)),
            y: Math.max(0, Math.min(100 - z.height, pct.y - dragging.offsetY)),
          }
        }
        return z
      }))
    }
  }

  // Finish drawing
  const handleMouseUp = () => {
    if (drawing.isDrawing) {
      const width = Math.abs(drawing.currentX - drawing.startX)
      const height = Math.abs(drawing.currentY - drawing.startY)
      
      // Only create zone if it's big enough (at least 3% in each dimension)
      if (width > 3 && height > 3) {
        const newZone: Zone = {
          id: `zone-${Date.now()}`,
          fieldType: 'serialNumber',
          label: 'Nouvelle zone',
          x: Math.min(drawing.startX, drawing.currentX),
          y: Math.min(drawing.startY, drawing.currentY),
          width,
          height,
          hasDecimals: false,
        }
        onZonesChange([...zones, newZone])
        setSelectedZoneId(newZone.id)
      }
      
      setDrawing({
        isDrawing: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      })
    }
    
    setDragging(null)
  }

  // Select a zone
  const handleZoneClick = (e: React.MouseEvent, zoneId: string) => {
    e.stopPropagation()
    setSelectedZoneId(zoneId)
    
    if (mode === 'select') {
      const zone = zones.find(z => z.id === zoneId)
      if (zone) {
        const pos = getRelativePosition(e)
        const pct = toPercentage(pos.x, pos.y)
        setDragging({
          zoneId,
          offsetX: pct.x - zone.x,
          offsetY: pct.y - zone.y,
        })
      }
    }
  }

  // Delete selected zone
  const deleteSelectedZone = () => {
    if (selectedZoneId) {
      onZonesChange(zones.filter(z => z.id !== selectedZoneId))
      setSelectedZoneId(null)
    }
  }

  // Update zone properties
  const updateZone = (zoneId: string, updates: Partial<Zone>) => {
    onZonesChange(zones.map(z => z.id === zoneId ? { ...z, ...updates } : z))
  }

  const selectedZone = zones.find(z => z.id === selectedZoneId)

  // Get drawing rectangle coordinates
  const getDrawingRect = () => {
    if (!drawing.isDrawing) return null
    return {
      x: Math.min(drawing.startX, drawing.currentX),
      y: Math.min(drawing.startY, drawing.currentY),
      width: Math.abs(drawing.currentX - drawing.startX),
      height: Math.abs(drawing.currentY - drawing.startY),
    }
  }

  const drawingRect = getDrawingRect()

  // Zone colors based on field type
  const getZoneColor = (fieldType: string) => {
    const colors: Record<string, string> = {
      serialNumber: 'rgba(59, 130, 246, 0.5)',      // blue
      ean: 'rgba(168, 85, 247, 0.5)',               // purple
      readingSingle: 'rgba(34, 197, 94, 0.5)',     // green
      readingDay: 'rgba(251, 191, 36, 0.5)',       // yellow
      readingNight: 'rgba(99, 102, 241, 0.5)',     // indigo
      readingExclusiveNight: 'rgba(79, 70, 229, 0.5)', // darker indigo
      readingProduction: 'rgba(249, 115, 22, 0.5)', // orange
      subscribedPower: 'rgba(239, 68, 68, 0.5)',   // red
      custom: 'rgba(156, 163, 175, 0.5)',          // gray
    }
    return colors[fieldType] || colors.custom
  }

  const getZoneBorderColor = (fieldType: string) => {
    const colors: Record<string, string> = {
      serialNumber: 'rgb(59, 130, 246)',
      ean: 'rgb(168, 85, 247)',
      readingSingle: 'rgb(34, 197, 94)',
      readingDay: 'rgb(251, 191, 36)',
      readingNight: 'rgb(99, 102, 241)',
      readingExclusiveNight: 'rgb(79, 70, 229)',
      readingProduction: 'rgb(249, 115, 22)',
      subscribedPower: 'rgb(239, 68, 68)',
      custom: 'rgb(156, 163, 175)',
    }
    return colors[fieldType] || colors.custom
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'draw' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('draw')}
          >
            <Plus className="w-4 h-4 mr-1" />
            Dessiner
          </Button>
          <Button
            variant={mode === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('select')}
          >
            <Move className="w-4 h-4 mr-1" />
            Déplacer
          </Button>
        </div>
        
        {selectedZoneId && (
          <Button
            variant="destructive"
            size="sm"
            onClick={deleteSelectedZone}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Supprimer
          </Button>
        )}
      </div>

      {/* Image with zones overlay */}
      <div className="flex gap-4">
        <div
          ref={containerRef}
          className="relative flex-1 border rounded-lg overflow-hidden cursor-crosshair select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Compteur"
            className="w-full h-auto pointer-events-none"
            draggable={false}
          />
          
          {/* Existing zones */}
          {zones.map(zone => (
            <div
              key={zone.id}
              className={`absolute border-2 transition-all ${
                selectedZoneId === zone.id 
                  ? 'ring-2 ring-offset-2 ring-teal-500' 
                  : ''
              }`}
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.width}%`,
                height: `${zone.height}%`,
                backgroundColor: getZoneColor(zone.fieldType),
                borderColor: getZoneBorderColor(zone.fieldType),
                cursor: mode === 'select' ? 'move' : 'pointer',
              }}
              onClick={(e) => handleZoneClick(e, zone.id)}
            >
              <span 
                className="absolute -top-6 left-0 text-xs font-medium px-1 py-0.5 rounded whitespace-nowrap"
                style={{ 
                  backgroundColor: getZoneBorderColor(zone.fieldType),
                  color: 'white',
                }}
              >
                {zone.label || fieldTypes.find(f => f.value === zone.fieldType)?.label}
              </span>
            </div>
          ))}
          
          {/* Drawing preview */}
          {drawingRect && (
            <div
              className="absolute border-2 border-dashed border-teal-500 bg-teal-500/20 pointer-events-none"
              style={{
                left: `${drawingRect.x}%`,
                top: `${drawingRect.y}%`,
                width: `${drawingRect.width}%`,
                height: `${drawingRect.height}%`,
              }}
            />
          )}
        </div>

        {/* Zone properties panel */}
        {selectedZone && (
          <div className="w-72 border rounded-lg p-4 space-y-4 bg-gray-50">
            <h4 className="font-medium">Propriétés de la zone</h4>
            
            <div className="space-y-2">
              <Label>Type de champ</Label>
              <Select
                value={selectedZone.fieldType}
                onValueChange={(value) => updateZone(selectedZone.id, { fieldType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Libellé personnalisé</Label>
              <Input
                value={selectedZone.label}
                onChange={(e) => updateZone(selectedZone.id, { label: e.target.value })}
                placeholder="Ex: Index principal"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Décimales</Label>
              <Switch
                checked={selectedZone.hasDecimals}
                onCheckedChange={(checked) => updateZone(selectedZone.id, { 
                  hasDecimals: checked,
                  decimalDigits: checked ? 3 : undefined,
                })}
              />
            </div>

            {selectedZone.hasDecimals && (
              <div className="space-y-2">
                <Label>Nombre de décimales</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={selectedZone.decimalDigits || 3}
                  onChange={(e) => updateZone(selectedZone.id, { 
                    decimalDigits: parseInt(e.target.value) || 3 
                  })}
                />
              </div>
            )}

            <div className="pt-2 border-t text-xs text-gray-500">
              <p>Position: {selectedZone.x.toFixed(1)}%, {selectedZone.y.toFixed(1)}%</p>
              <p>Taille: {selectedZone.width.toFixed(1)}% × {selectedZone.height.toFixed(1)}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <p className="text-sm text-gray-500">
        {mode === 'draw' 
          ? '🎯 Cliquez et glissez sur l\'image pour dessiner une zone de lecture'
          : '✋ Cliquez sur une zone et glissez pour la déplacer'
        }
      </p>
    </div>
  )
}
