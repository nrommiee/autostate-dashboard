"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Gauge, Droplet, Zap, Flame, Fuel, Thermometer, MoreHorizontal, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Types
interface MeterModel {
  id: string
  name: string
  manufacturer: string | null
  meter_type: string
  unit: string | null
  ai_description: string | null
  zones: any[]
  reference_photos: string[]
  is_active: boolean
  usage_count: number
  success_count: number
  fail_count: number
  avg_confidence: number | null
  created_at: string
}

// Config des types
const METER_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  water_general: { label: 'Eau - Général', icon: Droplet, color: 'text-cyan-500 bg-cyan-50' },
  water_passage: { label: 'Eau - Passage', icon: Droplet, color: 'text-blue-500 bg-blue-50' },
  electricity: { label: 'Électricité', icon: Zap, color: 'text-yellow-500 bg-yellow-50' },
  gas: { label: 'Gaz', icon: Flame, color: 'text-orange-500 bg-orange-50' },
  oil_tank: { label: 'Cuve mazout', icon: Fuel, color: 'text-amber-700 bg-amber-50' },
  calorimeter: { label: 'Calorimètre', icon: Thermometer, color: 'text-red-500 bg-red-50' },
  other: { label: 'Autre', icon: Gauge, color: 'text-gray-500 bg-gray-50' },
}

export default function MetersPage() {
  const [models, setModels] = useState<MeterModel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<string>('all')

  // Fetch models
  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/meter-models')
      if (response.ok) {
        const data = await response.json()
        setModels(data)
      }
    } catch (error) {
      console.error('Error fetching models:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter models
  const filteredModels = models.filter(model => {
    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!model.name.toLowerCase().includes(query) && 
          !model.manufacturer?.toLowerCase().includes(query)) {
        return false
      }
    }
    
    // Type filter
    if (filterType !== 'all' && model.meter_type !== filterType) {
      return false
    }
    
    // Active filter
    if (filterActive === 'active' && !model.is_active) return false
    if (filterActive === 'inactive' && model.is_active) return false
    
    return true
  })

  // Stats by type
  const statsByType = Object.entries(METER_TYPE_CONFIG).map(([type, config]) => {
    const count = models.filter(m => m.meter_type === type).length
    const totalScans = models
      .filter(m => m.meter_type === type)
      .reduce((sum, m) => sum + m.usage_count, 0)
    return { type, ...config, count, totalScans }
  }).filter(s => s.count > 0)

  // Calculate success rate
  const getSuccessRate = (model: MeterModel) => {
    const total = model.success_count + model.fail_count
    if (total === 0) return null
    return Math.round((model.success_count / total) * 100)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modèles de compteurs</h1>
          <p className="text-gray-500">{models.length} modèle(s) enregistré(s)</p>
        </div>
        <Link href="/dashboard/meters/create">
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau modèle
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      {statsByType.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {statsByType.map(stat => {
            const Icon = stat.icon
            return (
              <div 
                key={stat.type}
                className="bg-white rounded-lg border p-4 cursor-pointer hover:border-teal-300 transition-colors"
                onClick={() => setFilterType(stat.type)}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="mt-3 font-semibold text-lg">{stat.count}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.totalScans} scans</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Rechercher un modèle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(METER_TYPE_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Models list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          Chargement...
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="text-center py-12">
          <Gauge className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">
            {models.length === 0 
              ? "Aucun modèle créé" 
              : "Aucun résultat pour cette recherche"
            }
          </p>
          {models.length === 0 && (
            <Link href="/dashboard/meters/create">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Créer un modèle
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map(model => {
            const typeConfig = METER_TYPE_CONFIG[model.meter_type] || METER_TYPE_CONFIG.other
            const Icon = typeConfig.icon
            const successRate = getSuccessRate(model)
            
            return (
              <div 
                key={model.id}
                className="bg-white rounded-lg border p-4 hover:border-teal-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{model.name}</h3>
                      <p className="text-sm text-gray-500">{model.manufacturer || 'Fabricant inconnu'}</p>
                    </div>
                  </div>
                  
                  {model.is_active ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      Actif
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      <XCircle className="w-3 h-3" />
                      Inactif
                    </span>
                  )}
                </div>

                {/* Photo preview */}
                {model.reference_photos && model.reference_photos.length > 0 && (
                  <div className="mt-3">
                    <img 
                      src={model.reference_photos[0]} 
                      alt={model.name}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* Zones count */}
                <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                  <span>{model.zones?.length || 0} zone(s)</span>
                  <span>•</span>
                  <span>{model.unit || 'Unité non définie'}</span>
                </div>

                {/* Stats */}
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {model.usage_count} scan(s)
                  </span>
                  {successRate !== null && (
                    <span className={`font-medium ${
                      successRate >= 80 ? 'text-green-600' :
                      successRate >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {successRate}% réussite
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
