// src/app/portal/page.tsx
// Portal home page - Overview for owners and tenants

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getCurrentUser, AuthUser, ROLE_CONFIG } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Building2, 
  MessageSquare, 
  FileText, 
  Bell, 
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Calendar
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface DashboardStats {
  propertiesCount: number
  openRemarksCount: number
  pendingAmendmentsCount: number
  unreadNotifications: number
}

interface RecentActivity {
  id: string
  type: 'remark' | 'amendment' | 'inspection'
  title: string
  status: string
  date: string
  propertyAddress?: string
}

export default function PortalHomePage() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    propertiesCount: 0,
    openRemarksCount: 0,
    pendingAmendmentsCount: 0,
    unreadNotifications: 0
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const currentUser = await getCurrentUser()
      if (!currentUser) return
      
      setUser(currentUser)
      
      // TODO: Load real data from Supabase
      // For now, using mock data
      
      // Mock stats
      setStats({
        propertiesCount: currentUser.role === 'tenant' ? 1 : 3,
        openRemarksCount: 2,
        pendingAmendmentsCount: 1,
        unreadNotifications: 4
      })
      
      // Mock recent activity
      setRecentActivity([
        {
          id: '1',
          type: 'remark',
          title: 'Fuite robinet cuisine',
          status: 'open',
          date: new Date().toISOString(),
          propertyAddress: 'Rue de la Loi 42, 1000 Bruxelles'
        },
        {
          id: '2',
          type: 'amendment',
          title: 'Modification état des lieux - Salon',
          status: 'pending',
          date: new Date(Date.now() - 86400000).toISOString(),
          propertyAddress: 'Rue de la Loi 42, 1000 Bruxelles'
        },
        {
          id: '3',
          type: 'inspection',
          title: 'État des lieux d\'entrée',
          status: 'completed',
          date: new Date(Date.now() - 86400000 * 7).toISOString(),
          propertyAddress: 'Avenue Louise 100, 1050 Ixelles'
        }
      ])
      
      setLoading(false)
    }
    
    loadData()
  }, [])

  if (loading || !user) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const roleConfig = ROLE_CONFIG[user.role]
  const greeting = getGreeting()

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {user.full_name?.split(' ')[0] || 'Utilisateur'} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de votre espace {user.role === 'tenant' ? 'locataire' : 'propriétaire'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title={user.role === 'tenant' ? 'Mon bien' : 'Mes biens'}
          value={stats.propertiesCount}
          icon={<Building2 className="h-5 w-5" />}
          color="bg-blue-500"
          href="/portal/properties"
        />
        <StatsCard
          title="Remarques en cours"
          value={stats.openRemarksCount}
          icon={<MessageSquare className="h-5 w-5" />}
          color="bg-orange-500"
          href="/portal/remarks"
          alert={stats.openRemarksCount > 0}
        />
        <StatsCard
          title="Avenants en attente"
          value={stats.pendingAmendmentsCount}
          icon={<FileText className="h-5 w-5" />}
          color="bg-purple-500"
          href="/portal/amendments"
          alert={stats.pendingAmendmentsCount > 0}
        />
        <StatsCard
          title="Notifications"
          value={stats.unreadNotifications}
          icon={<Bell className="h-5 w-5" />}
          color="bg-teal-500"
          href="/portal/notifications"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Activité récente</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/activity">
                Tout voir
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
          
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
            
            {recentActivity.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune activité récente</p>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Actions rapides</h2>
          
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/portal/remarks/new">
                <MessageSquare className="h-4 w-4 mr-2 text-orange-500" />
                Signaler un problème
              </Link>
            </Button>
            
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/portal/properties">
                <Building2 className="h-4 w-4 mr-2 text-blue-500" />
                Voir {user.role === 'tenant' ? 'mon bien' : 'mes biens'}
              </Link>
            </Button>
            
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/portal/documents">
                <FileText className="h-4 w-4 mr-2 text-purple-500" />
                Mes documents
              </Link>
            </Button>
          </div>

          {/* Upcoming */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">À venir</h3>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="h-5 w-5 text-teal-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">État des lieux de sortie</p>
                <p className="text-xs text-muted-foreground">15 février 2026 à 10:00</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// Helper components

function StatsCard({ 
  title, 
  value, 
  icon, 
  color, 
  href,
  alert 
}: { 
  title: string
  value: number
  icon: React.ReactNode
  color: string
  href: string
  alert?: boolean
}) {
  return (
    <Link href={href}>
      <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          <div className={`p-2.5 rounded-lg ${color} text-white`}>
            {icon}
          </div>
        </div>
        {alert && (
          <div className="mt-3 flex items-center gap-1 text-orange-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Action requise</span>
          </div>
        )}
      </Card>
    </Link>
  )
}

function ActivityItem({ activity }: { activity: RecentActivity }) {
  const getIcon = () => {
    switch (activity.type) {
      case 'remark':
        return <MessageSquare className="h-4 w-4 text-orange-500" />
      case 'amendment':
        return <FileText className="h-4 w-4 text-purple-500" />
      case 'inspection':
        return <Building2 className="h-4 w-4 text-blue-500" />
    }
  }

  const getStatusBadge = () => {
    switch (activity.status) {
      case 'open':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">En cours</Badge>
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">En attente</Badge>
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Terminé</Badge>
      default:
        return null
    }
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="p-2 bg-muted rounded-lg">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{activity.title}</p>
          {getStatusBadge()}
        </div>
        {activity.propertyAddress && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {activity.propertyAddress}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(activity.date), { addSuffix: true, locale: fr })}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}
