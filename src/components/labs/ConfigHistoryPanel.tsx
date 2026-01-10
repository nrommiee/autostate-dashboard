'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Star, 
  Play, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  DollarSign,
  ChevronRight,
  Loader2
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface TestConfig {
  id: string
  name: string
  version: number
  createdAt: string
  status: 'draft' | 'active' | 'archived'
  preprocessing?: any
  zones?: any
  prompts?: any
}

export interface TestResult {
  id: string
  configId: string
  configName: string
  createdAt: string
  totalPhotos: number
  successCount: number
  failCount: number
  accuracyRate: number
  avgConfidence: number
  avgProcessingTimeMs: number
  totalCostUsd: number
  isActive: boolean
  photoResults?: PhotoResult[]
}

export interface PhotoResult {
  id: string
  photoId: string
  photoUrl: string
  thumbnailUrl?: string
  reading: string | null
  serialNumber: string | null
  confidence: number
  isCorrect: boolean | null
  processingTimeMs: number
}

interface ConfigHistoryPanelProps {
  configs: TestConfig[]
  results: TestResult[]
  activeConfigId: string | null
  onActivateConfig: (configId: string) => Promise<void>
  onViewResults: (result: TestResult) => void
  onRunTest: () => void
  loading?: boolean
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCost(cost: number) {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ConfigHistoryPanel({
  configs,
  results,
  activeConfigId,
  onActivateConfig,
  onViewResults,
  onRunTest,
  loading = false,
}: ConfigHistoryPanelProps) {
  const [activating, setActivating] = useState<string | null>(null)

  const handleActivate = async (configId: string) => {
    setActivating(configId)
    try {
      await onActivateConfig(configId)
    } finally {
      setActivating(null)
    }
  }

  // Group results by config
  const resultsWithConfigs = results.map(result => ({
    ...result,
    config: configs.find(c => c.id === result.configId),
  }))

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-teal-500" />
        <p className="text-muted-foreground">Chargement des résultats...</p>
      </Card>
    )
  }

  if (results.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Play className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="text-lg font-medium mb-2">Aucun test lancé</p>
        <p className="text-muted-foreground mb-4">
          Configurez les couches puis lancez le test
        </p>
        <Button onClick={onRunTest}>
          <Play className="h-4 w-4 mr-2" />
          Lancer maintenant
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{results.length}</p>
          <p className="text-sm text-muted-foreground">Tests lancés</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {Math.round(Math.max(...results.map(r => r.accuracyRate)) * 100)}%
          </p>
          <p className="text-sm text-muted-foreground">Meilleure précision</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">
            {results.reduce((acc, r) => acc + r.totalPhotos, 0)}
          </p>
          <p className="text-sm text-muted-foreground">Photos testées</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">
            {formatCost(results.reduce((acc, r) => acc + r.totalCostUsd, 0))}
          </p>
          <p className="text-sm text-muted-foreground">Coût total</p>
        </Card>
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {resultsWithConfigs
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((result) => {
            const isActive = result.isActive
            const successRate = Math.round(result.accuracyRate * 100)
            const isGood = successRate >= 80
            
            return (
              <Card 
                key={result.id} 
                className={`p-4 transition-all ${
                  isActive 
                    ? 'border-teal-500 bg-teal-50/30 ring-1 ring-teal-500' 
                    : 'hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{result.configName}</span>
                      {isActive && (
                        <Badge className="bg-teal-600 text-white gap-1">
                          <Star className="h-3 w-3" />
                          ACTIVE
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        📅 {formatDate(result.createdAt)}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">{result.totalPhotos} photos</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-600">{result.successCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-red-600">{result.failCount}</span>
                      </div>
                      <div className={`font-semibold ${isGood ? 'text-green-600' : 'text-orange-600'}`}>
                        {successRate}% réussite
                      </div>
                    </div>

                    {/* Additional info */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {result.avgProcessingTimeMs}ms moy.
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatCost(result.totalCostUsd)}
                      </div>
                      <div>
                        Confiance: {Math.round(result.avgConfidence * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {!isActive && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleActivate(result.configId)}
                        disabled={activating === result.configId}
                      >
                        {activating === result.configId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Star className="h-4 w-4 mr-1" />
                            Activer
                          </>
                        )}
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onViewResults(result)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Voir
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
      </div>
    </div>
  )
}

// ============================================
// PHOTO RESULTS DETAIL COMPONENT
// ============================================

interface PhotoResultsDetailProps {
  result: TestResult
  onBack: () => void
  onMarkCorrect: (photoResultId: string, isCorrect: boolean) => Promise<void>
}

export function PhotoResultsDetail({
  result,
  onBack,
  onMarkCorrect,
}: PhotoResultsDetailProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [marking, setMarking] = useState<string | null>(null)

  const photoResults = result.photoResults || []
  const currentResult = photoResults[selectedIndex]

  const handleMark = async (id: string, isCorrect: boolean) => {
    setMarking(id)
    try {
      await onMarkCorrect(id, isCorrect)
    } finally {
      setMarking(null)
    }
  }

  if (photoResults.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Aucun résultat détaillé disponible</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          ← Retour
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>← Retour</Button>
          <div>
            <h3 className="font-semibold">{result.configName}</h3>
            <p className="text-sm text-muted-foreground">
              {result.totalPhotos} photos • {Math.round(result.accuracyRate * 100)}% réussite
            </p>
          </div>
        </div>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-4 gap-4">
        {/* Photo list */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {photoResults.map((pr, index) => (
            <div
              key={pr.id}
              onClick={() => setSelectedIndex(index)}
              className={`p-2 rounded-lg border cursor-pointer transition-all ${
                selectedIndex === index 
                  ? 'border-teal-500 bg-teal-50' 
                  : 'hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                  <img 
                    src={pr.thumbnailUrl || pr.photoUrl} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm truncate">
                    {pr.reading || '-'}
                  </p>
                  <div className="flex items-center gap-1">
                    {pr.isCorrect === true && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                    {pr.isCorrect === false && <XCircle className="h-3 w-3 text-red-500" />}
                    {pr.isCorrect === null && <Clock className="h-3 w-3 text-gray-400" />}
                    <span className="text-xs text-muted-foreground">
                      {Math.round(pr.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div className="col-span-3">
          {currentResult && (
            <Card className="p-4">
              {/* Photo preview */}
              <div className="bg-gray-100 rounded-lg overflow-hidden mb-4">
                <img 
                  src={currentResult.photoUrl} 
                  alt="" 
                  className="w-full h-auto max-h-[400px] object-contain"
                />
              </div>

              {/* Results */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Lecture</p>
                  <p className="font-mono text-2xl font-bold">
                    {currentResult.reading || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">N° série</p>
                  <p className="font-mono text-lg">
                    {currentResult.serialNumber || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confiance</p>
                  <p className={`text-2xl font-bold ${
                    currentResult.confidence >= 0.8 ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {Math.round(currentResult.confidence * 100)}%
                  </p>
                </div>
              </div>

              {/* Validation buttons */}
              <div className="flex items-center gap-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">Cette lecture est-elle correcte ?</span>
                <div className="flex gap-2">
                  <Button
                    variant={currentResult.isCorrect === true ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleMark(currentResult.id, true)}
                    disabled={marking === currentResult.id}
                    className={currentResult.isCorrect === true ? 'bg-green-600 hover:bg-green-700' : ''}
                  >
                    {marking === currentResult.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Correct
                      </>
                    )}
                  </Button>
                  <Button
                    variant={currentResult.isCorrect === false ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleMark(currentResult.id, false)}
                    disabled={marking === currentResult.id}
                    className={currentResult.isCorrect === false ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    {marking === currentResult.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-1" />
                        Incorrect
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
