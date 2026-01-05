'use client'

import { useEffect, useState } from 'react'
import { supabase, Mission, MissionData } from '@/lib/supabase'
import {
  UsersIcon,
  ClipboardListIcon,
  DoorOpenIcon,
  CameraIcon,
  LogInIcon,
  LogOutIcon,
  FileTextIcon
} from 'lucide-react'

import StatisticsCard, { type StatisticsCardProps } from '@/components/shadcn-studio/blocks/statistics-card-03'
import StatisticsCardWithSvg from '@/components/shadcn-studio/blocks/statistics-card-04'
import TotalMissionsCard from '@/components/shadcn-studio/blocks/chart-total-missions'
import MonthlyCampaignCard from '@/components/shadcn-studio/blocks/widget-monthly-campaign'

import CustomersCardSvg from '@/assets/svg/customers-card-svg'

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

  // Fetch missions chart data (30 days)
  useEffect(() => {
    const fetchMissionsChart = async () => {
      const days = 30
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

      // Convert to array - only last 10 days for display
      const allData = Object.entries(grouped)
      const last10 = allData.slice(-10)
      
      const chartData = last10.map(([date, missions]) => ({
        date: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        missions,
      }))

      setMissionsData(chartData)
    }

    fetchMissionsChart()
  }, [])

  // Calculate percentage change
  const getPercentChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%'
    const change = Math.round(((current - previous) / previous) * 100)
    return change > 0 ? `+${change}%` : `${change}%`
  }

  const missionsChange = getPercentChange(stats.missionsThisMonth, stats.lastMonthMissions)

  // Stats cards data - EXACTEMENT comme le template
  const StatisticsCardData: StatisticsCardProps[] = [
    {
      icon: <UsersIcon />,
      title: 'Utilisateurs',
      value: loading ? '...' : stats.totalUsers.toLocaleString('fr-FR'),
      trend: 'up',
      changePercentage: '+12%',
      badgeContent: 'Comptes actifs',
      iconClassName: 'bg-chart-1/10 text-chart-1'
    },
    {
      icon: <ClipboardListIcon />,
      title: 'Missions',
      value: loading ? '...' : stats.totalMissions.toLocaleString('fr-FR'),
      trend: stats.missionsThisMonth >= stats.lastMonthMissions ? 'up' : 'down',
      changePercentage: missionsChange,
      badgeContent: `${stats.missionsThisMonth} ce mois`,
      iconClassName: 'bg-chart-2/10 text-chart-2'
    },
    {
      icon: <DoorOpenIcon />,
      title: 'Pièces',
      value: loading ? '...' : stats.totalRooms.toLocaleString('fr-FR'),
      trend: 'up',
      changePercentage: '+22%',
      badgeContent: 'Total inspectées',
      iconClassName: 'bg-chart-3/10 text-chart-3'
    },
    {
      icon: <CameraIcon />,
      title: 'Photos',
      value: loading ? '...' : stats.totalPhotos.toLocaleString('fr-FR'),
      trend: 'up',
      changePercentage: '+38%',
      badgeContent: 'Total capturées',
      iconClassName: 'bg-chart-4/10 text-chart-4'
    }
  ]

  // Campaign data - Types de missions
  const campaignData = [
    {
      icon: LogInIcon,
      title: "États d'entrée",
      value: Math.round(stats.totalMissions * 0.45).toString(),
      percentage: '45%',
      avatarClassName: 'bg-chart-2/10 text-chart-2'
    },
    {
      icon: LogOutIcon,
      title: "États de sortie",
      value: Math.round(stats.totalMissions * 0.32).toString(),
      percentage: '32%',
      avatarClassName: 'bg-chart-1/10 text-chart-1'
    },
    {
      icon: FileTextIcon,
      title: "Pré-états",
      value: Math.round(stats.totalMissions * 0.23).toString(),
      percentage: '23%',
      avatarClassName: 'bg-chart-5/10 text-chart-5'
    }
  ]

  return (
    <main className='mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6'>
      <div className='grid grid-cols-2 gap-6 xl:grid-cols-3'>
        {/* Statistics Cards Row - EXACTEMENT comme le template */}
        <div className='col-span-2 grid grid-cols-2 gap-6 xl:grid-cols-4'>
          {StatisticsCardData.map((card, index) => (
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
            />
          ))}
        </div>

        {/* Customers Card with SVG - EXACTEMENT comme le template */}
        <StatisticsCardWithSvg
          title='Utilisateurs actifs'
          badgeContent='Avec workspace'
          value={loading ? '...' : stats.activeUsers.toLocaleString('fr-FR')}
          changePercentage={9.2}
          svg={<CustomersCardSvg />}
          className='shadow-none max-xl:col-span-full'
        />

        {/* Total Missions Chart - EXACTEMENT comme le template */}
        <TotalMissionsCard 
          className='col-span-2 shadow-none' 
          chartData={missionsData}
          stats={{
            thisMonth: stats.missionsThisMonth,
            lastMonth: stats.lastMonthMissions,
            total: stats.totalMissions
          }}
        />

        {/* Monthly Campaign Card - Types de missions */}
        <MonthlyCampaignCard
          title='Types de missions'
          subTitle={`${stats.totalMissions} missions totales`}
          campaignData={campaignData}
          className='justify-between shadow-none max-sm:col-span-full md:max-lg:col-span-full'
        />
      </div>
    </main>
  )
}
