import { createAdminClient } from '@/lib/supabase'

// ============================================
// CONFIGURATION DES FONCTIONS
// ============================================
export const API_FUNCTIONS = {
  scan_meter: {
    id: 'scan_meter',
    name: 'Lecture compteur',
    description: 'Lit les valeurs d\'un compteur sur le terrain',
    icon: '📷'
  },
  analyze_model: {
    id: 'analyze_model',
    name: 'Création modèle',
    description: 'Analyse une photo pour créer un nouveau modèle',
    icon: '🔍'
  },
  test_model: {
    id: 'test_model',
    name: 'Test modèle',
    description: 'Vérifie qu\'un modèle reconnaît bien un compteur',
    icon: '🧪'
  },
  match_model: {
    id: 'match_model',
    name: 'Identification',
    description: 'Trouve quel modèle correspond à la photo',
    icon: '🎯'
  }
} as const

export type ApiFunctionId = keyof typeof API_FUNCTIONS

// ============================================
// PRICING (Claude Sonnet 4)
// ============================================
const PRICING = {
  input_per_token: 3.0 / 1_000_000,      // $3 per 1M tokens
  output_per_token: 15.0 / 1_000_000,    // $15 per 1M tokens
  image_cost: 0.0048                      // ~$0.0048 par image (~1600 tokens * $3/1M)
}

// ============================================
// CALCUL DU COÛT
// ============================================
export function calculateCost(
  inputTokens: number, 
  outputTokens: number, 
  imageCount: number = 0
): number {
  return (inputTokens * PRICING.input_per_token) + 
         (outputTokens * PRICING.output_per_token) + 
         (imageCount * PRICING.image_cost)
}

// ============================================
// INTERFACE
// ============================================
export interface ApiUsageLog {
  functionId: ApiFunctionId
  endpoint: string
  inputTokens: number
  outputTokens: number
  imageCount?: number
  success: boolean
  responseTimeMs: number
  modelId?: string
  errorMessage?: string
  metadata?: Record<string, any>
  // Linking to missions
  inspectionId?: string
  userId?: string
}

// ============================================
// LOGGER
// ============================================
export async function logApiUsage(log: ApiUsageLog): Promise<string | null> {
  try {
    const func = API_FUNCTIONS[log.functionId]
    const totalTokens = log.inputTokens + log.outputTokens + ((log.imageCount || 0) * 1600)
    const costUsd = calculateCost(log.inputTokens, log.outputTokens, log.imageCount || 0)

    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('api_usage_logs')
      .insert({
        function_id: func.id,
        function_name: func.name,
        function_description: func.description,
        endpoint: log.endpoint,
        input_tokens: log.inputTokens,
        output_tokens: log.outputTokens,
        image_count: log.imageCount || 0,
        total_tokens: totalTokens,
        cost_usd: costUsd,
        success: log.success,
        response_time_ms: log.responseTimeMs,
        model_id: log.modelId || null,
        error_message: log.errorMessage || null,
        metadata: log.metadata || {},
        inspection_id: log.inspectionId || null,
        user_id: log.userId || null
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to log API usage:', error)
      return null
    }

    return data.id
  } catch (err) {
    console.error('Error logging API usage:', err)
    return null
  }
}

// ============================================
// HELPER POUR MESURER LE TEMPS
// ============================================
export function createTimer() {
  const start = Date.now()
  return {
    elapsed: () => Date.now() - start
  }
}
