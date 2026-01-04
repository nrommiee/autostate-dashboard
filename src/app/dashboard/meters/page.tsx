'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  MeterModel, 
  MeterType, 
  METER_TYPE_CONFIG,
  computeMeterModelStats 
} from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'

export default function MeterModelsPage() {
  const [models, setModels] = useState<MeterModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<MeterType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => {
    loadModels()
  }, [])

  async function loadModels() {
    setLoading(true)
    try {
      // Utiliser l'API pour récupérer les modèles
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

  const filteredModels = models.filter(model => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      if (!model.name.toLowerCase().includes(searchLower) &&
          !model.manufacturer.toLowerCase().includes(searchLower)) {
        return false
      }
    }
    
    // Type filter
    if (filterType !== 'all' && model.meter_type !== filterType) {
      return false
    }
    
    // Status filter
    if (filterStatus === 'active' && !model.is_active) return false
    if (filterStatus === 'inactive' && model.is_active) return false
    
    return true
  })

  // Group by type for summary
  const typeStats = models.reduce((acc, model) => {
    if (!acc[model.meter_type]) {
      acc[model.meter_type] = { count: 0, totalScans: 0 }
    }
    acc[model.meter_type].count++
    acc[model.meter_type].totalScans += model.total_scans
    return acc
  }, {} as Record<string, { count: number; totalScans: number }>)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modèles de compteurs</h1>
          <p className="text-gray-500">
            {models.length} modèle{models.length > 1 ? 's' : ''} configuré{models.length > 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/dashboard/meters/create">
          <Button>
            <span className="mr-2">+</span>
            Nouveau modèle
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {Object.entries(METER_TYPE_CONFIG).map(([type, config]) => {
          const stats = typeStats[type] || { count: 0, totalScans: 0 }
          return (
            <Card 
              key={type} 
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                filterType === type ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setFilterType(filterType === type ? 'all' : type as MeterType)}
            >
              <div className="text-2xl mb-1">{config.icon}</div>
              <div className="font-medium text-sm">{config.label}</div>
              <div className="text-2xl font-bold">{stats.count}</div>
              <div className="text-xs text-gray-500">{stats.totalScans} scans</div>
            </Card>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Rechercher par nom ou fabricant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        
        <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="active">Actifs</TabsTrigger>
            <TabsTrigger value="inactive">Inactifs</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {filterType !== 'all' && (
          <Button variant="outline" size="sm" onClick={() => setFilterType('all')}>
            ✕ {METER_TYPE_CONFIG[filterType].label}
          </Button>
        )}
      </div>

      {/* Models list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : filteredModels.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <div className="font-medium text-lg mb-2">Aucun modèle trouvé</div>
          <p className="text-gray-500 mb-4">
            {search || filterType !== 'all' 
              ? 'Essayez de modifier vos filtres' 
              : 'Créez votre premier modèle de compteur'}
          </p>
          {!search && filterType === 'all' && (
            <Link href="/dashboard/meters/create">
              <Button>Créer un modèle</Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredModels.map((model) => (
            <MeterModelCard key={model.id} model={model} onRefresh={loadModels} />
          ))}
        </div>
      )}
    </div>
  )
}

// Model card component
function MeterModelCard({ 
  model, 
  onRefresh 
}: { 
  model: MeterModel
  onRefresh: () => void 
}) {
  const config = METER_TYPE_CONFIG[model.meter_type]
  const stats = computeMeterModelStats(model)
  
  async function toggleActive() {
    try {
      // Utiliser le client supabase normal (avec RLS)
      await supabase
        .from('meter_models')
        .update({ is_active: !model.is_active })
        .eq('id', model.id)
      onRefresh()
    } catch (error) {
      console.error('Error toggling model:', error)
    }
  }

  return (
    <Card className={`p-4 ${!model.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Type icon */}
        <div 
          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: config.color + '20' }}
        >
          {config.icon}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{model.name}</h3>
            {model.is_verified && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                ✓ Vérifié
              </Badge>
            )}
            {!model.is_active && (
              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                Inactif
              </Badge>
            )}
          </div>
          
          <div className="text-sm text-gray-500 mb-2">
            {model.manufacturer || 'Fabricant inconnu'} • {config.label} • {model.unit}
          </div>
          
          <div className="text-sm text-gray-600 line-clamp-2">
            {model.ai_description || 'Aucune description'}
          </div>
          
          {/* Zones preview */}
          <div className="flex flex-wrap gap-1 mt-2">
            {model.zones.map((zone: any) => (
              <Badge key={zone.id} variant="outline" className="text-xs">
                {zone.label}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Stats */}
        <div className="text-right space-y-1">
          <div className="text-2xl font-bold">{model.usage_count}</div>
          <div className="text-xs text-gray-500">utilisations</div>
          
          {model.total_scans > 0 && (
            <>
              <div 
                className={`text-lg font-semibold ${
                  stats.successRate >= 80 ? 'text-green-600' : 
                  stats.successRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}
              >
                {stats.successRate}%
              </div>
              <div className="text-xs text-gray-500">succès</div>
            </>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link href={`/dashboard/meters/${model.id}`}>
            <Button variant="outline" size="sm">
              Modifier
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={toggleActive}
          >
            {model.is_active ? 'Désactiver' : 'Activer'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
