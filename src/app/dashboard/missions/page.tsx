'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  DollarSign, 
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Eye,
  Filter
} from 'lucide-react'

// ============================================
// TYPES
// ============================================
interface Mission {
  id: string
  reference: string
  date_time: string
  end_date_time: string
  status: string
  mission_type: string
  property_type: string
  // Address
  address_street: string
  address_number: string
  address_city: string
  address_postal_code: string
  // User
  user_id: string
  user_email?: string
  user_name?: string
  // Costs (calculated)
  total_api_cost: number
  api_costs_breakdown: ApiCostBreakdown[]
}

interface ApiCostBreakdown {
  function_id: string
  function_name: string
  count: number
  cost: number
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function MissionsPage() {
  const [loading, setLoading] = useState(true)
  const [missions, setMissions] = useState<Mission[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'date_time' | 'total_api_cost'>('date_time')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadMissions()
  }, [currentPage, sortField, sortOrder])

  async function loadMissions() {
    setLoading(true)
    try {
      // Fetch inspections with user info
      let query = supabase
        .from('inspections')
        .select(`
          id,
          reference,
          date_time,
          end_date_time,
          status,
          mission_type,
          property_type,
          address_street,
          address_number,
          address_city,
          address_postal_code,
          user_id,
          profiles!inspections_user_id_fkey (
            email,
            full_name
          )
        `, { count: 'exact' })
        .order(sortField, { ascending: sortOrder === 'asc' })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

      const { data: inspectionsData, count, error } = await query

      if (error) {
        console.error('Error fetching inspections:', error)
        setLoading(false)
        return
      }

      setTotalCount(count || 0)

      if (!inspectionsData || inspectionsData.length === 0) {
        setMissions([])
        setLoading(false)
        return
      }

      // Get API costs for each inspection
      const inspectionIds = inspectionsData.map(i => i.id)
      
      const { data: apiLogs } = await supabase
        .from('api_usage_logs')
        .select('*')
        .in('inspection_id', inspectionIds)

      // Group costs by inspection
      const costsByInspection: Record<string, ApiCostBreakdown[]> = {}
      
      if (apiLogs) {
        apiLogs.forEach(log => {
          if (!log.inspection_id) return
          
          if (!costsByInspection[log.inspection_id]) {
            costsByInspection[log.inspection_id] = []
          }
          
          const existing = costsByInspection[log.inspection_id].find(
            c => c.function_id === log.function_id
          )
          
          if (existing) {
            existing.count++
            existing.cost += parseFloat(log.cost_usd) || 0
          } else {
            costsByInspection[log.inspection_id].push({
              function_id: log.function_id,
              function_name: log.function_name || log.function_id,
              count: 1,
              cost: parseFloat(log.cost_usd) || 0
            })
          }
        })
      }

      // Map to Mission objects
      const mappedMissions: Mission[] = inspectionsData.map((inspection: any) => {
        const costs = costsByInspection[inspection.id] || []
        const totalCost = costs.reduce((acc, c) => acc + c.cost, 0)
        
        return {
          id: inspection.id,
          reference: inspection.reference || `EDL-${inspection.id.slice(0, 8)}`,
          date_time: inspection.date_time,
          end_date_time: inspection.end_date_time,
          status: inspection.status,
          mission_type: inspection.mission_type,
          property_type: inspection.property_type,
          address_street: inspection.address_street || '',
          address_number: inspection.address_number || '',
          address_city: inspection.address_city || '',
          address_postal_code: inspection.address_postal_code || '',
          user_id: inspection.user_id,
          user_email: inspection.profiles?.email,
          user_name: inspection.profiles?.full_name,
          total_api_cost: totalCost,
          api_costs_breakdown: costs
        }
      })

      setMissions(mappedMissions)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter missions by search
  const filteredMissions = missions.filter(m => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      m.reference?.toLowerCase().includes(query) ||
      m.address_street?.toLowerCase().includes(query) ||
      m.address_city?.toLowerCase().includes(query) ||
      m.user_name?.toLowerCase().includes(query) ||
      m.user_email?.toLowerCase().includes(query)
    )
  })

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-BE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleTimeString('fr-BE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  // Status badge
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      inProgress: 'bg-orange-100 text-orange-700',
      completed: 'bg-blue-100 text-blue-700',
      signed: 'bg-green-100 text-green-700',
      archived: 'bg-gray-100 text-gray-500'
    }
    const labels: Record<string, string> = {
      draft: 'Brouillon',
      inProgress: 'En cours',
      completed: 'Terminé',
      signed: 'Signé',
      archived: 'Archivé'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.draft}`}>
        {labels[status] || status}
      </span>
    )
  }

  // Toggle sort
  const toggleSort = (field: 'date_time' | 'total_api_cost') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // Pagination
  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Missions</h1>
          <p className="text-gray-500 text-sm">États des lieux avec coûts API détaillés</p>
        </div>
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par adresse, référence, utilisateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Total missions</div>
          <div className="text-2xl font-bold">{totalCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Cette page</div>
          <div className="text-2xl font-bold">{filteredMissions.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Coût total (page)</div>
          <div className="text-2xl font-bold text-teal-600">
            ${filteredMissions.reduce((acc, m) => acc + m.total_api_cost, 0).toFixed(2)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-gray-500 text-sm mb-1">Coût moyen/mission</div>
          <div className="text-2xl font-bold">
            ${filteredMissions.length > 0 
              ? (filteredMissions.reduce((acc, m) => acc + m.total_api_cost, 0) / filteredMissions.length).toFixed(3)
              : '0.000'
            }
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">
                  <button 
                    onClick={() => toggleSort('date_time')}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    <Calendar className="h-4 w-4" />
                    Date RDV
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Heure
                  </div>
                </th>
                <th className="text-left p-4 font-medium text-gray-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Adresse
                  </div>
                </th>
                <th className="text-left p-4 font-medium text-gray-600">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Utilisateur
                  </div>
                </th>
                <th className="text-left p-4 font-medium text-gray-600">Statut</th>
                <th className="text-right p-4 font-medium text-gray-600">
                  <button 
                    onClick={() => toggleSort('total_api_cost')}
                    className="flex items-center gap-1 hover:text-gray-900 ml-auto"
                  >
                    <DollarSign className="h-4 w-4" />
                    Coût API
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium text-gray-600">Détail coûts</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : filteredMissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Aucune mission trouvée
                  </td>
                </tr>
              ) : (
                filteredMissions.map((mission) => (
                  <tr key={mission.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-medium">{formatDate(mission.date_time)}</div>
                      <div className="text-xs text-gray-500">{mission.reference}</div>
                    </td>
                    <td className="p-4 text-gray-600">
                      {formatTime(mission.date_time)}
                    </td>
                    <td className="p-4">
                      <div className="font-medium">
                        {mission.address_street} {mission.address_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {mission.address_postal_code} {mission.address_city}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{mission.user_name || '-'}</div>
                      <div className="text-sm text-gray-500">{mission.user_email}</div>
                    </td>
                    <td className="p-4">
                      {statusBadge(mission.status)}
                    </td>
                    <td className="p-4 text-right">
                      <span className={`font-bold ${mission.total_api_cost > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                        ${mission.total_api_cost.toFixed(3)}
                      </span>
                    </td>
                    <td className="p-4">
                      {mission.api_costs_breakdown.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {mission.api_costs_breakdown.map((cost) => (
                            <span 
                              key={cost.function_id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs"
                              title={`${cost.function_name}: ${cost.count} requêtes, $${cost.cost.toFixed(4)}`}
                            >
                              <span className="font-medium">{cost.function_id.replace('_', ' ')}</span>
                              <span className="text-gray-500">×{cost.count}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Link href={`/dashboard/missions/${mission.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-gray-500">
              Page {currentPage} sur {totalPages} ({totalCount} missions)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
