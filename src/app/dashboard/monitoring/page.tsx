'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { 
  Activity, AlertTriangle, CheckCircle, XCircle, Clock, Database, 
  Shield, ShieldAlert, ShieldCheck, Zap, RefreshCw, Search,
  LayoutDashboard, ScrollText, Gauge, Lock, ChevronRight,
  Info, AlertCircle, Bug, Lightbulb, ExternalLink, Copy,
  Check, Loader2, Download, Trash2, Eye, Filter, Upload,
  FileCode, GitBranch, Plus, Server, Wifi, WifiOff, TrendingUp,
  TrendingDown, Minus, Users, Camera, Brain
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Types
interface LogEntry {
  id: string
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  source: string
  message: string
  user_id?: string
  user_email?: string
  request_id?: string
  method?: string
  path?: string
  duration_ms?: number
  status_code?: number
  data?: any
  error_name?: string
  error_message?: string
  error_stack?: string
  suggested_fix?: string
  resolved_at?: string
  resolved_by?: string
  resolution_notes?: string
}

interface MonitoringStats {
  period: string
  total_events: number
  by_level: { ERROR: number; WARN: number; INFO: number; DEBUG: number }
  by_source: Record<string, number>
  api_stats: { total_requests: number; avg_duration_ms: number; error_rate: number }
}

interface SecurityInfo {
  security_score: number
  tables: { without_rls: string[]; with_rls: string[]; total: number }
  alerts: { level: string; message: string }[]
  fix_sql: string
  recommendations: string[]
}

const LEVEL_CONFIG = {
  ERROR: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
  WARN: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  INFO: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  DEBUG: { icon: Bug, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' }
}

const TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'performance', label: 'Performance', icon: Gauge },
  { id: 'security', label: 'Sécurité', icon: Shield },
  { id: 'analyzer', label: 'Code Analyzer', icon: FileCode, badge: 'Bientôt' }
] as const

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState('24h')
  
  // Stats
  const [stats, setStats] = useState<MonitoringStats | null>(null)
  const [unresolvedErrors, setUnresolvedErrors] = useState<LogEntry[]>([])
  const [slowQueries, setSlowQueries] = useState<LogEntry[]>([])
  const [businessStats, setBusinessStats] = useState({ missions_today: 0, active_users: 0, meters_scanned: 0 })
  const [supabaseHealth, setSupabaseHealth] = useState({ database: 'healthy', storage: 'healthy', auth: 'healthy' })
  
  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(0)
  const [logsFilter, setLogsFilter] = useState({ level: 'all', source: 'all', search: '' })
  
  // Security
  const [security, setSecurity] = useState<SecurityInfo | null>(null)
  
  // UI State
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [showLogDetail, setShowLogDetail] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [resolveNotes, setResolveNotes] = useState('')
  const [resolving, setResolving] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  
  // Load data
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/monitoring/stats?period=${period}`)
      const data = await res.json()
      if (data.stats) setStats(data.stats)
      if (data.unresolved_errors) setUnresolvedErrors(data.unresolved_errors.recent || [])
      if (data.slow_queries) setSlowQueries(data.slow_queries)
      if (data.business) setBusinessStats(data.business)
      if (data.supabase_health) setSupabaseHealth(data.supabase_health)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }, [period])
  
  const loadLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50', offset: String(logsPage * 50) })
      if (logsFilter.level !== 'all') params.set('level', logsFilter.level)
      if (logsFilter.source !== 'all') params.set('source', logsFilter.source)
      if (logsFilter.search) params.set('search', logsFilter.search)
      
      const res = await fetch(`/api/logs?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setLogsTotal(data.total || 0)
    } catch (error) {
      console.error('Error loading logs:', error)
    }
  }, [logsPage, logsFilter])
  
  const loadSecurity = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/security')
      const data = await res.json()
      setSecurity(data)
    } catch (error) {
      console.error('Error loading security:', error)
    }
  }, [])
  
  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadStats(), loadLogs(), loadSecurity()])
    setLoading(false)
  }, [loadStats, loadLogs, loadSecurity])
  
  useEffect(() => { loadAll() }, [])
  useEffect(() => { loadStats() }, [period])
  useEffect(() => { loadLogs() }, [logsPage, logsFilter])
  
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }
  
  const handleResolveError = async () => {
    if (!selectedLog) return
    setResolving(true)
    try {
      await fetch('/api/logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: selectedLog.id, resolution_notes: resolveNotes })
      })
      await loadStats()
      setShowResolveModal(false)
      setSelectedLog(null)
      setResolveNotes('')
    } catch (error) {
      console.error('Error resolving:', error)
    } finally {
      setResolving(false)
    }
  }
  
  const copySqlToClipboard = () => {
    if (security?.fix_sql) {
      navigator.clipboard.writeText(security.fix_sql)
      setCopiedSql(true)
      setTimeout(() => setCopiedSql(false), 2000)
    }
  }
  
  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString('fr-FR', { 
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' 
    })
  }
  
  const formatDuration = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
  
  const uniqueSources = [...new Set(logs.map(l => l.source))].sort()

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitoring</h1>
          <p className="text-muted-foreground">Surveillance système en temps réel</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 heure</SelectItem>
              <SelectItem value="24h">24 heures</SelectItem>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {stats && stats.by_level.ERROR > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-red-800">{stats.by_level.ERROR} erreur(s) détectée(s)</p>
            <p className="text-sm text-red-600">{unresolvedErrors.length} non résolue(s) - Cliquez pour voir les détails</p>
          </div>
          <Button variant="outline" className="border-red-300 text-red-700" onClick={() => setActiveTab('logs')}>
            Voir les erreurs
          </Button>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-green-800">Tous les systèmes sont opérationnels</p>
            <p className="text-sm text-green-600">Aucune erreur critique détectée</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-teal-600 text-teal-600' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge && (
              <Badge variant="outline" className="ml-1 text-xs bg-purple-50 text-purple-600 border-purple-200">
                {tab.badge}
              </Badge>
            )}
            {tab.id === 'logs' && stats && stats.by_level.ERROR > 0 && (
              <Badge className="ml-1 bg-red-100 text-red-700">{stats.by_level.ERROR}</Badge>
            )}
            {tab.id === 'security' && security && security.tables.without_rls.length > 0 && (
              <Badge className="ml-1 bg-orange-100 text-orange-700">{security.tables.without_rls.length}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Événements</p>
                  <p className="text-2xl font-bold">{stats?.total_events || 0}</p>
                </div>
                <Activity className="h-8 w-8 text-teal-600 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Période: {period}</p>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Erreurs</p>
                  <p className="text-2xl font-bold text-red-600">{stats?.by_level.ERROR || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Taux: {stats?.api_stats.error_rate || 0}%
              </p>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Latence moy.</p>
                  <p className="text-2xl font-bold">{stats?.api_stats.avg_duration_ms || 0}ms</p>
                </div>
                <Zap className="h-8 w-8 text-yellow-600 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats?.api_stats.total_requests || 0} requêtes
              </p>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Sécurité</p>
                  <p className="text-2xl font-bold">{security?.security_score || 0}%</p>
                </div>
                <Shield className={`h-8 w-8 opacity-50 ${(security?.security_score || 0) >= 80 ? 'text-green-600' : 'text-orange-600'}`} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {security?.tables.without_rls.length || 0} tables sans RLS
              </p>
            </Card>
          </div>

          {/* Services Health */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Server className="h-5 w-5" />
              État des services
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Base de données', status: supabaseHealth.database, icon: Database },
                { name: 'Authentification', status: supabaseHealth.auth, icon: Lock },
                { name: 'Stockage', status: supabaseHealth.storage, icon: Camera },
                { name: 'Claude AI', status: 'healthy', icon: Brain }
              ].map(service => (
                <div key={service.name} className={`p-3 rounded-lg border ${
                  service.status === 'healthy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <service.icon className={`h-4 w-4 ${service.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`} />
                    <span className="text-sm font-medium">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {service.status === 'healthy' ? (
                      <>
                        <Wifi className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-green-700">Opérationnel</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3 text-red-600" />
                        <span className="text-xs text-red-700">Erreur</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Business Stats */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activité business (aujourd'hui)
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-teal-50 rounded-lg">
                <p className="text-3xl font-bold text-teal-700">{businessStats.missions_today}</p>
                <p className="text-sm text-teal-600">Missions créées</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-700">{businessStats.active_users}</p>
                <p className="text-sm text-blue-600">Utilisateurs actifs</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-700">{businessStats.meters_scanned}</p>
                <p className="text-sm text-purple-600">Compteurs scannés</p>
              </div>
            </div>
          </Card>

          {/* Recent Errors */}
          {unresolvedErrors.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                Erreurs non résolues ({unresolvedErrors.length})
              </h3>
              <div className="space-y-2">
                {unresolvedErrors.slice(0, 5).map(err => (
                  <div 
                    key={err.id} 
                    className="p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => { setSelectedLog(err); setShowLogDetail(true) }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-red-800 truncate">{err.message}</p>
                        <p className="text-xs text-red-600 mt-1">
                          {err.source} • {formatTimestamp(err.timestamp)}
                        </p>
                      </div>
                      {err.suggested_fix && (
                        <Badge className="bg-yellow-100 text-yellow-700 shrink-0">
                          <Lightbulb className="h-3 w-3 mr-1" />
                          Fix dispo
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB: Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher dans les logs..." 
                    className="pl-10"
                    value={logsFilter.search}
                    onChange={(e) => setLogsFilter({ ...logsFilter, search: e.target.value })}
                  />
                </div>
              </div>
              <Select 
                value={logsFilter.level} 
                onValueChange={(v) => setLogsFilter({ ...logsFilter, level: v })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="ERROR">❌ ERROR</SelectItem>
                  <SelectItem value="WARN">⚠️ WARN</SelectItem>
                  <SelectItem value="INFO">ℹ️ INFO</SelectItem>
                  <SelectItem value="DEBUG">🔍 DEBUG</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={logsFilter.source} 
                onValueChange={(v) => setLogsFilter({ ...logsFilter, source: v })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes sources</SelectItem>
                  {uniqueSources.map(src => (
                    <SelectItem key={src} value={src}>{src}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </Card>

          {/* Logs List */}
          <Card className="divide-y">
            {logs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Aucun log trouvé</p>
                <p className="text-sm mt-1">Modifiez vos filtres ou attendez de nouveaux événements</p>
              </div>
            ) : (
              logs.map(log => {
                const config = LEVEL_CONFIG[log.level]
                const Icon = config.icon
                return (
                  <div 
                    key={log.id}
                    className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${log.resolved_at ? 'opacity-50' : ''}`}
                    onClick={() => { setSelectedLog(log); setShowLogDetail(true) }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded ${config.bg}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={config.badge}>{log.level}</Badge>
                          <Badge variant="outline">{log.source}</Badge>
                          {log.duration_ms && (
                            <Badge variant="outline" className={log.duration_ms > 1000 ? 'text-orange-600' : ''}>
                              {formatDuration(log.duration_ms)}
                            </Badge>
                          )}
                          {log.status_code && (
                            <Badge variant="outline" className={log.status_code >= 400 ? 'text-red-600' : 'text-green-600'}>
                              {log.status_code}
                            </Badge>
                          )}
                          {log.resolved_at && (
                            <Badge className="bg-green-100 text-green-700">Résolu</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium truncate">{log.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(log.timestamp)}
                          {log.path && <span className="ml-2">• {log.method} {log.path}</span>}
                          {log.user_email && <span className="ml-2">• {log.user_email}</span>}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                )
              })
            )}
          </Card>

          {/* Pagination */}
          {logsTotal > 50 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {logsPage * 50 + 1} - {Math.min((logsPage + 1) * 50, logsTotal)} sur {logsTotal}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={logsPage === 0}
                  onClick={() => setLogsPage(p => p - 1)}
                >
                  Précédent
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={(logsPage + 1) * 50 >= logsTotal}
                  onClick={() => setLogsPage(p => p + 1)}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Performance */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Performance Overview */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Requêtes totales</p>
              <p className="text-3xl font-bold">{stats?.api_stats.total_requests || 0}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Latence moyenne</p>
              <p className="text-3xl font-bold">{stats?.api_stats.avg_duration_ms || 0}ms</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Taux d'erreur</p>
              <p className={`text-3xl font-bold ${(stats?.api_stats.error_rate || 0) > 5 ? 'text-red-600' : 'text-green-600'}`}>
                {stats?.api_stats.error_rate || 0}%
              </p>
            </Card>
          </div>

          {/* Slow Queries */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              Requêtes lentes (&gt; 500ms)
            </h3>
            {slowQueries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-600 opacity-50" />
                <p>Aucune requête lente détectée</p>
              </div>
            ) : (
              <div className="space-y-2">
                {slowQueries.map(query => (
                  <div key={query.id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{query.method} {query.path}</p>
                        <p className="text-xs text-muted-foreground">{formatTimestamp(query.timestamp)}</p>
                      </div>
                      <Badge className="bg-orange-100 text-orange-700">
                        {formatDuration(query.duration_ms || 0)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* By Source */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Répartition par source</h3>
            <div className="space-y-3">
              {Object.entries(stats?.by_source || {}).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                <div key={source} className="flex items-center gap-3">
                  <div className="w-32 text-sm font-medium truncate">{source}</div>
                  <div className="flex-1">
                    <Progress value={(count / (stats?.total_events || 1)) * 100} className="h-2" />
                  </div>
                  <div className="w-16 text-right text-sm text-muted-foreground">{count}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB: Security */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Security Score */}
          <Card className={`p-6 ${(security?.security_score || 0) >= 80 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center gap-6">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
                (security?.security_score || 0) >= 80 ? 'bg-green-100' : 'bg-orange-100'
              }`}>
                <span className={`text-3xl font-bold ${
                  (security?.security_score || 0) >= 80 ? 'text-green-700' : 'text-orange-700'
                }`}>
                  {security?.security_score || 0}%
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold">Score de sécurité</h3>
                <p className="text-muted-foreground mt-1">
                  {security?.tables.with_rls.length || 0} tables protégées sur {security?.tables.total || 0}
                </p>
                {(security?.tables.without_rls.length || 0) > 0 && (
                  <p className="text-orange-700 mt-2 font-medium">
                    ⚠️ {security?.tables.without_rls.length} tables sans protection RLS
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Alerts */}
          {security?.alerts && security.alerts.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                Alertes de sécurité
              </h3>
              <div className="space-y-2">
                {security.alerts.map((alert, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    alert.level === 'critical' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
                  }`}>
                    <p className={alert.level === 'critical' ? 'text-red-800' : 'text-orange-800'}>
                      {alert.message}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Tables without RLS */}
          {security?.tables.without_rls && security.tables.without_rls.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Tables sans RLS ({security.tables.without_rls.length})
                </h3>
                <Button variant="outline" size="sm" onClick={copySqlToClipboard}>
                  {copiedSql ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copiedSql ? 'Copié !' : 'Copier SQL fix'}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {security.tables.without_rls.map(table => (
                  <div key={table} className="p-2 bg-red-50 border border-red-200 rounded text-sm font-mono text-red-800">
                    {table}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Ces tables sont accessibles publiquement. Cliquez sur "Copier SQL fix" et exécutez le script dans Supabase pour activer RLS.
                  </span>
                </p>
              </div>
            </Card>
          )}

          {/* Recommendations */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Recommandations
            </h3>
            <ul className="space-y-2">
              {security?.recommendations?.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-teal-600 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* TAB: Code Analyzer (Preview) */}
      {activeTab === 'analyzer' && (
        <div className="space-y-6">
          <Card className="p-8 border-2 border-dashed border-purple-200 bg-purple-50/50">
            <div className="text-center max-w-md mx-auto">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileCode className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-purple-900 mb-2">Code Analyzer</h3>
              <p className="text-purple-700 mb-6">
                Uploadez votre projet Xcode pour détecter automatiquement les nouvelles API à monitorer.
              </p>
              <div className="p-6 bg-white rounded-xl border-2 border-dashed border-purple-300 mb-4">
                <Upload className="h-10 w-10 text-purple-400 mx-auto mb-3" />
                <p className="text-sm text-purple-600">Glissez votre projet .zip ici</p>
                <p className="text-xs text-purple-400 mt-1">ou cliquez pour sélectionner</p>
              </div>
              <Button disabled className="bg-purple-600 hover:bg-purple-700 opacity-50 cursor-not-allowed">
                <Loader2 className="h-4 w-4 mr-2" />
                Bientôt disponible
              </Button>
            </div>
          </Card>

          {/* Preview of what it will do */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Aperçu de la fonctionnalité
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-purple-600 font-bold text-xs">1</span>
                </div>
                <div>
                  <p className="font-medium">Upload de votre projet</p>
                  <p className="text-muted-foreground">Exportez votre projet Xcode en ZIP et uploadez-le</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-purple-600 font-bold text-xs">2</span>
                </div>
                <div>
                  <p className="font-medium">Analyse automatique par Claude</p>
                  <p className="text-muted-foreground">Détection des Services, ViewModels, fonctions async</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-purple-600 font-bold text-xs">3</span>
                </div>
                <div>
                  <p className="font-medium">Détection des nouveautés</p>
                  <p className="text-muted-foreground">Comparaison avec la version précédente</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-purple-600 font-bold text-xs">4</span>
                </div>
                <div>
                  <p className="font-medium">Ajout au monitoring</p>
                  <p className="text-muted-foreground">Les nouvelles API sont ajoutées en un clic</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Example of what detection would look like */}
          <Card className="p-4 opacity-60">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Exemple de détection (preview)
            </h3>
            <div className="space-y-2">
              {[
                { name: 'LiDARScanService.startScan()', category: 'LIDAR', file: 'Services/LiDAR/' },
                { name: 'VoiceTranscriptionService.record()', category: 'VOICE', file: 'Services/Voice/' },
                { name: 'MeterOCRService.recognize()', category: 'OCR', file: 'Services/Meters/' }
              ].map((api, i) => (
                <div key={i} className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                  <div className="w-5 h-5 bg-green-100 rounded flex items-center justify-center">
                    <Plus className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-mono text-sm">{api.name}</p>
                    <p className="text-xs text-muted-foreground">{api.file}</p>
                  </div>
                  <Badge variant="outline">{api.category}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Log Detail Modal */}
      <Dialog open={showLogDetail} onOpenChange={setShowLogDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && (
                <>
                  {(() => {
                    const config = LEVEL_CONFIG[selectedLog.level]
                    const Icon = config.icon
                    return <Icon className={`h-5 w-5 ${config.color}`} />
                  })()}
                  Détail du log
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              {/* Main info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Niveau</p>
                  <Badge className={LEVEL_CONFIG[selectedLog.level].badge}>{selectedLog.level}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="font-medium">{selectedLog.source}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date/Heure</p>
                  <p className="font-medium">{formatTimestamp(selectedLog.timestamp)}</p>
                </div>
                {selectedLog.duration_ms && (
                  <div>
                    <p className="text-xs text-muted-foreground">Durée</p>
                    <p className="font-medium">{formatDuration(selectedLog.duration_ms)}</p>
                  </div>
                )}
              </div>

              {/* Message */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Message</p>
                <p className="p-3 bg-muted rounded-lg font-medium">{selectedLog.message}</p>
              </div>

              {/* Request info */}
              {(selectedLog.method || selectedLog.path) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Requête</p>
                  <p className="p-3 bg-muted rounded-lg font-mono text-sm">
                    {selectedLog.method} {selectedLog.path}
                    {selectedLog.status_code && (
                      <Badge className="ml-2" variant="outline">{selectedLog.status_code}</Badge>
                    )}
                  </p>
                </div>
              )}

              {/* Error details */}
              {selectedLog.error_message && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Erreur</p>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="font-medium text-red-800">{selectedLog.error_name}</p>
                    <p className="text-sm text-red-700 mt-1">{selectedLog.error_message}</p>
                  </div>
                </div>
              )}

              {/* Suggested fix */}
              {selectedLog.suggested_fix && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">💡 Suggestion de correction</p>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800">{selectedLog.suggested_fix}</p>
                  </div>
                </div>
              )}

              {/* Stack trace */}
              {selectedLog.error_stack && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Stack trace</p>
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto max-h-40">
                    {selectedLog.error_stack}
                  </pre>
                </div>
              )}

              {/* Additional data */}
              {selectedLog.data && Object.keys(selectedLog.data).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Données additionnelles</p>
                  <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.data, null, 2)}
                  </pre>
                </div>
              )}

              {/* User info */}
              {selectedLog.user_email && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Utilisateur</p>
                  <p className="font-medium">{selectedLog.user_email}</p>
                </div>
              )}

              {/* Resolution status */}
              {selectedLog.resolved_at ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-medium text-green-800 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Résolu le {formatTimestamp(selectedLog.resolved_at)}
                  </p>
                  {selectedLog.resolution_notes && (
                    <p className="text-sm text-green-700 mt-1">{selectedLog.resolution_notes}</p>
                  )}
                </div>
              ) : selectedLog.level === 'ERROR' && (
                <Button 
                  className="w-full" 
                  onClick={() => { setShowLogDetail(false); setShowResolveModal(true) }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Marquer comme résolu
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Modal */}
      <Dialog open={showResolveModal} onOpenChange={setShowResolveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme résolu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Notes de résolution (optionnel)</p>
              <Textarea 
                placeholder="Décrivez comment vous avez résolu ce problème..."
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveModal(false)}>Annuler</Button>
            <Button onClick={handleResolveError} disabled={resolving}>
              {resolving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
