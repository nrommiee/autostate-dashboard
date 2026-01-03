"use client"

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Trash2, Plus, Square, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// Types
export interface Zone {
  id: string
  fieldType: string
  note: string  // Aide pour Claude
  // Pour rectangle
  x?: number
  y?: number
  width?: number
  height?: number
  // Pour crayon libre (path SVG)
  path?: string
  drawMode: 'rectangle' | 'freehand'
}

interface ZoneMapperProps {
  imageUrl: string
  zones: Zone[]
  onZonesChange: (zones: Zone[]) => void
  fieldTypes: { value: string; label: string; icon: string }[]
}

// Couleurs par type de champ
const ZONE_COLORS: Record<string, { bg: string; border: string }> = {
  serialNumber: { bg: 'rgba(59, 130, 246, 0.3)', border: 'rgb(59, 130, 246)' },
  ean: { bg: 'rgba(168, 85, 247, 0.3)', border: 'rgb(168, 85, 247)' },
  readingSingle: { bg: 'rgba(34, 197, 94, 0.3)', border: 'rgb(34, 197, 94)' },
  readingDay: { bg: 'rgba(251, 191, 36, 0.3)', border: 'rgb(251, 191, 36)' },
  readingNight: { bg: 'rgba(99, 102, 241, 0.3)', border: 'rgb(99, 102, 241)' },
  readingExclusiveNight: { bg: 'rgba(79, 70, 229, 0.3)', border: 'rgb(79, 70, 229)' },
  readingProduction: { bg: 'rgba(249, 115, 22, 0.3)', border: 'rgb(249, 115, 22)' },
  subscribedPower: { bg: 'rgba(239, 68, 68, 0.3)', border: 'rgb(239, 68, 68)' },
  custom: { bg: 'rgba(156, 163, 175, 0.3)', border: 'rgb(156, 163, 175)' },
}

export function ZoneMapper({ imageUrl, zones, onZonesChange, fieldTypes }: ZoneMapperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  
  // État pour la création de zone
  const [isCreating, setIsCreating] = useState(false)
  const [newZone, setNewZone] = useState<Partial<Zone>>({
    fieldType: '',
    note: '',
    drawMode: 'rectangle',
  })
  
  // État pour le dessin
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 })
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [freehandPoints, setFreehandPoints] = useState<{ x: number; y: number }[]>([])
  
  // État pour le redimensionnement
  const [resizing, setResizing] = useState<{ zoneId: string; handle: string } | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)

  // Obtenir la position relative en pourcentage
  const getRelativePosition = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }, [])

  // Démarrer le dessin
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isCreating || !newZone.fieldType) return
    
    const pos = getRelativePosition(e)
    setIsDrawing(true)
    setDrawStart(pos)
    
    if (newZone.drawMode === 'rectangle') {
      setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 })
    } else {
      setFreehandPoints([pos])
    }
  }

  // Continuer le dessin
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return
    
    const pos = getRelativePosition(e)
    
    if (newZone.drawMode === 'rectangle') {
      setCurrentRect({
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        width: Math.abs(pos.x - drawStart.x),
        height: Math.abs(pos.y - drawStart.y),
      })
    } else {
      setFreehandPoints(prev => [...prev, pos])
    }
  }

  // Terminer le dessin
  const handleMouseUp = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    
    // Vérifier que la zone est assez grande
    if (newZone.drawMode === 'rectangle' && currentRect) {
      if (currentRect.width > 2 && currentRect.height > 2) {
        setNewZone(prev => ({
          ...prev,
          x: currentRect.x,
          y: currentRect.y,
          width: currentRect.width,
          height: currentRect.height,
        }))
      }
    } else if (newZone.drawMode === 'freehand' && freehandPoints.length > 5) {
      // Convertir les points en path SVG
      const path = pointsToPath(freehandPoints)
      setNewZone(prev => ({
        ...prev,
        path,
      }))
    }
  }

  // Convertir points en path SVG
  const pointsToPath = (points: { x: number; y: number }[]): string => {
    if (points.length < 2) return ''
    let path = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`
    }
    path += ' Z' // Fermer le path
    return path
  }

  // Valider la zone en cours de création
  const validateZone = () => {
    if (!newZone.fieldType) return
    
    const hasShape = (newZone.drawMode === 'rectangle' && newZone.x !== undefined) ||
                     (newZone.drawMode === 'freehand' && newZone.path)
    
    if (!hasShape) return
    
    const zone: Zone = {
      id: `zone-${Date.now()}`,
      fieldType: newZone.fieldType,
      note: newZone.note || '',
      drawMode: newZone.drawMode || 'rectangle',
      ...(newZone.drawMode === 'rectangle' ? {
        x: newZone.x,
        y: newZone.y,
        width: newZone.width,
        height: newZone.height,
      } : {
        path: newZone.path,
      }),
    }
    
    onZonesChange([...zones, zone])
    resetCreation()
  }

  // Annuler la création
  const resetCreation = () => {
    setIsCreating(false)
    setNewZone({
      fieldType: '',
      note: '',
      drawMode: 'rectangle',
    })
    setCurrentRect(null)
    setFreehandPoints([])
    setIsDrawing(false)
  }

  // Supprimer une zone
  const deleteZone = (zoneId: string) => {
    onZonesChange(zones.filter(z => z.id !== zoneId))
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null)
    }
  }

  // Commencer une nouvelle zone
  const startNewZone = () => {
    setIsCreating(true)
    setSelectedZoneId(null)
  }

  // Obtenir le label du type de champ
  const getFieldLabel = (fieldType: string) => {
    return fieldTypes.find(f => f.value === fieldType)?.label || fieldType
  }

  // Obtenir l'icône du type de champ
  const getFieldIcon = (fieldType: string) => {
    return fieldTypes.find(f => f.value === fieldType)?.icon || '📋'
  }

  // Obtenir les couleurs de la zone
  const getZoneColors = (fieldType: string) => {
    return ZONE_COLORS[fieldType] || ZONE_COLORS.custom
  }

  // Vérifier si la zone a une forme dessinée
  const hasDrawnShape = () => {
    if (newZone.drawMode === 'rectangle') {
      return newZone.x !== undefined && newZone.width && newZone.width > 2
    }
    return !!newZone.path
  }

  return (
    <div className="flex gap-6">
      {/* Image avec zones */}
      <div className="flex-1">
        <div
          ref={containerRef}
          className={`relative border-2 rounded-lg overflow-hidden select-none ${
            isCreating && newZone.fieldType 
              ? 'cursor-crosshair border-teal-500' 
              : 'border-gray-200'
          }`}
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
            onLoad={(e) => {
              const img = e.target as HTMLImageElement
              setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
            }}
          />
          
          {/* Zones existantes */}
          {zones.map(zone => {
            const colors = getZoneColors(zone.fieldType)
            
            if (zone.drawMode === 'freehand' && zone.path) {
              return (
                <svg
                  key={zone.id}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <path
                    d={zone.path}
                    fill={colors.bg}
                    stroke={colors.border}
                    strokeWidth="0.5"
                    className={selectedZoneId === zone.id ? 'animate-pulse' : ''}
                  />
                </svg>
              )
            }
            
            return (
              <div
                key={zone.id}
                className={`absolute border-2 transition-all ${
                  selectedZoneId === zone.id ? 'ring-2 ring-teal-500 ring-offset-2' : ''
                }`}
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                }}
                onClick={() => setSelectedZoneId(zone.id)}
              >
                <span
                  className="absolute -top-6 left-0 text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap"
                  style={{ backgroundColor: colors.border, color: 'white' }}
                >
                  {getFieldIcon(zone.fieldType)} {getFieldLabel(zone.fieldType)}
                </span>
              </div>
            )
          })}
          
          {/* Zone en cours de dessin (rectangle) */}
          {isDrawing && newZone.drawMode === 'rectangle' && currentRect && (
            <div
              className="absolute border-2 border-dashed border-teal-500 bg-teal-500/20 pointer-events-none"
              style={{
                left: `${currentRect.x}%`,
                top: `${currentRect.y}%`,
                width: `${currentRect.width}%`,
                height: `${currentRect.height}%`,
              }}
            />
          )}
          
          {/* Zone en cours de dessin (crayon) */}
          {isDrawing && newZone.drawMode === 'freehand' && freehandPoints.length > 1 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d={pointsToPath(freehandPoints)}
                fill="rgba(20, 184, 166, 0.2)"
                stroke="rgb(20, 184, 166)"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            </svg>
          )}
          
          {/* Zone validée en attente (preview) */}
          {isCreating && !isDrawing && newZone.drawMode === 'rectangle' && newZone.x !== undefined && (
            <div
              className="absolute border-2 border-teal-500 bg-teal-500/30 pointer-events-none"
              style={{
                left: `${newZone.x}%`,
                top: `${newZone.y}%`,
                width: `${newZone.width}%`,
                height: `${newZone.height}%`,
              }}
            >
              <span className="absolute -top-6 left-0 text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap bg-teal-500 text-white">
                {getFieldIcon(newZone.fieldType || '')} {getFieldLabel(newZone.fieldType || '')}
              </span>
            </div>
          )}
          
          {isCreating && !isDrawing && newZone.drawMode === 'freehand' && newZone.path && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d={newZone.path}
                fill="rgba(20, 184, 166, 0.3)"
                stroke="rgb(20, 184, 166)"
                strokeWidth="0.5"
              />
            </svg>
          )}
          
          {/* Message si en mode création */}
          {isCreating && newZone.fieldType && !hasDrawnShape() && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
              <div className="bg-white px-4 py-2 rounded-lg shadow-lg text-sm">
                {newZone.drawMode === 'rectangle' 
                  ? '🖱️ Cliquez et glissez pour dessiner un rectangle'
                  : '✏️ Dessinez librement la zone'
                }
              </div>
            </div>
          )}
        </div>

        {/* Liste des zones créées */}
        {zones.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Zones créées :</h4>
            <div className="space-y-2">
              {zones.map(zone => {
                const colors = getZoneColors(zone.fieldType)
                return (
                  <div
                    key={zone.id}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${
                      selectedZoneId === zone.id 
                        ? 'border-teal-500 bg-teal-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedZoneId(zone.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: colors.border }}
                      />
                      <span className="text-sm">
                        {getFieldIcon(zone.fieldType)} {getFieldLabel(zone.fieldType)}
                      </span>
                      {zone.note && (
                        <span className="text-xs text-gray-400">
                          (avec note)
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteZone(zone.id)
                      }}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Panneau de création/édition */}
      <div className="w-80 shrink-0">
        {!isCreating ? (
          /* Bouton pour créer une nouvelle zone */
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Button onClick={startNewZone} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une zone
            </Button>
            <p className="text-xs text-gray-500 mt-3">
              Définissez les zones de lecture pour aider Claude à reconnaître ce compteur
            </p>
          </div>
        ) : (
          /* Formulaire de création */
          <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Nouvelle zone</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetCreation}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Étape 1: Type de champ */}
            <div className="space-y-2">
              <Label className="text-sm">
                <span className="bg-teal-100 text-teal-700 text-xs px-2 py-0.5 rounded mr-2">1</span>
                Type de champ
              </Label>
              <Select
                value={newZone.fieldType}
                onValueChange={(value) => setNewZone(prev => ({ ...prev, fieldType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
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

            {/* Étape 2: Mode de dessin */}
            {newZone.fieldType && (
              <div className="space-y-2">
                <Label className="text-sm">
                  <span className="bg-teal-100 text-teal-700 text-xs px-2 py-0.5 rounded mr-2">2</span>
                  Mode de dessin
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant={newZone.drawMode === 'rectangle' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setNewZone(prev => ({ ...prev, drawMode: 'rectangle', path: undefined }))
                      setCurrentRect(null)
                      setFreehandPoints([])
                    }}
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Rectangle
                  </Button>
                  <Button
                    variant={newZone.drawMode === 'freehand' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setNewZone(prev => ({ 
                        ...prev, 
                        drawMode: 'freehand', 
                        x: undefined, 
                        y: undefined, 
                        width: undefined, 
                        height: undefined 
                      }))
                      setCurrentRect(null)
                      setFreehandPoints([])
                    }}
                    className="flex-1"
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Crayon
                  </Button>
                </div>
                
                {!hasDrawnShape() && (
                  <p className="text-xs text-gray-500">
                    Dessinez la zone sur l'image à gauche
                  </p>
                )}
                
                {hasDrawnShape() && (
                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded">
                    <Check className="w-4 h-4" />
                    Zone dessinée
                  </div>
                )}
              </div>
            )}

            {/* Étape 3: Note pour Claude */}
            {newZone.fieldType && hasDrawnShape() && (
              <div className="space-y-2">
                <Label className="text-sm">
                  <span className="bg-teal-100 text-teal-700 text-xs px-2 py-0.5 rounded mr-2">3</span>
                  Aide pour Claude
                  <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
                </Label>
                <Textarea
                  value={newZone.note}
                  onChange={(e) => setNewZone(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Ex: Rouleaux noirs = entiers, rouge = décimales. Lire 00001875 comme 1,875 m³"
                  className="text-sm min-h-[80px]"
                />
                <p className="text-xs text-gray-500">
                  Expliquez comment lire cette zone (décimales, format, etc.)
                </p>
              </div>
            )}

            {/* Bouton valider */}
            {newZone.fieldType && hasDrawnShape() && (
              <Button 
                onClick={validateZone}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Valider cette zone
              </Button>
            )}
          </div>
        )}

        {/* Info zone sélectionnée */}
        {selectedZoneId && !isCreating && (
          <div className="mt-4 border rounded-lg p-4 bg-white">
            <h4 className="font-medium mb-2">Zone sélectionnée</h4>
            {(() => {
              const zone = zones.find(z => z.id === selectedZoneId)
              if (!zone) return null
              return (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-gray-500">Type:</span>{' '}
                    {getFieldIcon(zone.fieldType)} {getFieldLabel(zone.fieldType)}
                  </p>
                  {zone.note && (
                    <p>
                      <span className="text-gray-500">Note:</span>{' '}
                      <span className="text-gray-700">{zone.note}</span>
                    </p>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteZone(zone.id)}
                    className="w-full mt-2"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer cette zone
                  </Button>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
