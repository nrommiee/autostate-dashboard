'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RotateCcw, ArrowLeftRight } from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface PreprocessingConfig {
  grayscale: boolean
  contrast: number    // -100 to 100, default 0
  brightness: number  // -100 to 100, default 0
  sharpness: number   // 0 to 100, default 0
  saturation: number  // 0 to 200, default 100
}

interface PreprocessingEditorProps {
  imageUrl: string
  config: PreprocessingConfig
  onChange: (config: PreprocessingConfig) => void
}

const DEFAULT_CONFIG: PreprocessingConfig = {
  grayscale: false,
  contrast: 0,
  brightness: 0,
  sharpness: 0,
  saturation: 100,
}

// ============================================
// SLIDER COMPONENT
// ============================================

function Slider({ 
  label, 
  value, 
  min, 
  max, 
  onChange,
  unit = '%',
  showZero = false 
}: { 
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  unit?: string
  showZero?: boolean
}) {
  const percentage = ((value - min) / (max - min)) * 100
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm">{label}</span>
        <span className="text-sm text-muted-foreground">
          {showZero && value > 0 ? '+' : ''}{value}{unit}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
          style={{
            background: `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
          }}
        />
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PreprocessingEditor({
  imageUrl,
  config,
  onChange,
}: PreprocessingEditorProps) {
  const [showComparison, setShowComparison] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)

  // Apply filters to generate preview
  const applyFilters = useCallback(async () => {
    if (!canvasRef.current || !imageUrl) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      // Set canvas size
      canvas.width = img.width
      canvas.height = img.height

      // Draw original image
      ctx.drawImage(img, 0, 0)

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // Apply filters pixel by pixel
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i]
        let g = data[i + 1]
        let b = data[i + 2]

        // Brightness (-100 to 100)
        if (config.brightness !== 0) {
          const brightness = config.brightness * 2.55 // Convert to 0-255 range
          r = Math.max(0, Math.min(255, r + brightness))
          g = Math.max(0, Math.min(255, g + brightness))
          b = Math.max(0, Math.min(255, b + brightness))
        }

        // Contrast (-100 to 100)
        if (config.contrast !== 0) {
          const factor = (259 * (config.contrast + 255)) / (255 * (259 - config.contrast))
          r = Math.max(0, Math.min(255, factor * (r - 128) + 128))
          g = Math.max(0, Math.min(255, factor * (g - 128) + 128))
          b = Math.max(0, Math.min(255, factor * (b - 128) + 128))
        }

        // Saturation (0 to 200, 100 = normal)
        if (config.saturation !== 100) {
          const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b
          const satFactor = config.saturation / 100
          r = Math.max(0, Math.min(255, gray + satFactor * (r - gray)))
          g = Math.max(0, Math.min(255, gray + satFactor * (g - gray)))
          b = Math.max(0, Math.min(255, gray + satFactor * (b - gray)))
        }

        // Grayscale
        if (config.grayscale) {
          const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b
          r = g = b = gray
        }

        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
      }

      // Apply sharpness using unsharp mask (simplified)
      if (config.sharpness > 0) {
        // For simplicity, we'll use CSS filter for sharpness preview
        // Real sharpening would require convolution matrix
      }

      ctx.putImageData(imageData, 0, 0)
      setProcessedUrl(canvas.toDataURL('image/jpeg', 0.9))
    }

    img.src = imageUrl
  }, [imageUrl, config])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const handleReset = () => {
    onChange(DEFAULT_CONFIG)
  }

  const hasChanges = 
    config.grayscale !== DEFAULT_CONFIG.grayscale ||
    config.contrast !== DEFAULT_CONFIG.contrast ||
    config.brightness !== DEFAULT_CONFIG.brightness ||
    config.sharpness !== DEFAULT_CONFIG.sharpness ||
    config.saturation !== DEFAULT_CONFIG.saturation

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Image preview */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium">Aperçu</span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowComparison(!showComparison)}
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            {showComparison ? 'Masquer original' : 'Comparer'}
          </Button>
        </div>

        <div className="relative">
          {showComparison ? (
            // Side by side comparison
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1 text-center">Avant</p>
                <div className="bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src={imageUrl} 
                    alt="Original" 
                    className="w-full h-auto"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 text-center">Après</p>
                <div className="bg-gray-100 rounded-lg overflow-hidden">
                  {processedUrl ? (
                    <img 
                      src={processedUrl} 
                      alt="Processed" 
                      className="w-full h-auto"
                      style={{
                        filter: config.sharpness > 0 
                          ? `contrast(${1 + config.sharpness / 200})` 
                          : undefined
                      }}
                    />
                  ) : (
                    <img src={imageUrl} alt="Loading..." className="w-full h-auto opacity-50" />
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Single processed image
            <div className="bg-gray-100 rounded-lg overflow-hidden">
              {processedUrl ? (
                <img 
                  src={processedUrl} 
                  alt="Preview" 
                  className="w-full h-auto"
                  style={{
                    filter: config.sharpness > 0 
                      ? `contrast(${1 + config.sharpness / 200})` 
                      : undefined
                  }}
                />
              ) : (
                <img src={imageUrl} alt="Loading..." className="w-full h-auto" />
              )}
            </div>
          )}
        </div>

        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
      </Card>

      {/* Controls */}
      <Card className="p-4 space-y-6">
        <div>
          <h3 className="font-semibold">Couche 1 : Pré-traitement Image</h3>
          <p className="text-sm text-muted-foreground">Améliore la qualité avant analyse</p>
        </div>

        {/* Grayscale toggle */}
        <div className="flex items-center justify-between py-2 border-b">
          <span className="text-sm">Noir & Blanc</span>
          <Switch 
            checked={config.grayscale} 
            onCheckedChange={(checked) => onChange({ ...config, grayscale: checked })}
          />
        </div>

        {/* Sliders */}
        <div className="space-y-6">
          <Slider
            label="Contraste"
            value={config.contrast}
            min={-100}
            max={100}
            onChange={(v) => onChange({ ...config, contrast: v })}
            showZero
          />

          <Slider
            label="Luminosité"
            value={config.brightness}
            min={-100}
            max={100}
            onChange={(v) => onChange({ ...config, brightness: v })}
            showZero
          />

          <Slider
            label="Netteté"
            value={config.sharpness}
            min={0}
            max={100}
            onChange={(v) => onChange({ ...config, sharpness: v })}
          />

          <Slider
            label="Saturation"
            value={config.saturation}
            min={0}
            max={200}
            onChange={(v) => onChange({ ...config, saturation: v })}
          />
        </div>

        {/* Reset button */}
        {hasChanges && (
          <Button variant="outline" onClick={handleReset} className="w-full">
            <RotateCcw className="h-4 w-4 mr-2" />
            Réinitialiser les valeurs par défaut
          </Button>
        )}

      </Card>
    </div>
  )
}
