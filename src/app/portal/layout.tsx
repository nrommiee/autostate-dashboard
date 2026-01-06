// src/app/portal/layout.tsx
// Portal layout for owners and tenants

'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getCurrentUser, AuthUser, ROLE_CONFIG } from '@/lib/auth'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Home,
  Building2,
  MessageSquare,
  FileText,
  Bell,
  Settings,
  LogOut,
  User,
  MoreVertical,
  ChevronRight,
  HelpCircle
} from 'lucide-react'

interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
  badge?: number
  ownerOnly?: boolean
  tenantOnly?: boolean
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [notificationCount, setNotificationCount] = useState(0)

  // Navigation items based on role
  const getNavItems = (role: string): NavItem[] => {
    const baseItems: NavItem[] = [
      {
        title: 'Accueil',
        href: '/portal',
        icon: <Home className="h-4 w-4" />,
      },
      {
        title: role === 'tenant' ? 'Mon bien' : 'Mes biens',
        href: '/portal/properties',
        icon: <Building2 className="h-4 w-4" />,
      },
      {
        title: 'Remarques',
        href: '/portal/remarks',
        icon: <MessageSquare className="h-4 w-4" />,
        badge: 3, // TODO: Dynamic count
      },
      {
        title: 'Avenants',
        href: '/portal/amendments',
        icon: <FileText className="h-4 w-4" />,
        badge: 1, // TODO: Dynamic count
      },
      {
        title: 'Notifications',
        href: '/portal/notifications',
        icon: <Bell className="h-4 w-4" />,
        badge: notificationCount,
      },
    ]
    
    return baseItems
  }

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser()
      
      if (!currentUser) {
        router.push('/')
        return
      }

      // Redirect admin to dashboard
      if (currentUser.role === 'admin') {
        router.push('/dashboard')
        return
      }

      setUser(currentUser)
      
      // TODO: Get notification count
      // const { count } = await supabase...
      
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

  if (!user) return null

  const navItems = getNavItems(user.role)
  const roleConfig = ROLE_CONFIG[user.role]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Impersonation Banner */}
      <ImpersonationBanner />
      
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card flex flex-col">
          {/* Logo */}
          <div className="p-6">
            <Link href="/portal" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
                <span className="text-xl">📐</span>
              </div>
              <div>
                <h1 className="font-bold text-lg">AutoState</h1>
                <Badge className={cn("text-xs", roleConfig.bgColor, roleConfig.color)}>
                  {roleConfig.label}
                </Badge>
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
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  pathname === item.href 
                    ? "bg-teal-50 text-teal-700 border border-teal-200" 
                    : "text-muted-foreground"
                )}
              >
                {item.icon}
                <span className="flex-1">{item.title}</span>
                {item.badge && item.badge > 0 && (
                  <span className="bg-teal-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
                {pathname === item.href && (
                  <ChevronRight className="h-4 w-4 text-teal-600" />
                )}
              </Link>
            ))}
          </nav>

          <Separator />

          {/* Help & Settings */}
          <div className="p-4 space-y-1">
            <Link
              href="/portal/settings"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                pathname === '/portal/settings' ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              <span>Paramètres</span>
            </Link>
            <Link
              href="/portal/help"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              )}
            >
              <HelpCircle className="h-4 w-4" />
              <span>Aide</span>
            </Link>
          </div>

          <Separator />

          {/* User section */}
          <div className="p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback className={cn(roleConfig.bgColor, roleConfig.color)}>
                      {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">
                      {user.full_name || 'Utilisateur'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
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
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback className={cn(roleConfig.bgColor, roleConfig.color)}>
                      {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.full_name || 'Utilisateur'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/portal/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Mon profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portal/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
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
    </div>
  )
}
