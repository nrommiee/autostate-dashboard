'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Profile } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
  UserCheck,
  UserPlus,
  Sparkles,
  FolderOpen,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  ArrowUpDown
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

// Types de compte
type AccountType = 'free' | 'subscription' | 'per_folder' | 'trial'

interface UserWithStats extends Profile {
  missions_count?: number
  last_activity?: string
}

// Configuration des types de compte
const ACCOUNT_TYPES: Record<AccountType, { label: string; color: string; bgColor: string; icon: string }> = {
  free: { label: 'Gratuit', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: '○' },
  subscription: { label: 'Abonnement', color: 'text-green-700', bgColor: 'bg-green-100', icon: '●' },
  per_folder: { label: 'Par dossier', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: '◐' },
  trial: { label: 'Test', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: '◔' },
}

// Mapper le subscription_status vers AccountType
function getAccountType(status: string): AccountType {
  switch (status) {
    case 'active': return 'subscription'
    case 'trialing': return 'trial'
    case 'per_folder': return 'per_folder'
    default: return 'free'
  }
}

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserWithStats[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  
  // Tri
  const [sortColumn, setSortColumn] = useState<string>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    free: 0,
    subscription: 0,
    per_folder: 0,
    trial: 0,
    // Évolutions (simulées pour l'instant)
    totalChange: 12.5,
    freeChange: 8.2,
    subscriptionChange: 25.0,
    trialChange: -5.0,
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    
    // Récupérer les profils
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profiles) {
      // Récupérer le nombre de missions par utilisateur
      const { data: missionCounts } = await supabase
        .from('missions')
        .select('created_by')
      
      const countByUser: Record<string, number> = {}
      missionCounts?.forEach(m => {
        countByUser[m.created_by] = (countByUser[m.created_by] || 0) + 1
      })

      const usersWithStats: UserWithStats[] = profiles.map(p => ({
        ...p,
        missions_count: countByUser[p.id] || 0,
        last_activity: p.last_sign_in_at || p.updated_at || p.created_at
      }))

      setUsers(usersWithStats)
      setFilteredUsers(usersWithStats)

      // Calculer les stats
      const total = profiles.length
      const free = profiles.filter(p => getAccountType(p.subscription_status) === 'free').length
      const subscription = profiles.filter(p => getAccountType(p.subscription_status) === 'subscription').length
      const per_folder = profiles.filter(p => getAccountType(p.subscription_status) === 'per_folder').length
      const trial = profiles.filter(p => getAccountType(p.subscription_status) === 'trial').length

      setStats(prev => ({ ...prev, total, free, subscription, per_folder, trial }))
    }

    setLoading(false)
  }

  // Filtrage
  useEffect(() => {
    let filtered = [...users]
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(u => 
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.company_name?.toLowerCase().includes(q)
      )
    }

    // Tri
    filtered.sort((a, b) => {
      let aVal: any = a[sortColumn as keyof UserWithStats]
      let bVal: any = b[sortColumn as keyof UserWithStats]
      
      if (sortColumn === 'missions_count') {
        aVal = a.missions_count || 0
        bVal = b.missions_count || 0
      }
      
      if (aVal === null || aVal === undefined) aVal = ''
      if (bVal === null || bVal === undefined) bVal = ''
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    setFilteredUsers(filtered)
    setCurrentPage(1)
  }, [searchQuery, users, sortColumn, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + rowsPerPage)

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Composant pour les stats cards
  function StatCard({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    iconBg 
  }: { 
    title: string
    value: number
    change: number
    icon: any
    iconBg: string
  }) {
    const isPositive = change >= 0
    return (
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            <p className="text-3xl font-bold">{value.toLocaleString()}</p>
          </div>
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
          <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{change}%
          </span>
          <span className="text-sm text-gray-500 ml-1">vs mois dernier</span>
        </div>
      </Card>
    )
  }

  // Badge de type de compte
  function AccountTypeBadge({ type }: { type: AccountType }) {
    const config = ACCOUNT_TYPES[type]
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
        <span className="text-[10px]">{config.icon}</span>
        {config.label}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <p className="text-gray-500">{users.length} utilisateurs enregistrés</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Utilisateurs"
          value={stats.total}
          change={stats.totalChange}
          icon={Users}
          iconBg="bg-gray-100"
        />
        <StatCard
          title="Gratuits"
          value={stats.free}
          change={stats.freeChange}
          icon={UserPlus}
          iconBg="bg-gray-100"
        />
        <StatCard
          title="Abonnements"
          value={stats.subscription}
          change={stats.subscriptionChange}
          icon={UserCheck}
          iconBg="bg-green-100"
        />
        <StatCard
          title="Test / Essai"
          value={stats.trial}
          change={stats.trialChange}
          icon={Sparkles}
          iconBg="bg-orange-100"
        />
      </div>

      {/* Table Card */}
      <Card>
        {/* Search & Filters */}
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom, email..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50/50">
                <th className="text-left p-4 font-medium text-gray-600 text-sm">
                  <button 
                    className="flex items-center gap-1 hover:text-gray-900"
                    onClick={() => handleSort('full_name')}
                  >
                    Utilisateur
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium text-gray-600 text-sm">
                  <button 
                    className="flex items-center gap-1 hover:text-gray-900"
                    onClick={() => handleSort('email')}
                  >
                    Email
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium text-gray-600 text-sm">
                  <button 
                    className="flex items-center gap-1 hover:text-gray-900"
                    onClick={() => handleSort('subscription_status')}
                  >
                    Type
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium text-gray-600 text-sm">
                  <button 
                    className="flex items-center gap-1 hover:text-gray-900"
                    onClick={() => handleSort('missions_count')}
                  >
                    Missions
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium text-gray-600 text-sm">
                  <button 
                    className="flex items-center gap-1 hover:text-gray-900"
                    onClick={() => handleSort('created_at')}
                  >
                    Inscription
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium text-gray-600 text-sm">
                  <button 
                    className="flex items-center gap-1 hover:text-gray-900"
                    onClick={() => handleSort('last_activity')}
                  >
                    Dernière activité
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/users/${user.id}`)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-medium text-sm">
                          {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.full_name || 'Sans nom'}
                          </p>
                          {user.company_name && (
                            <p className="text-xs text-gray-500">{user.company_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-600 text-sm">{user.email}</span>
                    </td>
                    <td className="p-4">
                      <AccountTypeBadge type={getAccountType(user.subscription_status)} />
                    </td>
                    <td className="p-4">
                      <span className="text-gray-900 font-medium">{user.missions_count || 0}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-600 text-sm">
                        {format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-500 text-sm">
                        {user.last_activity ? formatDistanceToNow(new Date(user.last_activity), { 
                          addSuffix: true, 
                          locale: fr 
                        }) : '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            {filteredUsers.length > 0 ? (
              <>
                {startIndex + 1}-{Math.min(startIndex + rowsPerPage, filteredUsers.length)} sur {filteredUsers.length} utilisateur(s)
              </>
            ) : (
              '0 utilisateur'
            )}
          </p>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Lignes par page</span>
              <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1) }}>
                <SelectTrigger className="w-16 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-600 mr-2">
                Page {currentPage} sur {totalPages || 1}
              </span>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
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
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
