'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  GitBranch, Plus, Check, Loader2, Star, Clock, 
  FileCode, MoreHorizontal, Edit, Archive,
  CheckCircle, AlertCircle, Beaker
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'

interface RecognitionVersion {
  id: string
  codename: string
  version_number: string
  display_name: string
  status: 'development' | 'testing' | 'stable' | 'deprecated'
  is_default: boolean
  default_image_config: any
  prompt_template: string | null
  description: string | null
  changelog: string | null
  release_date: string | null
  deprecation_date: string | null
  created_at: string
  updated_at: string
}

interface VersionStats {
  version_id: string
  total_tests: number
  success_rate: number
  avg_confidence: number
  avg_tokens: number
}

const STATUS_CONFIG = {
  development: { label: 'Développement', color: 'bg-gray-100 text-gray-700', icon: Beaker },
  testing: { label: 'Test', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  stable: { label: 'Stable', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  deprecated: { label: 'Déprécié', color: 'bg-red-100 text-red-700', icon: Archive },
}

export default function LabsVersionsPage() {
  const [versions, setVersions] = useState<RecognitionVersion[]>([])
  const [stats, setStats] = useState<Record<string, VersionStats>>({})
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<RecognitionVersion | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formCodename, setFormCodename] = useState('')
  const [formVersionNumber, setFormVersionNumber] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStatus, setFormStatus] = useState<string>('development')
  const [formChangelog, setFormChangelog] = useState('')

  useEffect(() => {
    loadVersions()
  }, [])

  async function loadVersions() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('recognition_versions')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) {
        setVersions(data)
        
        // Load stats for each version
        const statsMap: Record<string, VersionStats> = {}
        for (const version of data) {
          const { data: expData } = await supabase
            .from('lab_experiments')
            .select('confidence, tokens_input, tokens_output, status')
            .eq('recognition_version_id', version.id)

          if (expData && expData.length > 0) {
            const validated = expData.filter(e => e.status === 'validated' || e.status === 'corrected')
            statsMap[version.id] = {
              version_id: version.id,
              total_tests: expData.length,
              success_rate: (validated.length / expData.length) * 100,
              avg_confidence: expData.reduce((sum, e) => sum + (e.confidence || 0), 0) / expData.length * 100,
              avg_tokens: Math.round(expData.reduce((sum, e) => sum + (e.tokens_input || 0) + (e.tokens_output || 0), 0) / expData.length)
            }
          }
        }
        setStats(statsMap)
      }
    } catch (err) {
      console.error('Error loading versions:', err)
    }
    setLoading(false)
  }

  function openCreateModal() {
    setFormCodename('')
    setFormVersionNumber('')
    setFormDescription('')
    setFormStatus('development')
    setFormChangelog('')
    setShowCreateModal(true)
  }

  function openEditModal(version: RecognitionVersion) {
    setSelectedVersion(version)
    setFormCodename(version.codename)
    setFormVersionNumber(version.version_number)
    setFormDescription(version.description || '')
    setFormStatus(version.status)
    setFormChangelog(version.changelog || '')
    setShowEditModal(true)
  }

  async function createVersion() {
    if (!formCodename.trim() || !formVersionNumber.trim()) return

    setSaving(true)
    try {
      const displayName = `${formCodename.charAt(0).toUpperCase() + formCodename.slice(1)} ${formVersionNumber}`
      
      // Get default config from the current default version
      const defaultVersion = versions.find(v => v.is_default)
      const defaultConfig = defaultVersion?.default_image_config || {
        grayscale: true,
        contrast: 30,
        brightness: 0,
        sharpness: 20,
        auto_crop: true,
        max_dimension: 1024,
        jpeg_quality: 85
      }

      await supabase.from('recognition_versions').insert({
        codename: formCodename.toLowerCase(),
        version_number: formVersionNumber,
        display_name: displayName,
        status: formStatus,
        description: formDescription || null,
        changelog: formChangelog || null,
        default_image_config: defaultConfig,
        prompt_template: defaultVersion?.prompt_template || null,
        is_default: false
      })

      setShowCreateModal(false)
      loadVersions()
    } catch (err) {
      console.error('Error creating version:', err)
    }
    setSaving(false)
  }

  async function updateVersion() {
    if (!selectedVersion || !formCodename.trim() || !formVersionNumber.trim()) return

    setSaving(true)
    try {
      const displayName = `${formCodename.charAt(0).toUpperCase() + formCodename.slice(1)} ${formVersionNumber}`

      await supabase
        .from('recognition_versions')
        .update({
          codename: formCodename.toLowerCase(),
          version_number: formVersionNumber,
          display_name: displayName,
          status: formStatus,
          description: formDescription || null,
          changelog: formChangelog || null,
          release_date: formStatus === 'stable' ? new Date().toISOString() : selectedVersion.release_date,
          deprecation_date: formStatus === 'deprecated' ? new Date().toISOString() : null
        })
        .eq('id', selectedVersion.id)

      setShowEditModal(false)
      setSelectedVersion(null)
      loadVersions()
    } catch (err) {
      console.error('Error updating version:', err)
    }
    setSaving(false)
  }

  async function setAsDefault(version: RecognitionVersion) {
    try {
      // Remove default from all versions
      await supabase
        .from('recognition_versions')
        .update({ is_default: false })
        .neq('id', 'placeholder')

      // Set new default
      await supabase
        .from('recognition_versions')
        .update({ is_default: true })
        .eq('id', version.id)

      loadVersions()
    } catch (err) {
      console.error('Error setting default:', err)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Versions du moteur de reconnaissance</h2>
          <p className="text-sm text-gray-500">
            Gérez les différentes versions de l'algorithme de reconnaissance
          </p>
        </div>
        <Button onClick={openCreateModal} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle version
        </Button>
      </div>

      {/* Versions list */}
      <div className="space-y-4">
        {versions.map(version => {
          const statusConfig = STATUS_CONFIG[version.status]
          const StatusIcon = statusConfig.icon
          const versionStats = stats[version.id]

          return (
            <Card key={version.id} className={`p-4 ${version.is_default ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    version.is_default 
                      ? 'bg-gradient-to-br from-purple-500 to-indigo-600' 
                      : 'bg-gray-100'
                  }`}>
                    <GitBranch className={`h-6 w-6 ${version.is_default ? 'text-white' : 'text-gray-500'}`} />
                  </div>

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{version.display_name}</h3>
                      {version.is_default && (
                        <Badge className="bg-purple-100 text-purple-700">
                          <Star className="h-3 w-3 mr-1" />
                          Défaut
                        </Badge>
                      )}
                      <Badge className={statusConfig.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      {version.description || 'Aucune description'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Créé le {formatDate(version.created_at)}
                      </span>
                      {version.release_date && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Publié le {formatDate(version.release_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats & Actions */}
                <div className="flex items-center gap-4">
                  {versionStats && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="text-center px-3 py-1 bg-gray-50 rounded">
                        <p className="font-semibold">{versionStats.total_tests}</p>
                        <p className="text-xs text-gray-400">tests</p>
                      </div>
                      <div className="text-center px-3 py-1 bg-gray-50 rounded">
                        <p className="font-semibold text-green-600">{versionStats.success_rate.toFixed(0)}%</p>
                        <p className="text-xs text-gray-400">succès</p>
                      </div>
                      <div className="text-center px-3 py-1 bg-gray-50 rounded">
                        <p className="font-semibold">{versionStats.avg_tokens}</p>
                        <p className="text-xs text-gray-400">tokens/test</p>
                      </div>
                    </div>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(version)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      {!version.is_default && version.status === 'stable' && (
                        <DropdownMenuItem onClick={() => setAsDefault(version)}>
                          <Star className="h-4 w-4 mr-2" />
                          Définir par défaut
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openEditModal(version)}>
                        <FileCode className="h-4 w-4 mr-2" />
                        Voir le prompt
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Changelog */}
              {version.changelog && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500 font-medium mb-1">Changelog</p>
                  <p className="text-sm text-gray-600">{version.changelog}</p>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {versions.length === 0 && (
        <Card className="p-12 text-center">
          <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Aucune version</h3>
          <p className="text-gray-500 mb-4">Créez votre première version du moteur de reconnaissance</p>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Créer une version
          </Button>
        </Card>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" />
              Nouvelle version
            </DialogTitle>
            <DialogDescription>
              Créez une nouvelle version du moteur de reconnaissance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Codename *</Label>
                <Input
                  value={formCodename}
                  onChange={(e) => setFormCodename(e.target.value)}
                  placeholder="ex: boreal"
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">Nom unique en minuscules</p>
              </div>
              <div>
                <Label>Numéro de version *</Label>
                <Input
                  value={formVersionNumber}
                  onChange={(e) => setFormVersionNumber(e.target.value)}
                  placeholder="ex: 1.0"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">🔬 Développement</SelectItem>
                  <SelectItem value="testing">🧪 Test</SelectItem>
                  <SelectItem value="stable">✅ Stable</SelectItem>
                  <SelectItem value="deprecated">📦 Déprécié</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Décrivez les améliorations de cette version..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label>Changelog</Label>
              <Textarea
                value={formChangelog}
                onChange={(e) => setFormChangelog(e.target.value)}
                placeholder="- Amélioration de la précision OCR&#10;- Nouveau traitement d'image..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Annuler
            </Button>
            <Button 
              onClick={createVersion} 
              disabled={saving || !formCodename.trim() || !formVersionNumber.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-purple-600" />
              Modifier {selectedVersion?.display_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Codename *</Label>
                <Input
                  value={formCodename}
                  onChange={(e) => setFormCodename(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Numéro de version *</Label>
                <Input
                  value={formVersionNumber}
                  onChange={(e) => setFormVersionNumber(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">🔬 Développement</SelectItem>
                  <SelectItem value="testing">🧪 Test</SelectItem>
                  <SelectItem value="stable">✅ Stable</SelectItem>
                  <SelectItem value="deprecated">📦 Déprécié</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label>Changelog</Label>
              <Textarea
                value={formChangelog}
                onChange={(e) => setFormChangelog(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            {selectedVersion?.prompt_template && (
              <div>
                <Label>Prompt template</Label>
                <Textarea
                  value={selectedVersion.prompt_template}
                  disabled
                  className="mt-1 bg-gray-50 font-mono text-xs"
                  rows={6}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Annuler
            </Button>
            <Button 
              onClick={updateVersion} 
              disabled={saving || !formCodename.trim() || !formVersionNumber.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
