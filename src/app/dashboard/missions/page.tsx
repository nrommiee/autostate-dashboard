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
  HardDrive,
  FileText,
  Database
} from 'lucide-react'

// ============================================
// CONSTANTS
// ============================================
// Supabase Storage pricing: $0.021/GB/month
const STORAGE_COST_PER_GB_MONTH = 0.021

// UUID regex to detect inspection folders
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-/

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
  // API Costs
  total_api_cost: number
  api_costs_breakdown: ApiCostBreakdown[]
  // Storage
  storage_bytes: number
  storage_files: number
  storage_cost: number
  // Combined
  total_cost: number
}

interface ApiCostBreakdown {
  function_id: string
  function_name: string
  count: number
  cost: number
}

interface StorageByInspection {
  inspection_id: string
  total_bytes: number
  file_count: number
}

// ============================================
// HELPERS
// ============================================
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function calculateStorageCost(bytes: number): number {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb * STORAGE_COST_PER_GB_MONTH
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function MissionsPage() {
  const [loading, setLoading] = useState(true)
  const [missions, setMissions] = useState<Mission[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'date_time' | 'total_cost'>('date_time')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  
  // Global stats
  const [totalStorageBytes, setTotalStorageBytes] = useState(0)
  const [totalFiles, setTotalFiles] = useState(0)
  
  const pageSize = 20

  useEffect(() => {
    loadMissions()
  }, [currentPage, sortField, sortOrder])

  async function loadMissions() {
    setLoading(true)
    try {
      // 1. Fetch inspections with user info
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
        .order('date_time', { ascending: sortOrder === 'asc' })
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

      const inspectionIds = inspectionsData.map(i => i.id)

      // 2. Get API costs for each inspection
      const { data: apiLogs } = await supabase
        .from('api_usage_logs')
        .select('*')
        .in('inspection_id', inspectionIds)

      // Group API costs by inspection
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

      // 3. Get storage for ALL inspection-related files
      // Query storage.objects and group by first folder (if it's a UUID)
      const { data: storageData } = await supabase
        .rpc('get_storage_by_inspection')
        .in('inspection_id', inspectionIds)

      // If RPC doesn't exist, fallback to direct query
      let storageByInspection: Record<string, StorageByInspection> = {}
      
      if (storageData) {
        storageData.forEach((s: StorageByInspection) => {
          storageByInspection[s.inspection_id] = s
        })
      } else {
        // Fallback: fetch all storage objects and filter client-side
        const { data: allObjects } = await supabase
          .from('storage_objects_view')
          .select('name, metadata')
        
        if (allObjects) {
          allObjects.forEach((obj: any) => {
            const firstFolder = obj.name?.split('/')[0]
            if (firstFolder && UUID_REGEX.test(firstFolder)) {
              if (!storageByInspection[firstFolder]) {
                storageByInspection[firstFolder] = {
                  inspection_id: firstFolder,
                  total_bytes: 0,
                  file_count: 0
                }
              }
              storageByInspection[firstFolder].total_bytes += parseInt(obj.metadata?.size) || 0
              storageByInspection[firstFolder].file_count++
            }
          })
        }
      }

      // 4. Get global storage stats
      const { data: globalStorage } = await supabase
        .rpc('get_total_storage')
      
      if (globalStorage) {
        setTotalStorageBytes(globalStorage.total_bytes || 0)
        setTotalFiles(globalStorage.file_count || 0)
      }

      // 5. Map to Mission objects
      const mappedMissions: Mission[] = inspectionsData.map((inspection: any) => {
        const apiCosts = costsByInspection[inspection.id] || []
        const totalApiCost = apiCosts.reduce((acc, c) => acc + c.cost, 0)
        
        const storage = storageByInspection[inspection.id] || { total_bytes: 0, file_count: 0 }
        const storageCost = calculateStorageCost(storage.total_bytes)
        
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
          total_api_cost: totalApiCost,
          api_costs_breakdown: apiCosts,
          storage_bytes: storage.total_bytes,
          storage_files: storage.file_count,
          storage_cost: storageCost,
          total_cost: totalApiCost + storageCost
        }
      })

      // Sort by total_cost if needed
      if (sortField === 'total_cost') {
        mappedMissions.sort((a, b) => 
          sortOrder === 'asc' 
            ? a.total_cost - b.total_cost 
            : b.total_cost - a.total_cost
        )
      }

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

  // Calculate page stats
  const pageTotalCost = filteredMissions.reduce((acc, m) => acc + m.total_cost, 0)
  const pageStorageBytes = filteredMissions.reduce((acc, m) => acc + m.storage_bytes, 0)
  const pageFiles = filteredMissions.reduce((acc, m) => acc + m.storage_files, 0)

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
  const toggleSort = (field: 'date_time' | 'total_cost') => {
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
          <p className="text-gray-500 text-sm">États des lieux avec coûts API et stockage</p>
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

      {/* Stats - 4 blocs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Calendar className="h-4 w-4" />
            Total missions
          </div>
          <div className="text-2xl font-bold">{totalCount}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <HardDrive className="h-4 w-4" />
            Stockage total
          </div>
          <div className="text-2xl font-bold">{formatBytes(totalStorageBytes || pageStorageBytes)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign className="h-4 w-4" />
            Coût total
          </div>
          <div className="text-2xl font-bold text-teal-600">
            ${pageTotalCost.toFixed(2)}
          </div>
          <div className="text-xs text-gray-400">API + Stockage</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <FileText className="h-4 w-4" />
            Total fichiers
          </div>
          <div className="text-2xl font-bold">{totalFiles || pageFiles}</div>
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
                <th className="text-center p-4 font-medium text-gray-600">
                  <div className="flex items-center gap-1 justify-center">
                    <HardDrive className="h-4 w-4" />
                    Stockage
                  </div>
                </th>
                <th className="text-center p-4 font-medium text-gray-600">
                  <div className="flex items-center gap-1 justify-center">
                    <FileText className="h-4 w-4" />
                    Fichiers
                  </div>
                </th>
                <th className="text-right p-4 font-medium text-teal-600">
                  <button 
                    onClick={() => toggleSort('total_cost')}
                    className="flex items-center gap-1 hover:text-teal-700 ml-auto"
                  >
                    <DollarSign className="h-4 w-4" />
                    Coût total
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="p-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : filteredMissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
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
                    <td className="p-4 text-center">
                      <span className={mission.storage_bytes > 0 ? 'font-medium' : 'text-gray-400'}>
                        {formatBytes(mission.storage_bytes)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={mission.storage_files > 0 ? 'font-medium' : 'text-gray-400'}>
                        {mission.storage_files}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className={`font-bold ${mission.total_cost > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                        ${mission.total_cost.toFixed(3)}
                      </div>
                      {mission.total_cost > 0 && (
                        <div className="text-xs text-gray-400">
                          API: ${mission.total_api_cost.toFixed(3)}
                        </div>
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
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            {totalPages > 1 
              ? `Page ${currentPage} sur ${totalPages} (${totalCount} missions)`
              : `${totalCount} mission${totalCount > 1 ? 's' : ''}`
            }
          </div>
          {totalPages > 1 && (
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
          )}
        </div>
      </Card>
    </div>
  )
}
