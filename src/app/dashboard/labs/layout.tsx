'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ScanLine, Eye, Hammer, GitBranch, FlaskConical } from 'lucide-react'

const labsNavItems = [
  {
    title: 'Vision Compteurs',
    href: '/dashboard/labs/meters',
    icon: ScanLine,
    description: 'Test et optimisation de la reconnaissance de compteurs'
  },
  {
    title: 'Vision Objets',
    href: '/dashboard/labs/objects',
    icon: Eye,
    description: 'Détection et identification des objets dans les pièces'
  },
  {
    title: 'Valorisation Dégâts',
    href: '/dashboard/labs/damages',
    icon: Hammer,
    description: 'Estimation automatique des coûts de réparation'
  },
  {
    title: 'Versions',
    href: '/dashboard/labs/versions',
    icon: GitBranch,
    description: 'Gestion des versions du moteur de reconnaissance'
  },
]

export default function LabsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Labs</h1>
              <p className="text-sm text-gray-500">Centre de R&D et d'expérimentation IA</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <nav className="flex gap-1 -mb-px">
            {labsNavItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    isActive
                      ? "border-purple-600 text-purple-600 bg-white rounded-t-lg"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}
