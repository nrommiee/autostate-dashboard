'use client'

import { useEffect, useState } from 'react'
import { 
  CheckCircle, XCircle, AlertTriangle, RefreshCw, 
  Database, Lock, HardDrive, Brain, Globe, Clock,
  Activity, ArrowUpRight
} from 'lucide-react'

interface ServiceStatus {
  name: string
  status: 'operational' | 'degraded' | 'down'
  latency?: number
  icon: any
  description: string
}

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'API AutoState', status: 'operational', latency: 145, icon: Globe, description: 'API principale' },
    { name: 'Base de données', status: 'operational', latency: 23, icon: Database, description: 'Supabase PostgreSQL' },
    { name: 'Authentification', status: 'operational', latency: 89, icon: Lock, description: 'Supabase Auth' },
    { name: 'Stockage photos', status: 'operational', latency: 156, icon: HardDrive, description: 'Supabase Storage' },
    { name: 'Claude AI', status: 'operational', latency: 1234, icon: Brain, description: 'Anthropic API' },
  ])
  const [lastCheck, setLastCheck] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [uptimePercent] = useState(99.95)

  const checkServices = async () => {
    setLoading(true)
    // Simulation - en production, appeler /api/monitoring/stats
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLastCheck(new Date())
    setLoading(false)
  }

  useEffect(() => {
    // Auto-refresh toutes les 60 secondes
    const interval = setInterval(checkServices, 60000)
    return () => clearInterval(interval)
  }, [])

  const allOperational = services.every(s => s.status === 'operational')
  const hasIssues = services.some(s => s.status !== 'operational')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-500'
      case 'degraded': return 'bg-yellow-500'
      case 'down': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'operational': return 'Opérationnel'
      case 'degraded': return 'Dégradé'
      case 'down': return 'Hors service'
      default: return 'Inconnu'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'down': return <XCircle className="h-5 w-5 text-red-600" />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
                <span className="text-xl">📐</span>
              </div>
              <div>
                <h1 className="font-bold text-xl">AutoState</h1>
                <p className="text-sm text-gray-500">Status des services</p>
              </div>
            </div>
            <button 
              onClick={checkServices}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Status Banner */}
        <div className={`rounded-2xl p-6 ${allOperational ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${allOperational ? 'bg-green-100' : 'bg-yellow-100'}`}>
              {allOperational ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              )}
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${allOperational ? 'text-green-800' : 'text-yellow-800'}`}>
                {allOperational ? 'Tous les systèmes sont opérationnels' : 'Certains systèmes rencontrent des problèmes'}
              </h2>
              <p className={`mt-1 ${allOperational ? 'text-green-600' : 'text-yellow-600'}`}>
                Dernière vérification : {lastCheck.toLocaleTimeString('fr-FR')}
              </p>
            </div>
          </div>
        </div>

        {/* Uptime */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Disponibilité (90 jours)</h3>
            <span className="text-2xl font-bold text-green-600">{uptimePercent}%</span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 90 }).map((_, i) => (
              <div 
                key={i} 
                className={`flex-1 h-8 rounded-sm ${i > 85 ? 'bg-green-500' : i > 80 ? 'bg-green-400' : 'bg-green-500'}`}
                title={`Jour ${90 - i}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>90 jours</span>
            <span>Aujourd'hui</span>
          </div>
        </div>

        {/* Services List */}
        <div className="bg-white rounded-xl border divide-y">
          <div className="p-4">
            <h3 className="font-semibold text-lg">État des services</h3>
          </div>
          {services.map((service) => (
            <div key={service.name} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <service.icon className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-gray-500">{service.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {service.latency && (
                  <span className={`text-sm ${service.latency > 1000 ? 'text-yellow-600' : 'text-gray-500'}`}>
                    {service.latency}ms
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(service.status)}`} />
                  <span className={`text-sm font-medium ${
                    service.status === 'operational' ? 'text-green-600' : 
                    service.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {getStatusText(service.status)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Incident History */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-4">Historique des incidents</h3>
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
            <p>Aucun incident majeur ces 90 derniers jours</p>
          </div>
        </div>

        {/* Subscribe */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-2">Recevoir les alertes</h3>
          <p className="text-gray-500 text-sm mb-4">
            Soyez notifié en cas d'incident ou de maintenance planifiée.
          </p>
          <div className="flex gap-2">
            <input 
              type="email" 
              placeholder="votre@email.com"
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
              S'inscrire
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between text-sm text-gray-500">
          <p>© 2026 AutoState - Tous droits réservés</p>
          <div className="flex items-center gap-4">
            <a href="https://autostate.be" className="hover:text-gray-900 flex items-center gap-1">
              Site web <ArrowUpRight className="h-3 w-3" />
            </a>
            <a href="/dashboard" className="hover:text-gray-900 flex items-center gap-1">
              Dashboard <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
