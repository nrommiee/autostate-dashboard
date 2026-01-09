import { supabase } from './supabase'

// Types de logs
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface LogEntry {
  id?: string
  timestamp?: string
  level: LogLevel
  source: string
  message: string
  
  // Contexte utilisateur
  user_id?: string
  user_email?: string
  session_id?: string
  ip_address?: string
  user_agent?: string
  
  // Requête
  request_id?: string
  method?: string
  path?: string
  duration_ms?: number
  status_code?: number
  
  // Données additionnelles
  data?: Record<string, any>
  
  // Erreur
  error_name?: string
  error_message?: string
  error_stack?: string
  suggested_fix?: string
  
  // Résolution
  resolved_at?: string
  resolved_by?: string
  resolution_notes?: string
}

// Suggestions de fix automatiques basées sur les patterns d'erreurs
const ERROR_PATTERNS: { pattern: RegExp; fix: string }[] = [
  { 
    pattern: /confidence.*low|confidence.*0\.[0-4]/i, 
    fix: "Image de mauvaise qualité. Demander à l'utilisateur de reprendre la photo avec un meilleur éclairage ou plus près du compteur." 
  },
  { 
    pattern: /timeout|ETIMEDOUT|ECONNRESET/i, 
    fix: "Timeout réseau. Vérifier la connexion ou augmenter le timeout. Un retry automatique peut résoudre le problème." 
  },
  { 
    pattern: /rate.?limit/i, 
    fix: "Limite de requêtes atteinte. Implémenter un système de queue ou augmenter les quotas API." 
  },
  { 
    pattern: /RLS|row.?level.?security|permission denied/i, 
    fix: "Erreur de permissions Supabase. Vérifier les policies RLS ou utiliser le service role pour les opérations admin." 
  },
  { 
    pattern: /JWT|token.*expired|invalid.*token/i, 
    fix: "Token d'authentification invalide ou expiré. L'utilisateur doit se reconnecter." 
  },
  { 
    pattern: /duplicate.*key|unique.*constraint/i, 
    fix: "Tentative d'insertion d'un doublon. Vérifier si l'entrée existe déjà avant d'insérer." 
  },
  { 
    pattern: /foreign.*key|référence.*invalide/i, 
    fix: "Référence vers une entrée inexistante. Vérifier que l'ID référencé existe." 
  },
  { 
    pattern: /storage.*quota|bucket.*full/i, 
    fix: "Espace de stockage insuffisant. Nettoyer les anciens fichiers ou augmenter le quota." 
  },
  { 
    pattern: /Claude.*API|Anthropic/i, 
    fix: "Erreur API Claude. Vérifier le quota de tokens, le format du prompt, ou réessayer." 
  },
  { 
    pattern: /image.*size|file.*too.*large/i, 
    fix: "Fichier trop volumineux. Compresser l'image avant l'upload (max recommandé: 4MB)." 
  },
]

function getSuggestedFix(error: Error | string): string | undefined {
  const errorStr = typeof error === 'string' ? error : `${error.name} ${error.message}`
  
  for (const { pattern, fix } of ERROR_PATTERNS) {
    if (pattern.test(errorStr)) {
      return fix
    }
  }
  
  return undefined
}

// Génère un request ID unique
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`
}

// Logger principal
class Logger {
  private enabled: boolean = true
  private minLevel: LogLevel = 'INFO'
  private consoleOutput: boolean = true
  
  private levelPriority: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  }
  
  configure(options: { enabled?: boolean; minLevel?: LogLevel; consoleOutput?: boolean }) {
    if (options.enabled !== undefined) this.enabled = options.enabled
    if (options.minLevel) this.minLevel = options.minLevel
    if (options.consoleOutput !== undefined) this.consoleOutput = options.consoleOutput
  }
  
  private shouldLog(level: LogLevel): boolean {
    return this.enabled && this.levelPriority[level] >= this.levelPriority[this.minLevel]
  }
  
  private formatConsole(entry: LogEntry): string {
    const emoji = {
      DEBUG: '🔍',
      INFO: 'ℹ️',
      WARN: '⚠️',
      ERROR: '❌'
    }[entry.level]
    
    const time = new Date().toLocaleTimeString('fr-FR')
    return `${emoji} [${time}] [${entry.source}] ${entry.message}`
  }
  
  async log(entry: LogEntry): Promise<void> {
    if (!this.shouldLog(entry.level)) return
    
    // Console output pour dev
    if (this.consoleOutput) {
      const formatted = this.formatConsole(entry)
      switch (entry.level) {
        case 'DEBUG': console.debug(formatted, entry.data || ''); break
        case 'INFO': console.info(formatted, entry.data || ''); break
        case 'WARN': console.warn(formatted, entry.data || ''); break
        case 'ERROR': console.error(formatted, entry.data || ''); break
      }
    }
    
    // Enrichir avec suggestion de fix si erreur
    if (entry.level === 'ERROR' && !entry.suggested_fix) {
      const errorStr = entry.error_message || entry.message
      entry.suggested_fix = getSuggestedFix(errorStr)
    }
    
    // Sauvegarder en DB
    try {
      const { error } = await supabase.from('app_logs').insert({
        timestamp: new Date().toISOString(),
        level: entry.level,
        source: entry.source,
        message: entry.message,
        user_id: entry.user_id,
        user_email: entry.user_email,
        session_id: entry.session_id,
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        request_id: entry.request_id,
        method: entry.method,
        path: entry.path,
        duration_ms: entry.duration_ms,
        status_code: entry.status_code,
        data: entry.data,
        error_name: entry.error_name,
        error_message: entry.error_message,
        error_stack: entry.error_stack,
        suggested_fix: entry.suggested_fix
      })
      
      if (error) {
        console.error('Failed to save log:', error)
      }
    } catch (err) {
      console.error('Logger DB error:', err)
    }
  }
  
  // Raccourcis pratiques
  debug(source: string, message: string, data?: Record<string, any>) {
    return this.log({ level: 'DEBUG', source, message, data })
  }
  
  info(source: string, message: string, data?: Record<string, any>) {
    return this.log({ level: 'INFO', source, message, data })
  }
  
  warn(source: string, message: string, data?: Record<string, any>) {
    return this.log({ level: 'WARN', source, message, data })
  }
  
  error(source: string, message: string, error?: Error | any, data?: Record<string, any>) {
    return this.log({
      level: 'ERROR',
      source,
      message,
      data,
      error_name: error?.name,
      error_message: error?.message || String(error),
      error_stack: error?.stack
    })
  }
  
  // Log une requête API complète
  async apiRequest(options: {
    source: string
    method: string
    path: string
    user_id?: string
    user_email?: string
    request_id?: string
    status_code: number
    duration_ms: number
    error?: Error
    data?: Record<string, any>
  }) {
    const level: LogLevel = options.status_code >= 500 ? 'ERROR' 
      : options.status_code >= 400 ? 'WARN' 
      : 'INFO'
    
    return this.log({
      level,
      source: options.source,
      message: `${options.method} ${options.path} → ${options.status_code} (${options.duration_ms}ms)`,
      method: options.method,
      path: options.path,
      user_id: options.user_id,
      user_email: options.user_email,
      request_id: options.request_id || generateRequestId(),
      status_code: options.status_code,
      duration_ms: options.duration_ms,
      data: options.data,
      error_name: options.error?.name,
      error_message: options.error?.message,
      error_stack: options.error?.stack
    })
  }
  
  // Log un événement business
  async businessEvent(event: string, data?: Record<string, any>, user_id?: string) {
    return this.log({
      level: 'INFO',
      source: 'business',
      message: event,
      user_id,
      data
    })
  }
  
  // Log une action d'authentification
  async authEvent(action: 'login' | 'logout' | 'login_failed' | 'token_refresh', options: {
    user_id?: string
    user_email?: string
    ip_address?: string
    user_agent?: string
    error?: Error
  }) {
    const level: LogLevel = action === 'login_failed' ? 'WARN' : 'INFO'
    
    return this.log({
      level,
      source: 'auth',
      message: `Auth: ${action}`,
      user_id: options.user_id,
      user_email: options.user_email,
      ip_address: options.ip_address,
      user_agent: options.user_agent,
      error_message: options.error?.message
    })
  }
}

// Export singleton
export const logger = new Logger()

// Helper pour mesurer le temps d'exécution
export function withTiming<T>(fn: () => Promise<T>): Promise<{ result: T; duration_ms: number }> {
  const start = Date.now()
  return fn().then(result => ({
    result,
    duration_ms: Date.now() - start
  }))
}

// Wrapper pour les API routes
export function withLogging(
  handler: (req: Request) => Promise<Response>,
  source: string
) {
  return async (req: Request): Promise<Response> => {
    const requestId = generateRequestId()
    const start = Date.now()
    const url = new URL(req.url)
    
    try {
      const response = await handler(req)
      const duration_ms = Date.now() - start
      
      await logger.apiRequest({
        source,
        method: req.method,
        path: url.pathname,
        request_id: requestId,
        status_code: response.status,
        duration_ms
      })
      
      return response
    } catch (error: any) {
      const duration_ms = Date.now() - start
      
      await logger.apiRequest({
        source,
        method: req.method,
        path: url.pathname,
        request_id: requestId,
        status_code: 500,
        duration_ms,
        error
      })
      
      throw error
    }
  }
}
