'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Target,
  Eye,
  Play,
  Check,
  X,
  Pencil,
  BarChart3,
  Activity,
  Zap,
  Crown,
  Image as ImageIcon
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts'

interface MeterModel {
  id: string
  name: string
  manufacturer: string | null
  meter_type: string
  reference_photos: string[]
  status: string
}

interface ModelVersion {
  id: string
  model_id: string
  version_number: number
  prompt_text: string
  image_config: {
    grayscale: boolean
    contrast: number
    brightness: number
  }
  is_active: boolean
  created_at: string
  notes: string | null
  stats: {
    total_tests: number
    validated: number
    corrected: number
    rejected: number
    success_rate: number | null
    avg_confidence: number
  }
}

interface TestRecord {
  id: string
  version_id: string
  extracted_data: any
  corrected_data: any
  confidence: number
  status: string
  created_at: string
  photo_url: string | null
}

const METER_ICONS: Record<string, string> = {
  gas: '🔥',
  electricity: '⚡',
  water_general: '💧',
  water_passage: '🚿',
  oil_tank: '🛢️',
  calorimeter: '🌡️',
  other: '📊'
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

export default function ModelVersionsPage() {
  const params = useParams()
  const router = useRouter()
  const modelId = params.id as string

  const [loading, setLoading] = useState(true)
  const [model, setModel] = useState<MeterModel | null>(null)
  const [versions, setVersions] = useState<ModelVersion[]>([])
  const [tests, setTests] = useState<TestRecord[]>([])
  const [activating, setActivating] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<ModelVersion | null>(null)
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [filterVersion, setFilterVersion] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [modelId])

  async function loadData() {
    setLoading(true)
    try {
      // Charger le modèle
      const { data: modelData } = await supabase
        .from('meter_models')
        .select('*')
        .eq('id', modelId)
        .single()

      if (modelData) setModel(modelData)

      // Charger les versions avec stats
      const versionsRes = await fetch(`/api/labs/model-versions?model_id=${modelId}`)
      const versionsData = await versionsRes.json()
      if (versionsData.versions) {
        setVersions(versionsData.versions)
      }

      // Charger tous les tests
      const { data: testsData } = await supabase
        .from('lab_experiments')
        .select('*')
        .eq('meter_model_id', modelId)
        .order('created_at', { ascending: false })

      if (testsData) setTests(testsData)

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function activateVersion(versionId: string) {
    setActivating(true)
    try {
      const res = await fetch('/api/labs/model-versions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId, action: 'activate' })
      })

      if (res.ok) {
        await loadData()
      }
    } catch (error) {
      console.error('Error activating version:', error)
    } finally {
      setActivating(false)
    }
  }

  // Calculer la suggestion
  function getSuggestion(): { version: ModelVersion | null; reason: string } {
    const validVersions = versions.filter(v => v.stats.total_tests >= 3)
    
    if (validVersions.length === 0) {
      return { 
        version: null, 
        reason: 'Pas assez de tests pour faire une suggestion (minimum 3 tests par version)' 
      }
    }

    // Trier par taux de réussite puis par confiance moyenne
    const sorted = [...validVersions].sort((a, b) => {
      const rateA = a.stats.success_rate || 0
      const rateB = b.stats.success_rate || 0
      if (rateB !== rateA) return rateB - rateA
      return b.stats.avg_confidence - a.stats.avg_confidence
    })

    const best = sorted[0]
    const activeVersion = versions.find(v => v.is_active)

    if (best.id === activeVersion?.id) {
      return {
        version: null,
        reason: `La version active (v${activeVersion.version_number}) est déjà la meilleure avec ${best.stats.success_rate}% de réussite`
      }
    }

    const improvement = (best.stats.success_rate || 0) - (activeVersion?.stats.success_rate || 0)

    return {
      version: best,
      reason: `v${best.version_number} a un taux de réussite de ${best.stats.success_rate}%${activeVersion ? ` (+${improvement}% vs v${activeVersion.version_number})` : ''} sur ${best.stats.total_tests} tests`
    }
  }

  // Données pour les graphiques
  const chartDataVersions = versions.map(v => ({
    name: `v${v.version_number}`,
    taux: v.stats.success_rate || 0,
    tests: v.stats.total_tests,
    confiance: Math.round(v.stats.avg_confidence * 100),
    isActive: v.is_active
  }))

  const chartDataDistribution = versions.map((v, i) => ({
    name: `v${v.version_number}`,
    validés: v.stats.validated,
    corrigés: v.stats.corrected,
    rejetés: v.stats.rejected,
    fill: COLORS[i % COLORS.length]
  }))

  const chartDataTimeline = tests.map(t => {
    const version = versions.find(v => v.id === t.version_id)
    return {
      date: new Date(t.created_at).toLocaleDateString('fr-FR'),
      confiance: Math.round(t.confidence * 100),
      status: t.status,
      version: version ? `v${version.version_number}` : '?'
    }
  }).reverse()

  const pieData = [
    { name: 'Validés', value: tests.filter(t => t.status === 'validated').length, color: '#10b981' },
    { name: 'Corrigés', value: tests.filter(t => t.status === 'corrected').length, color: '#f59e0b' },
    { name: 'Rejetés', value: tests.filter(t => t.status === 'rejected').length, color: '#ef4444' }
  ].filter(d => d.value > 0)

  const activeVersion = versions.find(v => v.is_active)
  const suggestion = getSuggestion()

  // Filtrer les tests
  const filteredTests = filterVersion === 'all' 
    ? tests 
    : tests.filter(t => t.version_id === filterVersion)

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/meters/${modelId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-4 flex-1">
          {model.reference_photos?.[0] && (
            <img 
              src={model.reference_photos[0]} 
              alt={model.name}
              className="w-16 h-16 object-cover rounded-lg border"
            />
          )}
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">{METER_ICONS[model.meter_type] || '📊'}</span>
              {model.name}
            </h1>
            <p className="text-gray-500 text-sm">
              {model.manufacturer} • Analyse des versions
            </p>
          </div>
        </div>
        <Badge className={model.status === 'active' ? 'bg-green-600' : 'bg-gray-500'}>
          {model.status === 'active' ? 'Actif' : model.status === 'draft' ? 'Brouillon' : 'Archivé'}
        </Badge>
      </div>

      {/* Version active */}
      {activeVersion && (
        <Card className="p-5 mb-6 border-2 border-purple-200 bg-purple-50/50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="font-semibold flex items-center gap-2 text-lg">
                <Crown className="h-5 w-5 text-yellow-500" />
                Version active : v{activeVersion.version_number}
              </h2>
              <div className="mt-3 grid md:grid-cols-2 gap-4">
                {/* Config image */}
                <div className="p-3 bg-white rounded-lg border">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> Traitement image
                  </p>
                  <p className="font-medium">
                    {activeVersion.image_config.grayscale ? 'Noir & Blanc' : 'Couleur'}
                    {activeVersion.image_config.contrast !== 0 && ` • C: ${activeVersion.image_config.contrast > 0 ? '+' : ''}${activeVersion.image_config.contrast}%`}
                    {activeVersion.image_config.brightness !== 0 && ` • L: ${activeVersion.image_config.brightness > 0 ? '+' : ''}${activeVersion.image_config.brightness}%`}
                  </p>
                </div>
                {/* Stats */}
                <div className="p-3 bg-white rounded-lg border">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" /> Performance
                  </p>
                  <p className="font-medium">
                    {activeVersion.stats.total_tests} tests • 
                    <span className={activeVersion.stats.success_rate && activeVersion.stats.success_rate >= 80 ? 'text-green-600' : activeVersion.stats.success_rate && activeVersion.stats.success_rate >= 50 ? 'text-orange-600' : 'text-red-600'}>
                      {' '}{activeVersion.stats.success_rate ?? 0}% réussite
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setSelectedVersion(activeVersion); setShowPromptModal(true) }}
            >
              <Eye className="h-4 w-4 mr-1" /> Voir prompt
            </Button>
          </div>
        </Card>
      )}

      {/* Suggestion */}
      <Card className={`p-5 mb-6 ${suggestion.version ? 'border-2 border-green-300 bg-green-50/50' : 'bg-gray-50'}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${suggestion.version ? 'bg-green-100' : 'bg-gray-200'}`}>
              <Sparkles className={`h-5 w-5 ${suggestion.version ? 'text-green-600' : 'text-gray-500'}`} />
            </div>
            <div>
              <h3 className="font-semibold">
                {suggestion.version 
                  ? `💡 Suggestion : Activer la version v${suggestion.version.version_number}`
                  : '💡 Suggestion'
                }
              </h3>
              <p className="text-sm text-gray-600 mt-1">{suggestion.reason}</p>
            </div>
          </div>
          {suggestion.version && (
            <Button 
              onClick={() => activateVersion(suggestion.version!.id)}
              disabled={activating}
              className="bg-green-600 hover:bg-green-700"
            >
              {activating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Activer v{suggestion.version.version_number}
            </Button>
          )}
        </div>
      </Card>

      {/* Graphiques */}
      {tests.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Taux de réussite par version */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Taux de réussite par version
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartDataVersions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip 
                  formatter={(value: any, name: any) => [
                    name === 'taux' ? `${value}%` : value,
                    name === 'taux' ? 'Réussite' : name === 'confiance' ? 'Confiance' : 'Tests'
                  ]}
                />
                <Bar dataKey="taux" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Distribution des résultats */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Distribution globale
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Confiance moyenne par version */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Confiance moyenne par version
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartDataVersions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(value: any) => [`${value}%`, 'Confiance']} />
                <Bar dataKey="confiance" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Résultats par version (stacked) */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Détail par version
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartDataDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="validés" stackId="a" fill="#10b981" />
                <Bar dataKey="corrigés" stackId="a" fill="#f59e0b" />
                <Bar dataKey="rejetés" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Tableau des versions */}
      <Card className="p-5 mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Comparatif des versions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500">
                <th className="pb-3 font-medium">Version</th>
                <th className="pb-3 font-medium">Config image</th>
                <th className="pb-3 font-medium text-center">Tests</th>
                <th className="pb-3 font-medium text-center">Réussite</th>
                <th className="pb-3 font-medium text-center">Confiance</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {versions.map(v => (
                <tr key={v.id} className={`border-b last:border-0 ${v.is_active ? 'bg-purple-50' : ''}`}>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">v{v.version_number}</span>
                      {v.is_active && <Badge className="bg-purple-600 text-xs">Active</Badge>}
                    </div>
                  </td>
                  <td className="py-3 text-sm">
                    {v.image_config.grayscale ? 'N&B' : 'Couleur'}
                    {v.image_config.contrast !== 0 && ` C:${v.image_config.contrast > 0 ? '+' : ''}${v.image_config.contrast}%`}
                    {v.image_config.brightness !== 0 && ` L:${v.image_config.brightness > 0 ? '+' : ''}${v.image_config.brightness}%`}
                  </td>
                  <td className="py-3 text-center">{v.stats.total_tests}</td>
                  <td className="py-3 text-center">
                    <span className={
                      v.stats.success_rate === null ? 'text-gray-400' :
                      v.stats.success_rate >= 80 ? 'text-green-600 font-semibold' :
                      v.stats.success_rate >= 50 ? 'text-orange-600' : 'text-red-600'
                    }>
                      {v.stats.success_rate !== null ? `${v.stats.success_rate}%` : '-'}
                    </span>
                  </td>
                  <td className="py-3 text-center text-sm">
                    {v.stats.avg_confidence > 0 ? `${Math.round(v.stats.avg_confidence * 100)}%` : '-'}
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {new Date(v.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => { setSelectedVersion(v); setShowPromptModal(true) }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!v.is_active && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => activateVersion(v.id)}
                          disabled={activating}
                        >
                          Activer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Historique des tests */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Historique des tests ({filteredTests.length})
          </h3>
          <Select value={filterVersion} onValueChange={setFilterVersion}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrer..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes versions</SelectItem>
              {versions.map(v => (
                <SelectItem key={v.id} value={v.id}>v{v.version_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredTests.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Aucun test pour ce modèle</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => router.push(`/dashboard/labs/meters?tab=tests&model=${modelId}`)}
            >
              Faire un test
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredTests.map(test => {
              const version = versions.find(v => v.id === test.version_id)
              return (
                <div 
                  key={test.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    test.status === 'validated' ? 'bg-green-50 border-green-200' :
                    test.status === 'corrected' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-red-50 border-red-200'
                  }`}
                >
                  {/* Photo */}
                  {test.photo_url ? (
                    <img src={test.photo_url} className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  )}

                  {/* Status icon */}
                  <div className="shrink-0">
                    {test.status === 'validated' && <CheckCircle className="h-5 w-5 text-green-600" />}
                    {test.status === 'corrected' && <Pencil className="h-5 w-5 text-yellow-600" />}
                    {test.status === 'rejected' && <XCircle className="h-5 w-5 text-red-600" />}
                  </div>

                  {/* Données */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono">
                        {test.extracted_data?.serial?.value || '-'} / {test.extracted_data?.reading?.value || '-'}
                      </span>
                      {test.corrected_data && (
                        <span className="text-yellow-600 text-xs">
                          → {test.corrected_data.serial || test.corrected_data.reading}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>{Math.round(test.confidence * 100)}% confiance</span>
                      {version && <Badge variant="outline" className="text-xs">v{version.version_number}</Badge>}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-xs text-gray-500 text-right">
                    {new Date(test.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Modal prompt */}
      <Dialog open={showPromptModal} onOpenChange={setShowPromptModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Prompt v{selectedVersion?.version_number}
              {selectedVersion?.is_active && <Badge className="ml-2 bg-purple-600">Active</Badge>}
            </DialogTitle>
            <DialogDescription>
              Config image: {selectedVersion?.image_config.grayscale ? 'N&B' : 'Couleur'}
              {selectedVersion?.image_config.contrast !== 0 && ` • Contraste: ${selectedVersion.image_config.contrast > 0 ? '+' : ''}${selectedVersion.image_config.contrast}%`}
              {selectedVersion?.image_config.brightness !== 0 && ` • Luminosité: ${selectedVersion.image_config.brightness > 0 ? '+' : ''}${selectedVersion.image_config.brightness}%`}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 rounded-lg border p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {selectedVersion?.prompt_text}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromptModal(false)}>
              Fermer
            </Button>
            {selectedVersion && !selectedVersion.is_active && (
              <Button onClick={() => { activateVersion(selectedVersion.id); setShowPromptModal(false) }}>
                Activer cette version
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
