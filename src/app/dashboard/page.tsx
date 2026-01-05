'use client'

import { useEffect, useState } from 'react'
import { supabase, Mission, MissionData } from '@/lib/supabase'
import { 
  UsersIcon,
  ClipboardListIcon,
  DoorOpenIcon,
  CameraIcon,
  Download,
  LogInIcon,
  LogOutIcon,
  FileTextIcon,
  HomeIcon,
  BuildingIcon,
  ImageIcon
} from 'lucide-react'

import { Button } from '@/components/ui/button'

import StatisticsCard from '@/components/shadcn-studio/blocks/statistics-card'
import StatisticsCardWithSvg from '@/components/shadcn-studio/blocks/statistics-card-with-svg'
import MissionsChartCard from '@/components/shadcn-studio/blocks/chart-missions'
import ActivityCard from '@/components/shadcn-studio/blocks/widget-activity'
import UsersCardSvg from '@/assets/svg/users-card-svg.tsx'

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
  const [missionsPeriod, setMissionsPeriod] = useState<'7' | '30' | '90'>('30')

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

  // Calculate percentage change
  const getPercentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const missionsChange = getPercentChange(stats.missionsThisMonth, stats.lastMonthMissions)

  // Activity data for the widget
  const activityData = [
    {
      icon: LogInIcon,
      title: "États d'entrée",
      value: Math.round(stats.totalMissions * 0.45).toString(),
      percentage: '45%',
      avatarClassName: 'bg-emerald-100 text-emerald-600'
    },
    {
      icon: LogOutIcon,
      title: "États de sortie",
      value: Math.round(stats.totalMissions * 0.32).toString(),
      percentage: '32%',
      avatarClassName: 'bg-orange-100 text-orange-600'
    },
    {
      icon: FileTextIcon,
      title: "Pré-états",
      value: Math.round(stats.totalMissions * 0.23).toString(),
      percentage: '23%',
      avatarClassName: 'bg-blue-100 text-blue-600'
    }
  ]

  // Property types data
  const propertyData = [
    {
      icon: HomeIcon,
      title: "Maisons",
      value: Math.round(stats.totalMissions * 0.35).toString(),
      percentage: '35%',
      avatarClassName: 'bg-violet-100 text-violet-600'
    },
    {
      icon: BuildingIcon,
      title: "Appartements",
      value: Math.round(stats.totalMissions * 0.55).toString(),
      percentage: '55%',
      avatarClassName: 'bg-cyan-100 text-cyan-600'
    },
    {
      icon: ImageIcon,
      title: "Studios",
      value: Math.round(stats.totalMissions * 0.10).toString(),
      percentage: '10%',
      avatarClassName: 'bg-pink-100 text-pink-600'
    }
  ]

  // Stats cards data
  const statsCardsData = [
    {
      icon: <UsersIcon />,
      title: 'Utilisateurs',
      value: stats.totalUsers.toLocaleString('fr-FR'),
      trend: undefined,
      changePercentage: undefined,
      badgeContent: 'Comptes actifs',
      iconClassName: 'bg-chart-1/10 text-chart-1'
    },
    {
      icon: <ClipboardListIcon />,
      title: 'Missions',
      value: stats.totalMissions.toLocaleString('fr-FR'),
      trend: missionsChange > 0 ? 'up' as const : missionsChange < 0 ? 'down' as const : undefined,
      changePercentage: missionsChange !== 0 ? `${missionsChange > 0 ? '+' : ''}${missionsChange}%` : undefined,
      badgeContent: `${stats.missionsThisMonth} ce mois`,
      iconClassName: 'bg-chart-2/10 text-chart-2'
    },
    {
      icon: <DoorOpenIcon />,
      title: 'Pièces',
      value: stats.totalRooms.toLocaleString('fr-FR'),
      trend: undefined,
      changePercentage: undefined,
      badgeContent: 'Total inspectées',
      iconClassName: 'bg-chart-3/10 text-chart-3'
    },
    {
      icon: <CameraIcon />,
      title: 'Photos',
      value: stats.totalPhotos.toLocaleString('fr-FR'),
      trend: undefined,
      changePercentage: undefined,
      badgeContent: 'Total capturées',
      iconClassName: 'bg-chart-4/10 text-chart-4'
    }
  ]

  return (
    <div className='mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6'>
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Dashboard</h1>
          <p className='text-muted-foreground text-sm'>Vue d&apos;ensemble de l&apos;activité AutoState</p>
        </div>
        <Button variant='outline'>
          <Download className='mr-2 h-4 w-4' />
          Exporter
        </Button>
      </div>

      {/* Main Grid */}
      <div className='grid grid-cols-2 gap-6 xl:grid-cols-3'>
        {/* Statistics Cards Row */}
        <div className='col-span-2 grid grid-cols-2 gap-6 xl:grid-cols-4'>
          {statsCardsData.map((card, index) => (
            <StatisticsCard
              key={index}
              icon={card.icon}
              title={card.title}
              value={card.value}
              trend={card.trend}
              changePercentage={card.changePercentage}
              badgeContent={card.badgeContent}
              className='shadow-none'
              iconClassName={card.iconClassName}
              loading={loading}
            />
          ))}
        </div>

        {/* Users Card with SVG */}
        <StatisticsCardWithSvg
          title='Utilisateurs actifs'
          badgeContent='Avec workspace'
          value={stats.activeUsers.toLocaleString('fr-FR')}
          changePercentage={12}
          svg={<UsersCardSvg />}
          className='shadow-none max-xl:col-span-full'
          loading={loading}
        />

        {/* Missions Chart */}
        <MissionsChartCard
          className='col-span-2 shadow-none'
          chartData={missionsData}
          period={missionsPeriod}
          onPeriodChange={setMissionsPeriod}
          stats={{
            thisMonth: stats.missionsThisMonth,
            lastMonth: stats.lastMonthMissions,
            total: stats.totalMissions
          }}
        />

        {/* Activity by Type */}
        <ActivityCard
          title='Types de missions'
          subTitle={`${stats.totalMissions} missions totales`}
          activityData={activityData}
          className='justify-between shadow-none max-sm:col-span-full md:max-lg:col-span-full'
        />

        {/* Property Types */}
        <ActivityCard
          title='Types de biens'
          subTitle='Répartition par catégorie'
          activityData={propertyData}
          className='justify-between shadow-none max-sm:col-span-full md:max-lg:col-span-full'
        />
      </div>
    </div>
  )
}
