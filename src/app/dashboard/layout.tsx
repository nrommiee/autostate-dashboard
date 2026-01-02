'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'
import { 
  Users, 
  FolderOpen, 
  Settings, 
  LogOut, 
  LayoutDashboard,
  Boxes,
  Lightbulb,
  ChevronRight,
  FileText,
  Gauge,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
  badge?: number
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    title: 'Utilisateurs',
    href: '/dashboard/users',
    icon: <Users className="h-4 w-4" />,
  },
  {
    title: 'Objets',
    href: '/dashboard/objects',
    icon: <Boxes className="h-4 w-4" />,
  },
  {
    title: 'Suggestions',
    href: '/dashboard/suggestions',
    icon: <Lightbulb className="h-4 w-4" />,
  },
  {
    title: 'Formulaires Énergie',
    href: '/dashboard/energy-forms',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    title: 'Modèles compteurs',
    href: '/dashboard/meters',
    icon: <Gauge className="h-4 w-4" />,
  },
  {
    title: 'Non reconnus',
    href: '/dashboard/unrecognized',
    icon: <AlertCircle className="h-4 w-4" />,
  },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [unrecognizedCount, setUnrecognizedCount] = useState(0)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/')
        return
      }

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setUser(profile)
      }

      // Get unrecognized meters count
      const { count } = await supabase
        .from('unrecognized_meters')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      
      setUnrecognizedCount(count || 0)

      setLoading(false)
    }

    checkAuth()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        {/* Logo */}
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
              <span className="text-xl">📐</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">AutoState</h1>
              <p className="text-xs text-muted-foreground">Admin Dashboard</p>
            </div>
          </Link>
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "text-muted-foreground"
              )}
            >
              {item.icon}
              <span className="flex-1">{item.title}</span>
              {/* Badge for unrecognized meters */}
              {item.href === '/dashboard/unrecognized' && unrecognizedCount > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {unrecognizedCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <Separator />

        {/* User section */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.avatar_url || ''} />
              <AvatarFallback className="bg-teal-100 text-teal-700">
                {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.full_name || 'Admin'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-muted/30">
        {children}
      </main>
    </div>
  )
}
