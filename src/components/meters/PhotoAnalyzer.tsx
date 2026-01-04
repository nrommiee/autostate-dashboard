'use client'

import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { KeywordsSelector, Keyword } from './KeywordsSelector'
import { Upload, Sparkles, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface PhotoAnalyzerProps {
  photoUrl: string | null
  photoFile: File | null
  keywords: Keyword[]
  onPhotoChange: (file: File | null, url: string | null) => void
  onKeywordsChange: (keywords: Keyword[]) => void
  onAnalysisComplete: (analysis: AnalysisResult) => void
  disabled?: boolean
}

export interface AnalysisResult {
  name?: string
  manufacturer?: string
  meterType?: string
  keywords: Keyword[]
  description?: string
  suggestedZones?: any[]
  rawAnalysis?: string
  photoQuality?: {
    score: number
    issues: string[]
  }
}

export function PhotoAnalyzer({
  photoUrl,
  photoFile,
  keywords,
  onPhotoChange,
  onKeywordsChange,
  onAnalysisComplete,
  disabled
}: PhotoAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [photoQuality, setPhotoQuality] = useState<{ score: number; issues: string[] } | null>(null)

  // Handle photo upload
  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    onPhotoChange(file, url)
    setAnalysisComplete(false)
    setAnalysisError(null)
    setPhotoQuality(null)
  }, [onPhotoChange])

  // Remove photo
  const removePhoto = () => {
    if (photoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(photoUrl)
    }
    onPhotoChange(null, null)
    onKeywordsChange([])
    setAnalysisComplete(false)
    setAnalysisError(null)
    setPhotoQuality(null)
  }

  // Analyze with Claude
  const analyzePhoto = async () => {
    if (!photoFile) {
      setAnalysisError('Veuillez d\'abord ajouter une photo')
      return
    }

    setAnalyzing(true)
    setAnalysisError(null)

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = (reader.result as string).split(',')[1]
          resolve(result)
        }
        reader.readAsDataURL(photoFile)
      })

      // Call analyze API
      const response = await fetch('/api/analyze-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: [base64],
          extractKeywords: true
        })
      })

      if (!response.ok) {
        throw new Error('Erreur lors de l\'analyse')
      }

      const result = await response.json()

      // Convert AI keywords to Keyword objects
      const aiKeywords: Keyword[] = (result.keywords || []).map((kw: string) => ({
        id: crypto.randomUUID(),
        value: kw,
        source: 'ai' as const,
        validated: true // Pre-validated by default
      }))

      // Add manufacturer as keyword if detected
      if (result.manufacturer && !aiKeywords.some(k => k.value.toLowerCase() === result.manufacturer.toLowerCase())) {
        aiKeywords.unshift({
          id: crypto.randomUUID(),
          value: result.manufacturer,
          source: 'ai',
          validated: true
        })
      }

      onKeywordsChange(aiKeywords)
      setPhotoQuality(result.photoQuality || null)
      setAnalysisComplete(true)

      // Notify parent with full analysis
      onAnalysisComplete({
        name: result.name,
        manufacturer: result.manufacturer,
        meterType: result.meterType,
        keywords: aiKeywords,
        description: result.description,
        suggestedZones: result.suggestedZones,
        rawAnalysis: result.rawAnalysis,
        photoQuality: result.photoQuality
      })

    } catch (err) {
      console.error('Analysis error:', err)
      setAnalysisError('Erreur lors de l\'analyse. Veuillez réessayer.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Photo upload area */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Photo de référence</h3>
          {photoUrl && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={analyzePhoto}
              disabled={analyzing}
              className="gap-2"
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {analyzing ? 'Analyse...' : 'Analyser'}
            </Button>
          )}
        </div>

        {photoUrl ? (
          <div className="relative">
            <img
              src={photoUrl}
              alt="Photo du compteur"
              className="w-full max-h-80 object-contain rounded-lg border bg-gray-50"
            />
            {!disabled && (
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Quality indicator */}
            {photoQuality && (
              <div className={`absolute bottom-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${
                photoQuality.score >= 80 ? 'bg-green-100 text-green-800' :
                photoQuality.score >= 50 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                Qualité: {photoQuality.score}%
              </div>
            )}

            {/* Analysis status */}
            {analysisComplete && (
              <div className="absolute top-2 left-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Analysée
              </div>
            )}
          </div>
        ) : (
          <label className={`
            flex flex-col items-center justify-center h-48 
            border-2 border-dashed border-gray-300 rounded-lg 
            cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}>
            <Upload className="h-10 w-10 text-gray-400 mb-3" />
            <span className="text-gray-600 font-medium">Cliquez pour ajouter une photo</span>
            <span className="text-gray-400 text-sm mt-1">Photo frontale recommandée, bonne lumière</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              disabled={disabled}
            />
          </label>
        )}

        {/* Error message */}
        {analysisError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
            {analysisError}
          </div>
        )}

        {/* Quality issues */}
        {photoQuality && photoQuality.issues.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm font-medium text-yellow-800 mb-1">
              Suggestions d'amélioration:
            </div>
            <ul className="text-sm text-yellow-700 list-disc list-inside">
              {photoQuality.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Keywords section */}
      {photoUrl && (
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="font-semibold">Mots-clés détectés</h3>
            <p className="text-sm text-gray-500">
              Validez les mots-clés qui correspondent au compteur. Ces mots-clés aident l'IA à reconnaître le modèle.
            </p>
          </div>

          <KeywordsSelector
            keywords={keywords}
            onChange={onKeywordsChange}
            disabled={disabled}
          />

          {!analysisComplete && keywords.length === 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              💡 Cliquez sur "Analyser" pour extraire automatiquement les mots-clés de la photo.
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default PhotoAnalyzer
