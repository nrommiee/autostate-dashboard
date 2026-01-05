'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
  ChevronDown,
  FileText,
  Gauge,
  AlertCircle,
  BarChart3,
  Activity,
  DollarSign,
  HelpCircle,
  Search,
  MoreVertical,
  User,
  CreditCard,
  Bell
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
  badge?: number
  children?: { title: string; href: string; icon: React.ReactNode }[]
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    title: 'Missions',
    href: '/dashboard/missions',
    icon: <FolderOpen className="h-4 w-4" />,
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
    title: 'Compteurs',
    href: '/dashboard/meters',
    icon: <Gauge className="h-4 w-4" />,
    children: [
      { title: 'Non reconnus', href: '/dashboard/unrecognized', icon: <AlertCircle className="h-4 w-4" /> },
      { title: 'Modèles', href: '/dashboard/meters', icon: <Gauge className="h-4 w-4" /> },
    ]
  },
  {
    title: 'Analytics',
    href: '/dashboard/analytics',
    icon: <BarChart3 className="h-4 w-4" />,
    children: [
      { title: 'Usage', href: '/dashboard/analytics/usage', icon: <Activity className="h-4 w-4" /> },
      { title: 'Coûts', href: '/dashboard/analytics/cost', icon: <DollarSign className="h-4 w-4" /> },
    ]
  },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [unrecognizedCount, setUnrecognizedCount] = useState(0)
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  // Auto-expand sections based on current path
  useEffect(() => {
    if (pathname?.startsWith('/dashboard/analytics')) {
      setExpandedItems(prev => prev.includes('/dashboard/analytics') ? prev : [...prev, '/dashboard/analytics'])
    }
    if (pathname?.startsWith('/dashboard/meters') || pathname?.startsWith('/dashboard/unrecognized')) {
      setExpandedItems(prev => prev.includes('/dashboard/meters') ? prev : [...prev, '/dashboard/meters'])
    }
  }, [pathname])

  const toggleExpand = (href: string) => {
    setExpandedItems(prev => 
      prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
    )
  }

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
            <div key={item.href}>
              {item.children ? (
                // Item with children (expandable)
                <>
                  <button
                    onClick={() => toggleExpand(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      pathname?.startsWith(item.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                    )}
                  >
                    {item.icon}
                    <span className="flex-1 text-left">{item.title}</span>
                    {expandedItems.includes(item.href) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {expandedItems.includes(item.href) && (
                    <div className="ml-4 mt-1 space-y-1 border-l pl-3">
                      {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                              "hover:bg-accent hover:text-accent-foreground",
                              pathname === child.href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                            )}
                          >
                            {child.icon}
                            <span className="flex-1">{child.title}</span>
                            {/* Badge for unrecognized meters */}
                            {child.href === '/dashboard/unrecognized' && unrecognizedCount > 0 && (
                              <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                {unrecognizedCount}
                              </span>
                            )}
                          </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // Regular item
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.icon}
                  <span className="flex-1">{item.title}</span>
                </Link>
              )}
            </div>
          ))}
        </nav>

        <Separator />

        {/* Settings, Help, Search */}
        <div className="p-4 space-y-1">
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              pathname === '/dashboard/settings' ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
          <Link
            href="/dashboard/help"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              pathname === '/dashboard/help' ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
          >
            <HelpCircle className="h-4 w-4" />
            <span>Get Help</span>
          </Link>
          <Link
            href="/dashboard/search"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              pathname === '/dashboard/search' ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
          >
            <Search className="h-4 w-4" />
            <span>Search</span>
          </Link>
        </div>

        <Separator />

        {/* User section with dropdown */}
        <div className="p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.avatar_url || ''} />
                  <AvatarFallback className="bg-teal-100 text-teal-700">
                    {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'A'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">
                    {user?.full_name || 'Admin'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 rounded-lg"
              side="right"
              align="end"
              sideOffset={8}
            >
              {/* Header avec avatar */}
              <div className="flex items-center gap-3 p-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-teal-400 to-cyan-500 text-white">
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
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/account" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/billing" className="cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/notifications" className="cursor-pointer">
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-muted/30">
        {children}
      </main>
    </div>
  )
}
