'use client'

import { useEffect, useState } from 'react'
import { supabase, Mission, MissionData } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  FolderOpen, 
  DoorOpen, 
  Camera,
  Activity,
  CreditCard,
  DollarSign,
  Download
} from 'lucide-react'

interface Stats {
  totalUsers: number
  totalMissions: number
  totalRooms: number
  totalPhotos: number
  pendingSuggestions: number
  missionsThisMonth: number
  activeUsers: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalMissions: 0,
    totalRooms: 0,
    totalPhotos: 0,
    pendingSuggestions: 0,
    missionsThisMonth: 0,
    activeUsers: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      // Count users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // Count missions
      const { data: missions } = await supabase
        .from('missions')
        .select('*')
        .is('deleted_at', null)

      let totalRooms = 0
      let totalPhotos = 0
      
      if (missions) {
        missions.forEach((m: Mission) => {
          const data = m.data as MissionData
          totalRooms += data.rooms?.length || 0
          data.rooms?.forEach(room => {
            totalPhotos += (room.wallPhotos?.length || 0)
            totalPhotos += (room.floorPhotos?.length || 0)
            totalPhotos += (room.ceilingPhotos?.length || 0)
            totalPhotos += (room.equipmentPhotos?.length || 0)
          })
        })
      }

      // Missions this month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      const { count: missionsThisMonth } = await supabase
        .from('missions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString())
        .is('deleted_at', null)

      // Count pending suggestions
      const { count: suggestionsCount } = await supabase
        .from('property_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      // Count active workspaces
      const { count: activeWorkspaces } = await supabase
        .from('workspace_members')
        .select('user_id', { count: 'exact', head: true })

      setStats({
        totalUsers: usersCount || 0,
        totalMissions: missions?.length || 0,
        totalRooms,
        totalPhotos,
        pendingSuggestions: suggestionsCount || 0,
        missionsThisMonth: missionsThisMonth || 0,
        activeUsers: activeWorkspaces || 0,
      })
      setLoading(false)
    }

    fetchStats()
  }, [])

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* Header with title and action button */}
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Télécharger
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="analytics" disabled>Analytiques</TabsTrigger>
          <TabsTrigger value="reports" disabled>Rapports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats Cards - Style shadcn exact */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Utilisateurs
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stats.totalUsers}
                </div>
                <p className="text-xs text-muted-foreground">
                  Comptes actifs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Missions
                </CardTitle>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stats.totalMissions}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{stats.missionsThisMonth} ce mois
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pièces
                </CardTitle>
                <DoorOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stats.totalRooms}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total inspectées
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Photos
                </CardTitle>
                <Camera className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stats.totalPhotos}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total capturées
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Two column layout */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Main chart area - takes 4 columns */}
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Activité</CardTitle>
                <CardDescription>
                  Missions créées sur les 30 derniers jours
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                {/* Placeholder for chart - you can add recharts here */}
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Graphique bientôt disponible</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick actions - takes 3 columns */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
                <CardDescription>
                  Gérez votre plateforme
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <a 
                    href="/dashboard/users"
                    className="flex items-center space-x-4 rounded-md border p-4 hover:bg-accent transition-colors"
                  >
                    <Users className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        Utilisateurs
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Gérer les comptes
                      </p>
                    </div>
                  </a>

                  <a 
                    href="/dashboard/suggestions"
                    className="flex items-center space-x-4 rounded-md border p-4 hover:bg-accent transition-colors"
                  >
                    <Activity className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none flex items-center gap-2">
                        Suggestions
                        {stats.pendingSuggestions > 0 && (
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                            {stats.pendingSuggestions}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Valider les nouvelles propriétés
                      </p>
                    </div>
                  </a>

                  <a 
                    href="/dashboard/objects"
                    className="flex items-center space-x-4 rounded-md border p-4 hover:bg-accent transition-colors"
                  >
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        Objets
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Templates et catégories
                      </p>
                    </div>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
