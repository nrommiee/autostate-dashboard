'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { ScanLine, Eye, Hammer, GitBranch, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const labsModules = [
  {
    title: 'Vision Compteurs',
    href: '/dashboard/labs/meters',
    icon: ScanLine,
    description: 'Testez et optimisez la reconnaissance des compteurs avec différents paramètres d\'image.',
    color: 'from-blue-500 to-cyan-500',
    stats: { tests: 156, accuracy: '89%' }
  },
  {
    title: 'Vision Objets',
    href: '/dashboard/labs/objects',
    icon: Eye,
    description: 'Améliorez la détection des objets et équipements dans les photos de pièces.',
    color: 'from-green-500 to-emerald-500',
    stats: { tests: 89, accuracy: '94%' }
  },
  {
    title: 'Valorisation Dégâts',
    href: '/dashboard/labs/damages',
    icon: Hammer,
    description: 'Affinez l\'estimation automatique des coûts de réparation des dégâts.',
    color: 'from-orange-500 to-amber-500',
    stats: { tests: 45, accuracy: '76%' }
  },
  {
    title: 'Versions',
    href: '/dashboard/labs/versions',
    icon: GitBranch,
    description: 'Gérez les versions du moteur de reconnaissance et leurs configurations.',
    color: 'from-purple-500 to-indigo-500',
    stats: { versions: 1, active: 'Aurora 1.0' }
  },
]

export default function LabsPage() {
  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Bienvenue dans le Labs AutoState
        </h2>
        <p className="text-gray-600">
          Cet espace vous permet de tester, comparer et optimiser tous les modèles d'intelligence artificielle 
          utilisés par AutoState. Ajustez les paramètres en temps réel et validez les résultats avant de les 
          déployer en production.
        </p>
      </Card>

      {/* Modules grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {labsModules.map((module) => {
          const Icon = module.icon
          return (
            <Link key={module.href} href={module.href}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group h-full">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{module.title}</h3>
                      <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{module.description}</p>
                    <div className="flex gap-4 text-xs">
                      {'tests' in module.stats && (
                        <>
                          <span className="text-gray-400">
                            <strong className="text-gray-600">{module.stats.tests}</strong> tests
                          </span>
                          <span className="text-gray-400">
                            <strong className="text-green-600">{module.stats.accuracy}</strong> précision
                          </span>
                        </>
                      )}
                      {'versions' in module.stats && (
                        <>
                          <span className="text-gray-400">
                            <strong className="text-gray-600">{module.stats.versions}</strong> version(s)
                          </span>
                          <span className="text-gray-400">
                            Active: <strong className="text-purple-600">{module.stats.active}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
