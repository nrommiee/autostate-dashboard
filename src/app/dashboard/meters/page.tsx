'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  MeterModel, 
  MeterType, 
  METER_TYPE_CONFIG,
} from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import Image from 'next/image'
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Gauge, 
  CheckCircle, 
  XCircle, 
  BarChart3,
  Search,
  MoreVertical,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

// Display type labels
const DISPLAY_TYPE_LABELS: Record<string, string> = {
  mechanical: 'Mécanique',
  digital: 'Digital',
  dials: 'Cadrans',
  other: 'Autre'
}

export default function MeterModelsPage() {
  const [models, setModels] = useState<MeterModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    loadModels()
  }, [])

  async function loadModels() {
    setLoading(true)
    try {
      const response = await fetch('/api/meter-models')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setModels(data || [])
    } catch (error) {
      console.error('Error loading meter models:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate stats
  const stats = {
    totalModels: models.filter(m => m.status === 'active').length,
    draftModels: models.filter(m => m.status === 'draft').length,
    totalScans: models.reduce((acc, m) => acc + (m.total_scans || 0), 0),
    successfulScans: models.reduce((acc, m) => acc + (m.success_count || 0), 0),
    failedScans: models.reduce((acc, m) => acc + (m.fail_count || 0), 0),
  }

  const successRate = stats.totalScans > 0 
    ? Math.round((stats.successfulScans / stats.totalScans) * 100) 
    : 0

  // Filter models
  const filteredModels = models.filter(model => {
    if (search) {
      const searchLower = search.toLowerCase()
      if (!model.name.toLowerCase().includes(searchLower) &&
          !model.manufacturer?.toLowerCase().includes(searchLower)) {
        return false
      }
    }
    if (filterType !== 'all' && model.meter_type !== filterType) return false
    if (filterStatus !== 'all' && model.status !== filterStatus) return false
    return true
  })

  // Pagination
  const totalPages = Math.ceil(filteredModels.length / itemsPerPage)
  const paginatedModels = filteredModels.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  async function toggleActive(model: MeterModel) {
    try {
      const newStatus = model.status === 'active' ? 'archived' : 'active'
      await supabase
        .from('meter_models')
        .update({ status: newStatus })
        .eq('id', model.id)
      loadModels()
    } catch (error) {
      console.error('Error toggling model:', error)
    }
  }

  async function deleteModel(model: MeterModel) {
    if (!confirm(`Supprimer le modèle "${model.name}" ?`)) return
    try {
      await supabase
        .from('meter_models')
        .delete()
        .eq('id', model.id)
      loadModels()
    } catch (error) {
      console.error('Error deleting model:', error)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modèles de compteurs</h1>
          <p className="text-muted-foreground">
            Gérez vos modèles de compteurs pour la reconnaissance automatique
          </p>
        </div>
        <Link href="/dashboard/meters/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Créer un modèle
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Modèles actifs */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Modèles actifs</span>
            <Badge variant="secondary" className="bg-teal-50 text-teal-700 gap-1">
              <TrendingUp className="h-3 w-3" />
              {models.length > 0 ? '+' + Math.round((stats.totalModels / models.length) * 100) + '%' : '0%'}
            </Badge>
          </div>
          <div className="text-3xl font-bold">{stats.totalModels}</div>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            <span>sur {models.length} modèles</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Prêts pour la reconnaissance</p>
        </Card>

        {/* Scans total */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Scans total</span>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 gap-1">
              <BarChart3 className="h-3 w-3" />
              Ce mois
            </Badge>
          </div>
          <div className="text-3xl font-bold">{stats.totalScans.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span>Analyses effectuées</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Sur tous les compteurs</p>
        </Card>

        {/* Réussites */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Réussites</span>
            <Badge variant="secondary" className="bg-green-50 text-green-700 gap-1">
              <TrendingUp className="h-3 w-3" />
              {successRate}%
            </Badge>
          </div>
          <div className="text-3xl font-bold text-green-600">{stats.successfulScans.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Lectures validées</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Taux de réussite excellent</p>
        </Card>

        {/* Échecs */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Échecs</span>
            <Badge variant="secondary" className="bg-red-50 text-red-700 gap-1">
              <TrendingDown className="h-3 w-3" />
              {100 - successRate}%
            </Badge>
          </div>
          <div className="text-3xl font-bold text-red-600">{stats.failedScans.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <XCircle className="h-4 w-4 text-red-600" />
            <span>À améliorer</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Nécessite attention</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un modèle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Type filter */}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type de compteur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {Object.entries(METER_TYPE_CONFIG).map(([type, config]) => (
                <SelectItem key={type} value={type}>
                  {config.icon} {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="archived">Archivés</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            Chargement...
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="p-12 text-center">
            <Gauge className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Aucun modèle trouvé</h3>
            <p className="text-muted-foreground mb-4">
              {search || filterType !== 'all' || filterStatus !== 'all'
                ? 'Essayez de modifier vos filtres'
                : 'Créez votre premier modèle de compteur'}
            </p>
            {!search && filterType === 'all' && filterStatus === 'all' && (
              <Link href="/dashboard/meters/create">
                <Button>Créer un modèle</Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-[auto_1fr_120px_100px_120px_80px_80px_80px_80px_50px] gap-4 px-4 py-3 border-b bg-muted/50 text-sm font-medium text-muted-foreground">
              <div className="w-12"></div>
              <div>Nom du compteur</div>
              <div>Type</div>
              <div>Statut</div>
              <div>Affichage</div>
              <div className="text-center">Scans</div>
              <div className="text-center">Réussis</div>
              <div className="text-center">Ratés</div>
              <div className="text-center">Tests</div>
              <div></div>
            </div>

            {/* Table Body */}
            <div className="divide-y">
              {paginatedModels.map((model) => {
                const config = METER_TYPE_CONFIG[model.meter_type] || { icon: '📊', label: model.meter_type, color: '#6B7280' }
                const displayType = model.ai_analysis_data?.display_type || 'mechanical'
                const failed = model.fail_count || 0
                const photo = model.reference_photos?.[0]

                return (
                  <div 
                    key={model.id}
                    className="grid grid-cols-[auto_1fr_120px_100px_120px_80px_80px_80px_80px_50px] gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
                  >
                    {/* Photo */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                      {photo ? (
                        <img 
                          src={photo} 
                          alt={model.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">{config.icon}</span>
                      )}
                    </div>

                    {/* Name */}
                    <div>
                      <div className="font-medium">{model.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {model.manufacturer || 'Fabricant inconnu'}
                      </div>
                    </div>

                    {/* Type */}
                    <div>
                      <Badge 
                        variant="secondary" 
                        className="gap-1"
                        style={{ 
                          backgroundColor: config.color + '20',
                          color: config.color 
                        }}
                      >
                        {config.icon} {config.label}
                      </Badge>
                    </div>

                    {/* Status */}
                    <div>
                      {model.status === 'active' ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                          Actif
                        </Badge>
                      ) : model.status === 'draft' ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                          <span className="w-2 h-2 rounded-full bg-yellow-500 mr-1.5"></span>
                          Brouillon
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                          <span className="w-2 h-2 rounded-full bg-gray-400 mr-1.5"></span>
                          Archivé
                        </Badge>
                      )}
                    </div>

                    {/* Display type */}
                    <div className="text-sm text-muted-foreground">
                      {DISPLAY_TYPE_LABELS[displayType] || displayType}
                    </div>

                    {/* Scans */}
                    <div className="text-center font-medium">
                      {model.total_scans || 0}
                    </div>

                    {/* Success */}
                    <div className="text-center font-medium text-green-600">
                      {model.success_count || 0}
                    </div>

                    {/* Failed */}
                    <div className="text-center font-medium text-red-600">
                      {failed}
                    </div>

                    {/* Tests (Labs) */}
                    <div className="text-center font-medium text-purple-600">
                      {model.test_count || 0}
                    </div>

                    {/* Actions */}
                    <div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/meters/${model.id}`}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Modifier
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive(model)}>
                            {model.status === 'active' ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Archiver
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Activer
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteModel(model)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                {filteredModels.length} modèle{filteredModels.length > 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} sur {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
