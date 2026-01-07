/**
 * Image Analysis Utilities for Labs
 * Extracts EXIF metadata and analyzes image quality
 */

// =====================================================
// TYPES
// =====================================================

export interface ExifData {
  iso?: number
  aperture?: string
  shutter_speed?: string
  flash?: boolean
  flash_mode?: string
  orientation?: number
  focal_length?: string
  gps_latitude?: number
  gps_longitude?: number
  white_balance?: string
  date_taken?: string
  device_make?: string
  device_model?: string
  image_width?: number
  image_height?: number
}

export interface ImageAnalysis {
  brightness_score: number // 0-100
  sharpness_score: number // 0-100
  contrast_score: number // 0-100
  reflection_detected: boolean
  reflection_zones: Array<{ x: number; y: number; width: number; height: number }>
  shadow_zones: Array<{ x: number; y: number; width: number; height: number }>
  dominant_color: string
  quality_score: number // 0-100 overall
  quality_issues: string[]
}

export interface QualityPrediction {
  score: number
  level: 'excellent' | 'good' | 'fair' | 'poor'
  issues: string[]
  suggestions: string[]
}

// =====================================================
// EXIF EXTRACTION
// =====================================================

/**
 * Extract EXIF metadata from an image file
 */
export async function extractExifData(file: File): Promise<ExifData> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer
      const exif = parseExifFromBuffer(buffer)
      resolve(exif)
    }
    
    reader.onerror = () => {
      resolve({}) // Return empty on error
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Parse EXIF data from ArrayBuffer
 * Simplified parser for common EXIF tags
 */
function parseExifFromBuffer(buffer: ArrayBuffer): ExifData {
  const view = new DataView(buffer)
  const exif: ExifData = {}
  
  // Check for JPEG
  if (view.getUint16(0) !== 0xFFD8) {
    return exif
  }
  
  let offset = 2
  const length = view.byteLength
  
  while (offset < length) {
    if (view.getUint8(offset) !== 0xFF) {
      offset++
      continue
    }
    
    const marker = view.getUint8(offset + 1)
    
    // APP1 marker (EXIF)
    if (marker === 0xE1) {
      const exifLength = view.getUint16(offset + 2)
      const exifStart = offset + 4
      
      // Check for "Exif\0\0"
      const exifHeader = String.fromCharCode(
        view.getUint8(exifStart),
        view.getUint8(exifStart + 1),
        view.getUint8(exifStart + 2),
        view.getUint8(exifStart + 3)
      )
      
      if (exifHeader === 'Exif') {
        const tiffStart = exifStart + 6
        const littleEndian = view.getUint16(tiffStart) === 0x4949
        
        // Parse IFD0
        const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian)
        parseIFD(view, tiffStart, tiffStart + ifd0Offset, littleEndian, exif)
        
        // Look for EXIF IFD pointer
        const exifIFDPointer = findTag(view, tiffStart, tiffStart + ifd0Offset, 0x8769, littleEndian)
        if (exifIFDPointer) {
          parseIFD(view, tiffStart, tiffStart + exifIFDPointer, littleEndian, exif)
        }
        
        // Look for GPS IFD pointer
        const gpsIFDPointer = findTag(view, tiffStart, tiffStart + ifd0Offset, 0x8825, littleEndian)
        if (gpsIFDPointer) {
          parseGPSIFD(view, tiffStart, tiffStart + gpsIFDPointer, littleEndian, exif)
        }
      }
      
      break
    }
    
    // Skip other markers
    if (marker >= 0xE0 && marker <= 0xEF) {
      offset += 2 + view.getUint16(offset + 2)
    } else {
      offset++
    }
  }
  
  return exif
}

function parseIFD(view: DataView, tiffStart: number, ifdStart: number, littleEndian: boolean, exif: ExifData) {
  try {
    const entries = view.getUint16(ifdStart, littleEndian)
    
    for (let i = 0; i < entries; i++) {
      const entryOffset = ifdStart + 2 + (i * 12)
      const tag = view.getUint16(entryOffset, littleEndian)
      const type = view.getUint16(entryOffset + 2, littleEndian)
      const count = view.getUint32(entryOffset + 4, littleEndian)
      const valueOffset = entryOffset + 8
      
      switch (tag) {
        case 0x010F: // Make
          exif.device_make = readString(view, tiffStart, valueOffset, count, littleEndian)
          break
        case 0x0110: // Model
          exif.device_model = readString(view, tiffStart, valueOffset, count, littleEndian)
          break
        case 0x0112: // Orientation
          exif.orientation = view.getUint16(valueOffset, littleEndian)
          break
        case 0x829A: // ExposureTime
          const expNum = view.getUint32(valueOffset, littleEndian)
          const expDen = view.getUint32(valueOffset + 4, littleEndian)
          exif.shutter_speed = expDen > 1 ? `1/${Math.round(expDen / expNum)}` : `${expNum / expDen}`
          break
        case 0x829D: // FNumber
          const fNum = view.getUint32(valueOffset, littleEndian)
          const fDen = view.getUint32(valueOffset + 4, littleEndian)
          exif.aperture = `f/${(fNum / fDen).toFixed(1)}`
          break
        case 0x8827: // ISO
          exif.iso = view.getUint16(valueOffset, littleEndian)
          break
        case 0x9209: // Flash
          const flashValue = view.getUint16(valueOffset, littleEndian)
          exif.flash = (flashValue & 0x01) === 1
          exif.flash_mode = getFlashMode(flashValue)
          break
        case 0x920A: // FocalLength
          const flNum = view.getUint32(valueOffset, littleEndian)
          const flDen = view.getUint32(valueOffset + 4, littleEndian)
          exif.focal_length = `${(flNum / flDen).toFixed(1)}mm`
          break
        case 0x9003: // DateTimeOriginal
          exif.date_taken = readString(view, tiffStart, valueOffset, count, littleEndian)
          break
      }
    }
  } catch (e) {
    // Silently fail on parse errors
  }
}

function parseGPSIFD(view: DataView, tiffStart: number, ifdStart: number, littleEndian: boolean, exif: ExifData) {
  try {
    const entries = view.getUint16(ifdStart, littleEndian)
    let latRef = 'N', lonRef = 'E'
    let lat: number[] = [], lon: number[] = []
    
    for (let i = 0; i < entries; i++) {
      const entryOffset = ifdStart + 2 + (i * 12)
      const tag = view.getUint16(entryOffset, littleEndian)
      const valueOffset = entryOffset + 8
      
      switch (tag) {
        case 0x0001: latRef = String.fromCharCode(view.getUint8(valueOffset)); break
        case 0x0003: lonRef = String.fromCharCode(view.getUint8(valueOffset)); break
        case 0x0002: lat = readGPSCoord(view, tiffStart, valueOffset, littleEndian); break
        case 0x0004: lon = readGPSCoord(view, tiffStart, valueOffset, littleEndian); break
      }
    }
    
    if (lat.length === 3) {
      exif.gps_latitude = (lat[0] + lat[1] / 60 + lat[2] / 3600) * (latRef === 'S' ? -1 : 1)
    }
    if (lon.length === 3) {
      exif.gps_longitude = (lon[0] + lon[1] / 60 + lon[2] / 3600) * (lonRef === 'W' ? -1 : 1)
    }
  } catch (e) {
    // Silently fail
  }
}

function findTag(view: DataView, tiffStart: number, ifdStart: number, targetTag: number, littleEndian: boolean): number | null {
  try {
    const entries = view.getUint16(ifdStart, littleEndian)
    for (let i = 0; i < entries; i++) {
      const entryOffset = ifdStart + 2 + (i * 12)
      const tag = view.getUint16(entryOffset, littleEndian)
      if (tag === targetTag) {
        return view.getUint32(entryOffset + 8, littleEndian)
      }
    }
  } catch (e) {}
  return null
}

function readString(view: DataView, tiffStart: number, valueOffset: number, count: number, littleEndian: boolean): string {
  try {
    let str = ''
    const offset = count > 4 ? tiffStart + view.getUint32(valueOffset, littleEndian) : valueOffset
    for (let i = 0; i < count - 1; i++) {
      const char = view.getUint8(offset + i)
      if (char === 0) break
      str += String.fromCharCode(char)
    }
    return str.trim()
  } catch (e) {
    return ''
  }
}

function readGPSCoord(view: DataView, tiffStart: number, valueOffset: number, littleEndian: boolean): number[] {
  const offset = tiffStart + view.getUint32(valueOffset, littleEndian)
  return [
    view.getUint32(offset, littleEndian) / view.getUint32(offset + 4, littleEndian),
    view.getUint32(offset + 8, littleEndian) / view.getUint32(offset + 12, littleEndian),
    view.getUint32(offset + 16, littleEndian) / view.getUint32(offset + 20, littleEndian)
  ]
}

function getFlashMode(value: number): string {
  const modes: Record<number, string> = {
    0x00: 'No Flash',
    0x01: 'Fired',
    0x05: 'Fired, Return not detected',
    0x07: 'Fired, Return detected',
    0x08: 'On, Did not fire',
    0x09: 'On, Fired',
    0x0D: 'On, Return not detected',
    0x0F: 'On, Return detected',
    0x10: 'Off, Did not fire',
    0x14: 'Off, Did not fire, Return not detected',
    0x18: 'Auto, Did not fire',
    0x19: 'Auto, Fired',
    0x1D: 'Auto, Fired, Return not detected',
    0x1F: 'Auto, Fired, Return detected',
  }
  return modes[value] || 'Unknown'
}

// =====================================================
// IMAGE ANALYSIS
// =====================================================

/**
 * Analyze image quality from canvas or image element
 */
export async function analyzeImage(imageSource: HTMLImageElement | HTMLCanvasElement): Promise<ImageAnalysis> {
  // Create canvas for analysis
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  
  const width = imageSource instanceof HTMLImageElement ? imageSource.naturalWidth : imageSource.width
  const height = imageSource instanceof HTMLImageElement ? imageSource.naturalHeight : imageSource.height
  
  // Use smaller size for faster analysis
  const maxAnalysisSize = 512
  const scale = Math.min(1, maxAnalysisSize / Math.max(width, height))
  canvas.width = width * scale
  canvas.height = height * scale
  
  ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height)
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  
  // Calculate metrics
  const brightnessScore = calculateBrightness(data)
  const contrastScore = calculateContrast(data)
  const sharpnessScore = calculateSharpness(imageData)
  const { detected: reflectionDetected, zones: reflectionZones } = detectReflections(imageData)
  const shadowZones = detectShadows(imageData)
  const dominantColor = getDominantColor(data)
  
  // Calculate quality score and issues
  const { qualityScore, issues } = calculateQualityScore({
    brightnessScore,
    contrastScore,
    sharpnessScore,
    reflectionDetected,
    shadowZones: shadowZones.length
  })
  
  return {
    brightness_score: brightnessScore,
    sharpness_score: sharpnessScore,
    contrast_score: contrastScore,
    reflection_detected: reflectionDetected,
    reflection_zones: reflectionZones,
    shadow_zones: shadowZones,
    dominant_color: dominantColor,
    quality_score: qualityScore,
    quality_issues: issues
  }
}

function calculateBrightness(data: Uint8ClampedArray): number {
  let total = 0
  const pixelCount = data.length / 4
  
  for (let i = 0; i < data.length; i += 4) {
    // Luminance formula
    total += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }
  
  const avgBrightness = total / pixelCount
  return Math.round(avgBrightness / 255 * 100)
}

function calculateContrast(data: Uint8ClampedArray): number {
  let min = 255, max = 0
  
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (luminance < min) min = luminance
    if (luminance > max) max = luminance
  }
  
  // Contrast as range percentage
  return Math.round((max - min) / 255 * 100)
}

function calculateSharpness(imageData: ImageData): number {
  const { data, width, height } = imageData
  let totalGradient = 0
  let count = 0
  
  // Sobel-like edge detection
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      
      // Get luminance values around pixel
      const getL = (dx: number, dy: number) => {
        const i = ((y + dy) * width + (x + dx)) * 4
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      
      // Horizontal gradient
      const gx = getL(1, 0) - getL(-1, 0)
      // Vertical gradient
      const gy = getL(0, 1) - getL(0, -1)
      
      totalGradient += Math.sqrt(gx * gx + gy * gy)
      count++
    }
  }
  
  // Normalize to 0-100
  const avgGradient = totalGradient / count
  return Math.min(100, Math.round(avgGradient / 1.5))
}

function detectReflections(imageData: ImageData): { detected: boolean; zones: Array<{ x: number; y: number; width: number; height: number }> } {
  const { data, width, height } = imageData
  const zones: Array<{ x: number; y: number; width: number; height: number }> = []
  const threshold = 245 // Very bright pixels
  const gridSize = 32
  
  // Divide into grid and check for high brightness concentrations
  for (let gy = 0; gy < height; gy += gridSize) {
    for (let gx = 0; gx < width; gx += gridSize) {
      let brightPixels = 0
      let totalPixels = 0
      
      for (let y = gy; y < Math.min(gy + gridSize, height); y++) {
        for (let x = gx; x < Math.min(gx + gridSize, width); x++) {
          const idx = (y * width + x) * 4
          const brightness = Math.max(data[idx], data[idx + 1], data[idx + 2])
          if (brightness > threshold) brightPixels++
          totalPixels++
        }
      }
      
      // If more than 30% of grid is very bright, mark as reflection
      if (brightPixels / totalPixels > 0.3) {
        zones.push({
          x: gx / width,
          y: gy / height,
          width: gridSize / width,
          height: gridSize / height
        })
      }
    }
  }
  
  return { detected: zones.length > 0, zones }
}

function detectShadows(imageData: ImageData): Array<{ x: number; y: number; width: number; height: number }> {
  const { data, width, height } = imageData
  const zones: Array<{ x: number; y: number; width: number; height: number }> = []
  const threshold = 30 // Very dark pixels
  const gridSize = 32
  
  for (let gy = 0; gy < height; gy += gridSize) {
    for (let gx = 0; gx < width; gx += gridSize) {
      let darkPixels = 0
      let totalPixels = 0
      
      for (let y = gy; y < Math.min(gy + gridSize, height); y++) {
        for (let x = gx; x < Math.min(gx + gridSize, width); x++) {
          const idx = (y * width + x) * 4
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
          if (brightness < threshold) darkPixels++
          totalPixels++
        }
      }
      
      if (darkPixels / totalPixels > 0.5) {
        zones.push({
          x: gx / width,
          y: gy / height,
          width: gridSize / width,
          height: gridSize / height
        })
      }
    }
  }
  
  return zones
}

function getDominantColor(data: Uint8ClampedArray): string {
  let r = 0, g = 0, b = 0
  const count = data.length / 4
  
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  
  r = Math.round(r / count)
  g = Math.round(g / count)
  b = Math.round(b / count)
  
  return `rgb(${r}, ${g}, ${b})`
}

function calculateQualityScore(metrics: {
  brightnessScore: number
  contrastScore: number
  sharpnessScore: number
  reflectionDetected: boolean
  shadowZones: number
}): { qualityScore: number; issues: string[] } {
  const issues: string[] = []
  let score = 100
  
  // Brightness issues
  if (metrics.brightnessScore < 20) {
    score -= 30
    issues.push('Image très sombre - augmentez la luminosité')
  } else if (metrics.brightnessScore < 35) {
    score -= 15
    issues.push('Image sombre - considérez augmenter la luminosité')
  } else if (metrics.brightnessScore > 85) {
    score -= 20
    issues.push('Image surexposée - risque de perte de détails')
  }
  
  // Contrast issues
  if (metrics.contrastScore < 30) {
    score -= 20
    issues.push('Contraste faible - augmentez le contraste')
  } else if (metrics.contrastScore < 50) {
    score -= 10
    issues.push('Contraste modéré - un peu plus de contraste pourrait aider')
  }
  
  // Sharpness issues
  if (metrics.sharpnessScore < 20) {
    score -= 25
    issues.push('Image floue - les chiffres risquent d\'être illisibles')
  } else if (metrics.sharpnessScore < 40) {
    score -= 15
    issues.push('Netteté moyenne - considérez reprendre la photo')
  }
  
  // Reflection issues
  if (metrics.reflectionDetected) {
    score -= 20
    issues.push('Reflets détectés - peuvent gêner la lecture')
  }
  
  // Shadow issues
  if (metrics.shadowZones > 5) {
    score -= 15
    issues.push('Zones d\'ombre importantes')
  }
  
  return { qualityScore: Math.max(0, score), issues }
}

// =====================================================
// QUALITY PREDICTION
// =====================================================

/**
 * Get quality prediction with level and suggestions
 */
export function getQualityPrediction(analysis: ImageAnalysis, exif: ExifData): QualityPrediction {
  const suggestions: string[] = []
  
  // Add EXIF-based suggestions
  if (exif.iso && exif.iso > 800) {
    suggestions.push('ISO élevé détecté - photo probablement prise en basse lumière')
  }
  
  if (exif.flash === true) {
    suggestions.push('Flash utilisé - attention aux reflets sur la vitre du compteur')
  }
  
  // Add analysis-based suggestions
  if (analysis.brightness_score < 35) {
    suggestions.push('Augmentez le contraste pour compenser la faible luminosité')
  }
  
  if (analysis.sharpness_score < 40) {
    suggestions.push('Activez la netteté pour améliorer la lisibilité')
  }
  
  if (analysis.reflection_detected) {
    suggestions.push('Essayez de prendre la photo sous un angle différent pour éviter les reflets')
  }
  
  // Determine level
  let level: QualityPrediction['level']
  if (analysis.quality_score >= 80) level = 'excellent'
  else if (analysis.quality_score >= 60) level = 'good'
  else if (analysis.quality_score >= 40) level = 'fair'
  else level = 'poor'
  
  return {
    score: analysis.quality_score,
    level,
    issues: analysis.quality_issues,
    suggestions
  }
}

// =====================================================
// COST CALCULATION
// =====================================================

export interface PricingInfo {
  cost_per_1m_input: number
  cost_per_1m_output: number
}

/**
 * Calculate cost from tokens
 */
export function calculateCost(
  tokensInput: number,
  tokensOutput: number,
  pricing: PricingInfo = { cost_per_1m_input: 3.00, cost_per_1m_output: 15.00 }
): { input: number; output: number; total: number } {
  const input = (tokensInput / 1_000_000) * pricing.cost_per_1m_input
  const output = (tokensOutput / 1_000_000) * pricing.cost_per_1m_output
  return {
    input: Math.round(input * 1_000_000) / 1_000_000,
    output: Math.round(output * 1_000_000) / 1_000_000,
    total: Math.round((input + output) * 1_000_000) / 1_000_000
  }
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.001) return '< $0.001'
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}
