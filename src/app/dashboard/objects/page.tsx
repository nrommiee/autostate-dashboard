'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  ObjectTemplateWithStats, 
  ObjectCategory, 
  STATUS_CONFIG,
  ObjectsStats
} from '@/lib/objects-types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Plus, Search, MoreVertical, Pencil, Trash2, Check, X, 
  Eye, EyeOff, ChevronLeft, ChevronRight, Upload,
  Package, AlertTriangle, CheckCircle, Clock,
  Layers, FileText, Loader2, RefreshCw, Sparkles
} from 'lucide-react'

export default function ObjectsPage() {
  const router = useRouter()
  
  // Data
  const [objects, setObjects] = useState<ObjectTemplateWithStats[]>([])
  const [categories, setCategories] = useState<ObjectCategory[]>([])
  const [stats, setStats] = useState<ObjectsStats | null>(null)
  
  // UI State
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  
  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [objectToDelete, setObjectToDelete] = useState<ObjectTemplateWithStats | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Actions rapides
  const [validating, setValidating] = useState<string | null>(null)

  // ============================================
  // DATA LOADING
  // ============================================
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Charger les catégories
      const { data: categoriesData } = await supabase
        .from('object_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      
      if (categoriesData) setCategories(categoriesData)

      // Charger les objets avec stats via la vue
      const { data: objectsData } = await supabase
        .from('v_object_templates_with_stats')
        .select('*')
        .order('occurrence_count', { ascending: false })
      
      if (objectsData) setObjects(objectsData)

      // Calculer les stats
      if (objectsData) {
        const statsData: ObjectsStats = {
          total: objectsData.length,
          pending: objectsData.filter(o => o.status === 'pending').length,
          to_validate: objectsData.filter(o => o.status === 'to_validate').length,
          validated: objectsData.filter(o => o.status === 'validated').length,
          rejected: objectsData.filter(o => o.status === 'rejected').length,
          by_category: [],
          recent_extractions: 0,
          documents_processed: 0
        }
        
        // Stats par catégorie
        const catCounts: Record<string, { count: number; icon: string }> = {}
        objectsData.forEach(obj => {
          const catName = obj.category_name || 'Non catégorisé'
          if (!catCounts[catName]) {
            catCounts[catName] = { count: 0, icon: obj.category_icon || '📦' }
          }
          catCounts[catName].count++
        })
        statsData.by_category = Object.entries(catCounts)
          .map(([category_name, data]) => ({ category_name, ...data }))
          .sort((a, b) => b.count - a.count)
        
        // Compter les documents
        const { count: docsCount } = await supabase
          .from('imported_documents')
          .select('*', { count: 'exact', head: true })
        statsData.documents_processed = docsCount || 0
        
        setStats(statsData)
      }
    } catch (error) {
      console.error('Error loading objects:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ============================================
  // FILTERING
  // ============================================
  const filteredObjects = objects.filter(obj => {
    if (search) {
      const searchLower = search.toLowerCase()
      if (!obj.canonical_name.toLowerCase().includes(searchLower) &&
          !obj.description?.toLowerCase().includes(searchLower)) {
        return false
      }
    }
    if (filterStatus !== 'all' && obj.status !== filterStatus) return false
    if (filterCategory !== 'all' && obj.category_id !== filterCategory) return false
    return true
  })

  const totalPages = Math.ceil(filteredObjects.length / itemsPerPage)
  const paginatedObjects = filteredObjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // ============================================
  // ACTIONS
  // ============================================
  async function handleValidate(obj: ObjectTemplateWithStats) {
    setValidating(obj.id)
    try {
      await supabase
        .from('object_templates')
        .update({ status: 'validated', validated_at: new Date().toISOString() })
        .eq('id', obj.id)
      await loadData()
    } catch (error) {
      console.error('Error validating:', error)
    } finally {
      setValidating(null)
    }
  }

  async function handleReject(obj: ObjectTemplateWithStats) {
    setValidating(obj.id)
    try {
      await supabase
        .from('object_templates')
        .update({ status: 'rejected' })
        .eq('id', obj.id)
      await loadData()
    } catch (error) {
      console.error('Error rejecting:', error)
    } finally {
      setValidating(null)
    }
  }

  async function handleDelete() {
    if (!objectToDelete) return
    setDeleting(true)
    try {
      await supabase.from('object_templates').delete().eq('id', objectToDelete.id)
      setShowDeleteDialog(false)
      setObjectToDelete(null)
      await loadData()
    } catch (error) {
      console.error('Error deleting:', error)
    } finally {
      setDeleting(false)
    }
  }

  async function handleToggleActive(obj: ObjectTemplateWithStats) {
    try {
      await supabase
        .from('object_templates')
        .update({ is_active: !obj.is_active })
        .eq('id', obj.id)
      await loadData()
    } catch (error) {
      console.error('Error toggling active:', error)
    }
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7 text-teal-600" />
            Référentiel Objets
          </h1>
          <p className="text-muted-foreground">
            Base de connaissances des objets inspectables
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/objects/import">
            <Button variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Importer
            </Button>
          </Link>
          <Link href="/dashboard/objects/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Créer un objet
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Package className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.total || 0}</p>
              <p className="text-xs text-muted-foreground">Total objets</p>
            </div>
          </div>
        </Card>
        
        <Card 
          className="p-4 cursor-pointer hover:border-orange-300 transition-colors"
          onClick={() => setFilterStatus('to_validate')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats?.to_validate || 0}</p>
              <p className="text-xs text-muted-foreground">À valider</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats?.validated || 0}</p>
              <p className="text-xs text-muted-foreground">Validés</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.pending || 0}</p>
              <p className="text-xs text-muted-foreground">En attente</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats?.documents_processed || 0}</p>
              <p className="text-xs text-muted-foreground">Docs traités</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Categories Overview */}
      {stats && stats.by_category.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Répartition par catégorie
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.by_category.slice(0, 10).map(cat => (
              <Badge 
                key={cat.category_name}
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-gray-200"
                onClick={() => {
                  const category = categories.find(c => c.name === cat.category_name)
                  if (category) setFilterCategory(category.id)
                }}
              >
                <span>{cat.icon}</span>
                {cat.category_name}
                <span className="ml-1 text-muted-foreground">({cat.count})</span>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un objet..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="pl-9"
              />
            </div>
          </div>
          
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">⏳ En attente</SelectItem>
              <SelectItem value="to_validate">🔔 À valider</SelectItem>
              <SelectItem value="validated">✅ Validés</SelectItem>
              <SelectItem value="rejected">❌ Rejetés</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => { setSearch(''); setFilterStatus('all'); setFilterCategory('all') }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-teal-600" />
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        ) : filteredObjects.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">Aucun objet trouvé</h3>
            <p className="text-muted-foreground mb-4">
              {search || filterStatus !== 'all' || filterCategory !== 'all'
                ? 'Essayez de modifier vos filtres'
                : 'Commencez par créer ou importer des objets'}
            </p>
            {!search && filterStatus === 'all' && filterCategory === 'all' && (
              <div className="flex justify-center gap-2">
                <Link href="/dashboard/objects/create">
                  <Button>Créer un objet</Button>
                </Link>
                <Link href="/dashboard/objects/import">
                  <Button variant="outline">Importer</Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_140px_100px_80px_80px_80px_50px] gap-4 px-4 py-3 border-b bg-muted/50 text-sm font-medium text-muted-foreground">
              <div>Objet</div>
              <div>Catégorie</div>
              <div>Statut</div>
              <div className="text-center">Alias</div>
              <div className="text-center">Attributs</div>
              <div className="text-center">Dégâts</div>
              <div></div>
            </div>

            {/* Table Body */}
            <div className="divide-y">
              {paginatedObjects.map((obj) => {
                const statusConfig = STATUS_CONFIG[obj.status]
                
                return (
                  <div 
                    key={obj.id}
                    className="grid grid-cols-[1fr_140px_100px_80px_80px_80px_50px] gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
                  >
                    {/* Nom et description */}
                    <div>
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/dashboard/objects/${obj.id}`}
                          className="font-medium hover:text-teal-600 transition-colors"
                        >
                          {obj.canonical_name}
                        </Link>
                        {obj.is_common && (
                          <span title="Objet fréquent">
                            <Sparkles className="h-3 w-3 text-yellow-500" />
                          </span>
                        )}
                        {!obj.is_active && (
                          <span title="Inactif">
                            <EyeOff className="h-3 w-3 text-gray-400" />
                          </span>
                        )}
                      </div>
                      {obj.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-md">
                          {obj.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {obj.occurrence_count} occurrence{obj.occurrence_count > 1 ? 's' : ''}
                      </p>
                    </div>

                    {/* Catégorie */}
                    <div>
                      {obj.category_name ? (
                        <Badge 
                          variant="secondary" 
                          className="gap-1"
                          style={{ 
                            backgroundColor: (obj.category_color || '#6B7280') + '20',
                            color: obj.category_color || '#6B7280'
                          }}
                        >
                          {obj.category_icon} {obj.category_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </div>

                    {/* Statut */}
                    <div>
                      <Badge className={`${statusConfig.bgColor} ${statusConfig.color} gap-1`}>
                        {statusConfig.icon} {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Counts */}
                    <div className="text-center">
                      <span className="text-sm font-medium">{obj.alias_count}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-medium">{obj.attribute_count}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-medium">{obj.damage_count}</span>
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
                            <Link href={`/dashboard/objects/${obj.id}`}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Modifier
                            </Link>
                          </DropdownMenuItem>
                          
                          {obj.status === 'to_validate' && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => handleValidate(obj)}
                                disabled={validating === obj.id}
                              >
                                <Check className="h-4 w-4 mr-2 text-green-600" />
                                Valider
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleReject(obj)}
                                disabled={validating === obj.id}
                              >
                                <X className="h-4 w-4 mr-2 text-red-600" />
                                Rejeter
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          <DropdownMenuItem onClick={() => handleToggleActive(obj)}>
                            {obj.is_active ? (
                              <><EyeOff className="h-4 w-4 mr-2" />Désactiver</>
                            ) : (
                              <><Eye className="h-4 w-4 mr-2" />Activer</>
                            )}
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            onClick={() => { setObjectToDelete(obj); setShowDeleteDialog(true) }}
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
              <p className="text-sm text-muted-foreground">
                {filteredObjects.length} objet{filteredObjects.length > 1 ? 's' : ''}
                {(search || filterStatus !== 'all' || filterCategory !== 'all') && ' (filtré)'}
              </p>
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

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Supprimer cet objet ?
            </DialogTitle>
            <DialogDescription>
              Cette action est irréversible. L'objet "{objectToDelete?.canonical_name}" 
              et toutes ses données associées (alias, attributs, dégâts) seront supprimés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
