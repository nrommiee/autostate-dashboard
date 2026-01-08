'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  ArrowLeft, Loader2, Check, X, Eye, Star, TrendingUp, 
  BarChart3, Target, AlertTriangle, Info, CheckCircle,
  Sparkles, History, Activity, Zap
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  analyzeVersions,
  getRecommendationBadgeColor,
  getRecommendationIcon,
  getRecommendationLabel,
  type VersionRecommendation,
  type SuggestionResult
} from '@/lib/meter-version-analysis'

// ============================================
// TYPES
// ============================================

interface MeterModel {
  id: string
  name: string
  manufacturer: string | null
  meter_type: string
  unit: string
  reference_photos: string[]
  is_active: boolean
}

interface TestRecord {
  id: string
  meter_model_id: string
  photo_url: string | null
  status: 'pending' | 'validated' | 'corrected' | 'rejected'
  extracted_data: Record<string, { value: string; confidence: number }> | null
  corrected_data: Record<string, string> | null
  confidence: number
  tokens_input: number
  tokens_output: number
  image_config_used: Record<string, any> | null
  recognition_version_id: string | null
  created_at: string
  expires_at: string | null
}

interface PromptVersion {
  id: string
  version: number
  prompt_text: string
  is_active: boolean
  created_at: string
}

const METER_TYPE_ICONS: Record<string, string> = {
  gas: '🔥',
  electricity: '⚡',
  water_general: '💧',
  water_passage: '🚿',
  oil_tank: '🛢️',
  calorimeter: '🌡️',
  other: '📊'
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function MeterModelAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const modelId = params.id as string

  const [loading, setLoading] = useState(true)
  const [model, setModel] = useState<MeterModel | null>(null)
  const [tests, setTests] = useState<TestRecord[]>([])
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([])
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null)
  const [versionStats, setVersionStats] = useState<VersionRecommendation[]>([])
  
  // Active version
  const [activeTest, setActiveTest] = useState<TestRecord | null>(null)
  const [activePrompt, setActivePrompt] = useState<PromptVersion | null>(null)
  
  // UI State
  const [activating, setActivating] = useState<string | null>(null)
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [showTestDetailModal, setShowTestDetailModal] = useState<TestRecord | null>(null)

  // ============================================
  // DATA LOADING
  // ============================================

  useEffect(() => {
    loadData()
  }, [modelId])

  async function loadData() {
    setLoading(true)
    try {
      // Load model
      const { data: modelData } = await supabase
        .from('meter_models')
        .select('*')
        .eq('id', modelId)
        .single()
      
      if (modelData) setModel(modelData)

      // Load tests from labs_experiments (the actual tests table)
      const { data: testsData } = await supabase
        .from('labs_experiments')
        .select('*')
        .eq('meter_model_id', modelId)
        .order('created_at', { ascending: false })
      
      if (testsData) {
        setTests(testsData)
        const active = testsData.find(t => t.is_active)
        setActiveTest(active || null)
      }

      // Load prompt versions
      const { data: promptsData } = await supabase
        .from('meter_model_prompts')
        .select('*')
        .eq('model_id', modelId)
        .order('version', { ascending: false })
      
      if (promptsData) {
        setPromptVersions(promptsData)
        const activeP = promptsData.find(p => p.is_active)
        setActivePrompt(activeP || null)
      }

      // Calculate version stats from tests
      if (testsData && testsData.length > 0) {
        const stats = calculateVersionStats(testsData)
        setVersionStats(stats)
        // Get config label from active test's image_config_used
        let activeConfigLabel: string | null = null
        if (activeTest?.image_config_used) {
          const config = activeTest.image_config_used
          const parts = []
          if (config.grayscale) parts.push('N&B')
          else parts.push('Couleur')
          if (config.contrast) parts.push(`C:${config.contrast > 0 ? '+' : ''}${config.contrast}%`)
          activeConfigLabel = parts.join(' ')
        }
        const suggestionResult = analyzeVersions(stats, activeConfigLabel)
        setSuggestion(suggestionResult)
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // STATS CALCULATION (client-side)
  // ============================================

  function calculateVersionStats(tests: TestRecord[]): VersionRecommendation[] {
    // Group tests by image_config_used (convert to label)
    const groups: Record<string, TestRecord[]> = {}
    
    tests.forEach(test => {
      const config = test.image_config_used
      let label = 'Sans traitement'
      if (config) {
        const parts = []
        if (config.grayscale) parts.push('N&B')
        else parts.push('Couleur')
        if (config.contrast) parts.push(`C:${config.contrast > 0 ? '+' : ''}${config.contrast}%`)
        if (config.sharpness) parts.push(`N:${config.sharpness}%`)
        label = parts.join(' ')
      }
      if (!groups[label]) groups[label] = []
      groups[label].push(test)
    })

    return Object.entries(groups).map(([label, groupTests]) => {
      // Use status to determine success
      const successful = groupTests.filter(t => t.status === 'validated' || t.status === 'corrected').length
      const successRate = (successful / groupTests.length) * 100
      
      // Calculate consistency (standard deviation of success rate)
      const successValues: number[] = groupTests.map(t => (t.status === 'validated' || t.status === 'corrected') ? 1 : 0)
      const mean = successValues.reduce((a: number, b: number) => a + b, 0) / successValues.length
      const variance = successValues.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / successValues.length
      const stdDev = Math.sqrt(variance)
      const consistency = groupTests.length >= 3 ? Math.max(0, (1 - stdDev / Math.max(mean, 0.5)) * 100) : null

      const score = (successRate * 0.80) + ((consistency ?? 50) * 0.20)
      
      return {
        model_id: modelId,
        image_config_label: label,
        total_tests: groupTests.length,
        successful_tests: successful,
        success_rate: Math.round(successRate * 10) / 10,
        avg_confidence: Math.round(groupTests.reduce((sum, t) => sum + (t.confidence || 0), 0) / groupTests.length * 100),
        consistency_score: consistency !== null ? Math.round(consistency * 10) / 10 : null,
        first_test_at: groupTests[groupTests.length - 1]?.created_at || '',
        last_test_at: groupTests[0]?.created_at || '',
        recommendation_score: Math.round(score * 10) / 10,
        recommendation_level: groupTests.length < 3 ? 'insufficient_data' as const :
          score >= 95 ? 'strong' as const :
          score >= 85 ? 'moderate' as const : 'weak' as const
      }
    }).sort((a, b) => b.recommendation_score - a.recommendation_score)
  }

  // ============================================
  // ACTIONS
  // ============================================

  async function activateTest(test: TestRecord) {
    setActivating(test.id)
    try {
      // Deactivate all tests for this model
      await supabase
        .from('meter_model_tests')
        .update({ is_active: false })
        .eq('model_id', modelId)

      // Activate selected test
      await supabase
        .from('meter_model_tests')
        .update({ is_active: true })
        .eq('id', test.id)

      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error activating test:', error)
    } finally {
      setActivating(null)
    }
  }

  async function deactivateTest() {
    if (!activeTest) return
    setActivating(activeTest.id)
    try {
      await supabase
        .from('meter_model_tests')
        .update({ is_active: false })
        .eq('id', activeTest.id)

      await loadData()
    } catch (error) {
      console.error('Error deactivating test:', error)
    } finally {
      setActivating(null)
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  function formatDate(d: string) {
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getTestsByVersion(configLabel: string): TestRecord[] {
    return tests.filter(t => (t.image_config_label || 'Sans traitement') === configLabel)
  }

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!model) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Modèle non trouvé</p>
        <Link href="/dashboard/meters">
          <Button variant="outline" className="mt-4">Retour</Button>
        </Link>
      </div>
    )
  }

  const typeIcon = METER_TYPE_ICONS[model.meter_type] || '📊'

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href={`/dashboard/meters/${modelId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            {model.reference_photos?.[0] && (
              <img 
                src={model.reference_photos[0]} 
                alt={model.name}
                className="h-14 w-14 object-cover rounded-lg border"
              />
            )}
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">{typeIcon}</span>
                {model.name}
              </h1>
              <p className="text-gray-500 text-sm">
                {model.manufacturer} • Analyse des versions
              </p>
            </div>
          </div>
          <Badge className={model.is_active ? 'bg-green-600' : 'bg-gray-400'}>
            {model.is_active ? 'Actif' : 'Inactif'}
          </Badge>
        </div>

        {/* Version active */}
        <Card className="p-5 mb-6 border-2 border-purple-200 bg-purple-50/30">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-yellow-500" />
                Version active : {activeTest ? `v${activeTest.version_number || '?'}` : 'Aucune'}
              </h2>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="p-3 bg-white rounded-lg border">
                  <p className="text-xs text-gray-500 mb-1">Traitement image</p>
                  <p className="font-medium">
                    {activeTest?.image_config_label || 'Non défini'}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg border">
                  <p className="text-xs text-gray-500 mb-1">Performance</p>
                  <p className="font-medium">
                    {tests.length} tests • 
                    <span className={tests.filter(t => t.success).length / tests.length >= 0.8 ? 'text-green-600' : 'text-orange-600'}>
                      {' '}{Math.round((tests.filter(t => t.success).length / Math.max(tests.length, 1)) * 100)}% réussite
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowPromptModal(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Voir prompt
            </Button>
          </div>
        </Card>

        {/* Suggestion IA */}
        <Card className="p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold flex items-center gap-2">
                Suggestion
                {suggestion?.recommendationLevel && suggestion.recommendationLevel !== 'insufficient_data' && (
                  <Badge 
                    variant="outline" 
                    className={getRecommendationBadgeColor(suggestion.recommendationLevel)}
                  >
                    {getRecommendationIcon(suggestion.recommendationLevel)} {getRecommendationLabel(suggestion.recommendationLevel)}
                  </Badge>
                )}
              </h3>
              
              {!suggestion?.hasEnoughData ? (
                <p className="text-gray-500 mt-2">{suggestion?.message}</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {/* Recommended version */}
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-700 font-medium">
                          ⭐ Version recommandée : {suggestion.recommendedVersion}
                        </p>
                        <p className="text-sm text-green-600 mt-1">
                          Score : {suggestion.recommendationScore}/100
                        </p>
                      </div>
                      {suggestion.recommendedVersion !== activeTest?.image_config_label && (
                        <Button 
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => {
                            const testToActivate = tests.find(t => 
                              t.image_config_label === suggestion.recommendedVersion && t.success
                            )
                            if (testToActivate) activateTest(testToActivate)
                          }}
                        >
                          Activer
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Analysis details */}
                  {suggestion.analysis && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs">Taux de réussite</span>
                        </div>
                        <p className="font-bold text-lg">{suggestion.analysis.successRate.value}%</p>
                        <p className="text-xs text-gray-500 mt-1">{suggestion.analysis.successRate.comparison}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <Activity className="h-4 w-4" />
                          <span className="text-xs">Consistance</span>
                        </div>
                        <p className="font-bold text-lg">
                          {suggestion.analysis.consistency.value !== null 
                            ? `${suggestion.analysis.consistency.value}%` 
                            : 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{suggestion.analysis.consistency.comparison}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-600 mb-1">
                          <BarChart3 className="h-4 w-4" />
                          <span className="text-xs">Volume</span>
                        </div>
                        <p className="font-bold text-lg">{suggestion.analysis.testVolume.value} tests</p>
                        <p className="text-xs text-gray-500 mt-1">{suggestion.analysis.testVolume.status}</p>
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-800">
                      💡 {suggestion.message}
                    </p>
                  </div>

                  {/* Alerts */}
                  {suggestion.alerts.length > 0 && (
                    <div className="space-y-2">
                      {suggestion.alerts.map((alert, i) => (
                        <div 
                          key={i} 
                          className={`p-3 rounded-lg flex items-start gap-2 ${
                            alert.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                            alert.type === 'error' ? 'bg-red-50 border border-red-200' :
                            'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />}
                          {alert.type === 'info' && <Info className="h-4 w-4 text-gray-600 mt-0.5" />}
                          <p className={`text-sm ${
                            alert.type === 'warning' ? 'text-yellow-800' :
                            alert.type === 'error' ? 'text-red-800' : 'text-gray-700'
                          }`}>
                            {alert.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Stats par version */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5" />
              Taux de réussite par version
            </h3>
            {versionStats.length > 0 ? (
              <div className="space-y-3">
                {versionStats.map(stat => (
                  <div key={stat.image_config_label} className="flex items-center gap-3">
                    <div className="w-24 text-sm truncate">{stat.image_config_label}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          stat.success_rate >= 80 ? 'bg-green-500' :
                          stat.success_rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${stat.success_rate}%` }}
                      />
                    </div>
                    <div className="w-16 text-right text-sm font-medium">
                      {stat.success_rate}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Aucune donnée</p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Target className="h-5 w-5" />
              Distribution globale
            </h3>
            <div className="flex items-center justify-center h-40">
              {tests.length > 0 ? (
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#E5E7EB"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="3"
                      strokeDasharray={`${(tests.filter(t => t.success).length / tests.length) * 100}, 100`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-green-600">
                      {tests.filter(t => t.success).length}
                    </span>
                    <span className="text-xs text-gray-500">Validés</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Aucun test</p>
              )}
            </div>
          </Card>
        </div>

        {/* Liste des tests */}
        <Card className="p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <History className="h-5 w-5" />
            Tests réalisés ({tests.length})
          </h3>

          {tests.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Aucun test réalisé</p>
              <Link href={`/dashboard/labs/meters?model=${modelId}`}>
                <Button>
                  <Zap className="h-4 w-4 mr-2" />
                  Lancer un test
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {tests.map((test, index) => {
                const isSuccess = test.status === 'validated' || test.status === 'corrected'
                const config = test.image_config_used
                let configLabel = 'Sans traitement'
                if (config) {
                  const parts = []
                  if (config.grayscale) parts.push('N&B')
                  else parts.push('Couleur')
                  if (config.contrast) parts.push(`C:${config.contrast > 0 ? '+' : ''}${config.contrast}%`)
                  configLabel = parts.join(' ')
                }
                // Extract reading from extracted_data
                const extractedReading = test.extracted_data?.reading?.value || test.extracted_data?.index?.value || null
                const extractedSerial = test.extracted_data?.serialNumber?.value || test.extracted_data?.serial?.value || null
                const correctedReading = test.corrected_data?.reading || test.corrected_data?.index || null
                
                return (
                <div 
                  key={test.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    isSuccess 
                      ? 'bg-green-50/50 border-green-200 hover:bg-green-50' 
                      : 'bg-red-50/50 border-red-200 hover:bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isSuccess ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <X className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            Test #{tests.length - index}
                          </span>
                          <Badge variant="outline" className={`text-xs ${
                            test.status === 'validated' ? 'bg-green-50 text-green-700' :
                            test.status === 'corrected' ? 'bg-blue-50 text-blue-700' :
                            test.status === 'rejected' ? 'bg-red-50 text-red-700' :
                            'bg-gray-50'
                          }`}>
                            {test.status === 'validated' ? 'Validé' :
                             test.status === 'corrected' ? 'Corrigé' :
                             test.status === 'rejected' ? 'Rejeté' : 'En attente'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {configLabel}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {extractedSerial && (
                            <span className="font-mono mr-3">N°: {extractedSerial}</span>
                          )}
                          {extractedReading && (
                            <span className="font-mono">Index: {extractedReading}</span>
                          )}
                          {correctedReading && (
                            <span className="text-green-600 ml-2">→ {correctedReading}</span>
                          )}
                          <span className="ml-3">Confiance: {Math.round((test.confidence || 0) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {formatDate(test.created_at)}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setShowTestDetailModal(test)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Voir détails</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </Card>

        {/* Modal: Voir le prompt */}
        <Dialog open={showPromptModal} onOpenChange={setShowPromptModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Version {activePrompt?.version || '?'}
                {activePrompt?.is_active && (
                  <Badge className="bg-green-600">Actif</Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {activePrompt && formatDate(activePrompt.created_at)}
              </DialogDescription>
            </DialogHeader>
            <pre className="bg-gray-50 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto border">
              {activePrompt?.prompt_text || 'Aucun prompt défini'}
            </pre>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPromptModal(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Détail d'un test */}
        <Dialog open={!!showTestDetailModal} onOpenChange={() => setShowTestDetailModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Détail du test
                <Badge className={
                  showTestDetailModal?.status === 'validated' ? 'bg-green-600' :
                  showTestDetailModal?.status === 'corrected' ? 'bg-blue-600' :
                  'bg-red-600'
                }>
                  {showTestDetailModal?.status === 'validated' ? 'Validé' :
                   showTestDetailModal?.status === 'corrected' ? 'Corrigé' : 'Rejeté'}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            {showTestDetailModal && (
              <div className="space-y-4">
                {showTestDetailModal.photo_url && (
                  <img 
                    src={showTestDetailModal.photo_url} 
                    alt="Test" 
                    className="w-full max-h-48 object-contain rounded-lg border"
                  />
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Traitement image</p>
                    <p className="font-medium">
                      {showTestDetailModal.image_config_used 
                        ? (showTestDetailModal.image_config_used.grayscale ? 'N&B' : 'Couleur') +
                          (showTestDetailModal.image_config_used.contrast ? ` C:${showTestDetailModal.image_config_used.contrast}%` : '')
                        : 'Sans traitement'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Confiance</p>
                    <p className="font-medium">{Math.round((showTestDetailModal.confidence || 0) * 100)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">N° série extrait</p>
                    <p className="font-mono">
                      {showTestDetailModal.extracted_data?.serialNumber?.value || 
                       showTestDetailModal.extracted_data?.serial?.value || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Index extrait</p>
                    <p className="font-mono">
                      {showTestDetailModal.extracted_data?.reading?.value || 
                       showTestDetailModal.extracted_data?.index?.value || '-'}
                    </p>
                  </div>
                  {showTestDetailModal.corrected_data && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500">Correction N° série</p>
                        <p className="font-mono text-green-600">
                          {showTestDetailModal.corrected_data.serialNumber || 
                           showTestDetailModal.corrected_data.serial || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Correction Index</p>
                        <p className="font-mono text-green-600">
                          {showTestDetailModal.corrected_data.reading || 
                           showTestDetailModal.corrected_data.index || '-'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {showTestDetailModal.image_config_used && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Config image utilisée</p>
                    <pre className="text-xs bg-gray-50 p-2 rounded font-mono">
                      {JSON.stringify(showTestDetailModal.image_config_used, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTestDetailModal(null)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
