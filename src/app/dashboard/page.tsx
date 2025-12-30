'use client'

import { useEffect, useState } from 'react'
import { supabase, Mission, MissionData } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FolderOpen, Boxes, Lightbulb, TrendingUp, DoorOpen, Camera } from 'lucide-react'

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

      // Count active workspaces (as proxy for active users)
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

  const statCards = [
    {
      title: 'Utilisateurs',
      value: stats.totalUsers,
      description: 'Comptes actifs',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Missions',
      value: stats.totalMissions,
      description: `${stats.missionsThisMonth} ce mois`,
      icon: FolderOpen,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Pièces',
      value: stats.totalRooms,
      description: 'Total inspectées',
      icon: DoorOpen,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Photos',
      value: stats.totalPhotos,
      description: 'Total capturées',
      icon: Camera,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100',
    },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Vue d'ensemble de l'activité AutoState
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? '...' : stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              Actions rapides
            </CardTitle>
            <CardDescription>
              Gérez votre plateforme efficacement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a 
              href="/dashboard/users"
              className="block p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="font-medium">Voir tous les utilisateurs</div>
              <div className="text-sm text-muted-foreground">
                Gérer les comptes et les abonnements
              </div>
            </a>
            <a 
              href="/dashboard/suggestions"
              className="block p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="font-medium flex items-center gap-2">
                Valider les suggestions
                {stats.pendingSuggestions > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                    {stats.pendingSuggestions}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Approuver les nouvelles propriétés d'objets
              </div>
            </a>
            <a 
              href="/dashboard/objects"
              className="block p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="font-medium">Gérer les objets</div>
              <div className="text-sm text-muted-foreground">
                Templates et catégories d'équipements
              </div>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
            <CardDescription>
              Dernières actions sur la plateforme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>Bientôt disponible</p>
              <p className="text-sm">Journal d'activité en temps réel</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
