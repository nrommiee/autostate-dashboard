'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Profile, Mission, MissionData, computeMissionStats } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  FolderOpen, 
  Calendar, 
  Building,
  Mail,
  User,
  Search,
  Home,
  DoorOpen,
  Camera,
  Timer,
  ChevronRight
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [filteredMissions, setFilteredMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    const fetchData = async () => {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileData) {
        setProfile(profileData)
      }

      // Fetch missions via workspace membership
      const { data: workspaceMembers } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
      
      if (workspaceMembers && workspaceMembers.length > 0) {
        const workspaceIds = workspaceMembers.map(wm => wm.workspace_id)
        
        const { data: missionsData } = await supabase
          .from('missions')
          .select('*')
          .in('workspace_id', workspaceIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })

        if (missionsData) {
          setMissions(missionsData)
          setFilteredMissions(missionsData)
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [userId])

  // Filter missions
  useEffect(() => {
    let filtered = [...missions]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(m => {
        const data = m.data as MissionData
        const address = data.address?.fullAddress?.toLowerCase() || ''
        const city = data.addressDetails?.city?.toLowerCase() || ''
        const postalCode = data.addressDetails?.postalCode || ''
        const street = data.addressDetails?.street?.toLowerCase() || ''
        const reportNumber = m.report_number?.toLowerCase() || ''
        
        // Search in parties (client names)
        const partyMatch = data.parties?.some(p => 
          p.companyName?.toLowerCase().includes(query) ||
          p.firstName?.toLowerCase().includes(query) ||
          p.lastName?.toLowerCase().includes(query) ||
          p.representativeFirstName?.toLowerCase().includes(query) ||
          p.representativeLastName?.toLowerCase().includes(query)
        )
        
        return address.includes(query) || 
               city.includes(query) || 
               postalCode.includes(query) ||
               street.includes(query) ||
               reportNumber.includes(query) ||
               partyMatch
      })
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => {
        const data = m.data as MissionData
        return data.status === statusFilter
      })
    }
    
    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(m => {
        const data = m.data as MissionData
        return data.missionType === typeFilter
      })
    }
    
    setFilteredMissions(filtered)
  }, [searchQuery, statusFilter, typeFilter, missions])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Terminé</Badge>
      case 'inProgress':
        return <Badge className="bg-blue-100 text-blue-700">En cours</Badge>
      case 'draft':
        return <Badge variant="secondary">Brouillon</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'entry':
        return <Badge variant="outline" className="border-green-300 text-green-700">Entrée</Badge>
      case 'exit':
        return <Badge variant="outline" className="border-red-300 text-red-700">Sortie</Badge>
      case 'intermediate':
        return <Badge variant="outline" className="border-orange-300 text-orange-700">Intermédiaire</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const getPropertyTypeBadge = (type: string) => {
    switch (type) {
      case 'apartment':
        return <Badge variant="secondary"><Building className="h-3 w-3 mr-1" />Appart.</Badge>
      case 'house':
        return <Badge variant="secondary"><Home className="h-3 w-3 mr-1" />Maison</Badge>
      case 'studio':
        return <Badge variant="secondary">Studio</Badge>
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}min`
    }
    return `${minutes}min`
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Utilisateur non trouvé</h2>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Back button */}
      <Button 
        variant="ghost" 
        className="mb-6"
        onClick={() => router.push('/dashboard/users')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour aux utilisateurs
      </Button>

      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback className="bg-teal-100 text-teal-700 text-2xl">
                {profile.full_name?.charAt(0) || profile.email?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">
                  {profile.full_name || 'Sans nom'}
                </h1>
                {profile.is_super_admin && (
                  <Badge>Super Admin</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </div>
                {profile.company_name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building className="h-4 w-4" />
                    {profile.company_name}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Inscrit le {format(new Date(profile.created_at), 'dd MMMM yyyy', { locale: fr })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Abonnement:</span>
                  {profile.subscription_status === 'active' ? (
                    <Badge className="bg-green-100 text-green-700">Actif</Badge>
                  ) : (
                    <Badge variant="secondary">Gratuit</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-teal-600">{missions.length}</p>
                <p className="text-sm text-muted-foreground">Missions</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-blue-600">
                  {missions.reduce((acc, m) => acc + ((m.data as MissionData).rooms?.length || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Pièces</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par adresse, ville, code postal, client..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select 
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              <option value="inProgress">En cours</option>
              <option value="completed">Terminé</option>
              <option value="draft">Brouillon</option>
            </select>
            <select 
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Tous les types</option>
              <option value="entry">Entrée</option>
              <option value="exit">Sortie</option>
              <option value="intermediate">Intermédiaire</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Missions List */}
      <Card>
        <CardHeader>
          <CardTitle>Missions ({filteredMissions.length})</CardTitle>
          <CardDescription>
            Tous les états des lieux de cet utilisateur
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune mission trouvée</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMissions.map((mission) => {
                const data = mission.data as MissionData
                const stats = computeMissionStats(data)
                const clientName = data.parties?.find(p => p.role === 'Locataire')?.companyName || 
                                   data.parties?.find(p => p.role === 'Locataire')?.lastName ||
                                   data.parties?.[1]?.companyName ||
                                   'Non défini'
                
                return (
                  <Link
                    key={mission.id}
                    href={`/dashboard/missions/${mission.id}`}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center">
                      <FolderOpen className="h-6 w-6 text-teal-700" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">
                          {data.address?.fullAddress || 'Sans adresse'}
                        </p>
                        {getTypeBadge(data.missionType)}
                        {getPropertyTypeBadge(data.propertyType)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {clientName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {data.dateTime ? format(new Date(data.dateTime), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Non planifié'}
                        </span>
                        <span className="flex items-center gap-1">
                          <DoorOpen className="h-3 w-3" />
                          {stats.totalRooms} pièces
                        </span>
                        <span className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          {stats.totalPhotos} photos
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {formatTimeSpent(data.operatorData?.totalTimeSpent || 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>Réf: {mission.report_number}</span>
                        <span>•</span>
                        <span>Créé {formatDistanceToNow(new Date(mission.created_at), { addSuffix: true, locale: fr })}</span>
                        <span>•</span>
                        <span>Modifié {formatDistanceToNow(new Date(mission.updated_at), { addSuffix: true, locale: fr })}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      {getStatusBadge(data.status)}
                      <div className="mt-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-teal-500 rounded-full"
                            style={{ width: `${stats.completionPercentage}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{stats.completionPercentage}% complet</p>
                      </div>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
