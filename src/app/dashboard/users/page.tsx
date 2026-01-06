// src/app/dashboard/users/page.tsx
// Users page with impersonation button

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Profile } from '@/lib/supabase'
import { startImpersonation, ROLE_CONFIG, UserRole } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  ArrowUpDown,
  Eye,
  Mail,
  UserCog,
  Loader2
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface UserWithStats extends Profile {
  missions_count?: number
  last_activity?: string
  role: UserRole
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
  
  // Impersonation dialog
  const [impersonateDialog, setImpersonateDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null)
  const [impersonating, setImpersonating] = useState(false)
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    admin: 0,
    owner: 0,
    tenant: 0,
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profiles) {
      const { data: missionCounts } = await supabase
        .from('missions')
        .select('created_by')
      
      const countByUser: Record<string, number> = {}
      missionCounts?.forEach(m => {
        countByUser[m.created_by] = (countByUser[m.created_by] || 0) + 1
      })

      const usersWithStats: UserWithStats[] = profiles.map(p => ({
        ...p,
        role: (p.role || 'owner') as UserRole,
        missions_count: countByUser[p.id] || 0,
        last_activity: p.last_sign_in_at || p.updated_at || p.created_at
      }))

      setUsers(usersWithStats)
      setFilteredUsers(usersWithStats)

      // Calculate stats by role
      const total = profiles.length
      const admin = profiles.filter(p => p.role === 'admin').length
      const owner = profiles.filter(p => p.role === 'owner' || !p.role).length
      const tenant = profiles.filter(p => p.role === 'tenant').length

      setStats({ total, admin, owner, tenant })
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
        u.full_name?.toLowerCase().includes(q)
      )
    }

    // Tri
    filtered.sort((a, b) => {
      let aVal: any = a[sortColumn as keyof UserWithStats]
      let bVal: any = b[sortColumn as keyof UserWithStats]
      
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

  async function handleImpersonate() {
    if (!selectedUser) return
    
    setImpersonating(true)
    
    const result = await startImpersonation(selectedUser.id, 'Support client depuis dashboard admin')
    
    if (result.success) {
      // Redirect to portal as the impersonated user
      router.push('/portal')
    } else {
      alert('Erreur: ' + result.error)
    }
    
    setImpersonating(false)
    setImpersonateDialog(false)
  }

  function openImpersonateDialog(user: UserWithStats) {
    setSelectedUser(user)
    setImpersonateDialog(true)
  }

  // Role Badge component
  function RoleBadge({ role }: { role: UserRole }) {
    const config = ROLE_CONFIG[role] || ROLE_CONFIG.owner
    return (
      <Badge className={cn("text-xs font-medium", config.bgColor, config.color)}>
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground">Gérer les utilisateurs et leurs accès</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700">
          <UserPlus className="h-4 w-4 mr-2" />
          Inviter
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Users className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <UserCog className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.admin}</p>
              <p className="text-sm text-muted-foreground">Admins</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.owner}</p>
              <p className="text-sm text-muted-foreground">Propriétaires</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.tenant}</p>
              <p className="text-sm text-muted-foreground">Locataires</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table Card */}
      <Card>
        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative w-80">
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
                    onClick={() => handleSort('role')}
                  >
                    Rôle
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium text-gray-600 text-sm">
                  Missions
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
                  Dernière activité
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-teal-600" />
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center font-medium text-sm",
                          ROLE_CONFIG[user.role]?.bgColor || 'bg-gray-100',
                          ROLE_CONFIG[user.role]?.color || 'text-gray-700'
                        )}>
                          {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.full_name || 'Sans nom'}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <RoleBadge role={user.role} />
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/users/${user.id}`)}>
                            <UserCog className="h-4 w-4 mr-2" />
                            Voir le profil
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" />
                            Envoyer un email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.role !== 'admin' && (
                            <DropdownMenuItem 
                              onClick={() => openImpersonateDialog(user)}
                              className="text-amber-600"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Se connecter en tant que
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {filteredUsers.length > 0 ? (
              <>
                {startIndex + 1}-{Math.min(startIndex + rowsPerPage, filteredUsers.length)} sur {filteredUsers.length}
              </>
            ) : '0 utilisateur'}
          </p>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Lignes</span>
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
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600 mx-2">
                {currentPage} / {totalPages || 1}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Impersonation Dialog */}
      <Dialog open={impersonateDialog} onOpenChange={setImpersonateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-500" />
              Se connecter en tant que
            </DialogTitle>
            <DialogDescription>
              Vous allez voir l'application comme si vous étiez cet utilisateur. 
              Toutes vos actions seront enregistrées.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center font-medium text-lg",
                  ROLE_CONFIG[selectedUser.role]?.bgColor,
                  ROLE_CONFIG[selectedUser.role]?.color
                )}>
                  {selectedUser.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-medium">{selectedUser.full_name || 'Sans nom'}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <RoleBadge role={selectedUser.role} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setImpersonateDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleImpersonate}
              disabled={impersonating}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {impersonating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Confirmer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
