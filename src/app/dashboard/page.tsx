'use client'

import { useEffect, useState } from 'react'
import { supabase, Mission, MissionData } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp,
  TrendingDown,
  Download
} from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface Stats {
  totalUsers: number
  totalMissions: number
  totalRooms: number
  totalPhotos: number
  pendingSuggestions: number
  missionsThisMonth: number
  lastMonthMissions: number
  activeUsers: number
}

interface DailyMission {
  date: string
  missions: number
}

interface DailyUsers {
  date: string
  users: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalMissions: 0,
    totalRooms: 0,
    totalPhotos: 0,
    pendingSuggestions: 0,
    missionsThisMonth: 0,
    lastMonthMissions: 0,
    activeUsers: 0,
  })
  const [loading, setLoading] = useState(true)
  const [missionsData, setMissionsData] = useState<DailyMission[]>([])
  const [usersData, setUsersData] = useState<DailyUsers[]>([])
  const [missionsPeriod, setMissionsPeriod] = useState<'7' | '30' | '90'>('30')
  const [usersPeriod, setUsersPeriod] = useState<'7' | '30' | '90'>('30')

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

      // Missions last month
      const startOfLastMonth = new Date()
      startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1)
      startOfLastMonth.setDate(1)
      startOfLastMonth.setHours(0, 0, 0, 0)
      
      const endOfLastMonth = new Date(startOfMonth)
      endOfLastMonth.setDate(0)
      
      const { count: lastMonthMissions } = await supabase
        .from('missions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfLastMonth.toISOString())
        .lte('created_at', endOfLastMonth.toISOString())
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
        lastMonthMissions: lastMonthMissions || 0,
        activeUsers: activeWorkspaces || 0,
      })
      setLoading(false)
    }

    fetchStats()
  }, [])

  // Fetch missions chart data
  useEffect(() => {
    const fetchMissionsChart = async () => {
      const days = parseInt(missionsPeriod)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      
      const { data: missions } = await supabase
        .from('missions')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      // Group by date
      const grouped: Record<string, number> = {}
      
      // Initialize all dates with 0
      for (let i = 0; i < days; i++) {
        const date = new Date()
        date.setDate(date.getDate() - (days - 1 - i))
        const dateStr = date.toISOString().split('T')[0]
        grouped[dateStr] = 0
      }

      // Count missions per day
      missions?.forEach((m) => {
        const dateStr = new Date(m.created_at).toISOString().split('T')[0]
        if (grouped[dateStr] !== undefined) {
          grouped[dateStr]++
        }
      })

      // Convert to array
      const chartData = Object.entries(grouped).map(([date, missions]) => ({
        date: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        missions,
      }))

      setMissionsData(chartData)
    }

    fetchMissionsChart()
  }, [missionsPeriod])

  // Fetch users chart data
  useEffect(() => {
    const fetchUsersChart = async () => {
      const days = parseInt(usersPeriod)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      // Group by date (cumulative)
      const grouped: Record<string, number> = {}
      
      // Get total users before period
      const { count: usersBefore } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', startDate.toISOString())

      let cumulative = usersBefore || 0

      // Initialize all dates
      for (let i = 0; i < days; i++) {
        const date = new Date()
        date.setDate(date.getDate() - (days - 1 - i))
        const dateStr = date.toISOString().split('T')[0]
        grouped[dateStr] = cumulative
      }

      // Add new users cumulatively
      profiles?.forEach((p) => {
        const dateStr = new Date(p.created_at).toISOString().split('T')[0]
        // Increment this date and all future dates
        Object.keys(grouped).forEach(key => {
          if (key >= dateStr) {
            grouped[key]++
          }
        })
      })

      // Convert to array
      const chartData = Object.entries(grouped).map(([date, users]) => ({
        date: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        users,
      }))

      setUsersData(chartData)
    }

    fetchUsersChart()
  }, [usersPeriod])

  // Calculate percentage change
  const getPercentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const missionsChange = getPercentChange(stats.missionsThisMonth, stats.lastMonthMissions)

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 bg-gray-50/50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500">Vue d'ensemble de l'activité AutoState</p>
        </div>
        <Button variant="outline" className="bg-white">
          <Download className="mr-2 h-4 w-4" />
          Exporter
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Utilisateurs */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Utilisateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-gray-900">
              {loading ? '...' : stats.totalUsers.toLocaleString('fr-FR')}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Comptes actifs
            </p>
          </CardContent>
        </Card>

        {/* Missions */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Missions
            </CardTitle>
            {missionsChange !== 0 && (
              <div className={`flex items-center text-xs font-medium ${
                missionsChange > 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {missionsChange > 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {missionsChange > 0 ? '+' : ''}{missionsChange}%
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-gray-900">
              {loading ? '...' : stats.totalMissions.toLocaleString('fr-FR')}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {stats.missionsThisMonth} ce mois
            </p>
          </CardContent>
        </Card>

        {/* Pièces */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pièces
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-gray-900">
              {loading ? '...' : stats.totalRooms.toLocaleString('fr-FR')}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Total inspectées
            </p>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-gray-900">
              {loading ? '...' : stats.totalPhotos.toLocaleString('fr-FR')}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Total capturées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Missions Chart */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">
                Missions réalisées
              </CardTitle>
              <CardDescription>
                Nombre de missions par jour
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                variant={missionsPeriod === '7' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMissionsPeriod('7')}
                className="text-xs h-8"
              >
                7 jours
              </Button>
              <Button
                variant={missionsPeriod === '30' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMissionsPeriod('30')}
                className="text-xs h-8"
              >
                30 jours
              </Button>
              <Button
                variant={missionsPeriod === '90' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMissionsPeriod('90')}
                className="text-xs h-8"
              >
                90 jours
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={missionsData}>
                  <defs>
                    <linearGradient id="missionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#9ca3af' }}
                  />
                  <YAxis 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#9ca3af' }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="missions"
                    stroke="#0d9488"
                    strokeWidth={2}
                    fill="url(#missionGradient)"
                    name="Missions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Users Chart */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">
                Utilisateurs actifs
              </CardTitle>
              <CardDescription>
                Évolution du nombre d'utilisateurs
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                variant={usersPeriod === '7' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setUsersPeriod('7')}
                className="text-xs h-8"
              >
                7 jours
              </Button>
              <Button
                variant={usersPeriod === '30' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setUsersPeriod('30')}
                className="text-xs h-8"
              >
                30 jours
              </Button>
              <Button
                variant={usersPeriod === '90' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setUsersPeriod('90')}
                className="text-xs h-8"
              >
                90 jours
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usersData}>
                  <defs>
                    <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#9ca3af' }}
                  />
                  <YAxis 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#9ca3af' }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#usersGradient)"
                    name="Utilisateurs"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
