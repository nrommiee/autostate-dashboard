// lib/api-logger.ts
// Helper pour logger les appels API et calculer les coûts

import { createClient } from '@supabase/supabase-js'

// Initialiser Supabase (côté serveur)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Prix par service/modèle (en $ par unité)
const PRICING = {
  claude: {
    'claude-sonnet-4-20250514': {
      input: 3.00 / 1_000_000,   // $3 per 1M tokens
      output: 15.00 / 1_000_000, // $15 per 1M tokens
    },
    'claude-haiku': {
      input: 0.25 / 1_000_000,
      output: 1.25 / 1_000_000,
    },
  },
  whisper: {
    'whisper-1': {
      audio: 0.006 / 60, // $0.006 per minute = per 60 seconds
    },
  },
  openai: {
    'gpt-4-vision': {
      input: 10.00 / 1_000_000,
      output: 30.00 / 1_000_000,
    },
  },
}

// Types
interface LogClaudeParams {
  functionName: string
  model?: string
  inputTokens: number
  outputTokens: number
  userId?: string
  metadata?: Record<string, any>
}

interface LogWhisperParams {
  functionName: string
  audioSeconds: number
  userId?: string
  metadata?: Record<string, any>
}

interface LogOpenAIParams {
  functionName: string
  model?: string
  inputTokens: number
  outputTokens: number
  userId?: string
  metadata?: Record<string, any>
}

// Calculer le coût Claude
function calculateClaudeCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING.claude[model as keyof typeof PRICING.claude] || PRICING.claude['claude-sonnet-4-20250514']
  return (inputTokens * pricing.input) + (outputTokens * pricing.output)
}

// Calculer le coût Whisper
function calculateWhisperCost(audioSeconds: number): number {
  return audioSeconds * PRICING.whisper['whisper-1'].audio
}

// Calculer le coût OpenAI
function calculateOpenAICost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING.openai[model as keyof typeof PRICING.openai] || PRICING.openai['gpt-4-vision']
  return (inputTokens * pricing.input) + (outputTokens * pricing.output)
}

// Logger un appel Claude
export async function logClaudeUsage({
  functionName,
  model = 'claude-sonnet-4-20250514',
  inputTokens,
  outputTokens,
  userId,
  metadata = {},
}: LogClaudeParams): Promise<void> {
  try {
    const estimatedCost = calculateClaudeCost(model, inputTokens, outputTokens)
    
    await supabase.from('api_usage_logs').insert({
      service: 'claude',
      function_name: functionName,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost: estimatedCost,
      user_id: userId || null,
      metadata: { model, ...metadata },
    })
  } catch (error) {
    console.error('Failed to log Claude usage:', error)
    // Ne pas bloquer l'exécution si le logging échoue
  }
}

// Logger un appel Whisper
export async function logWhisperUsage({
  functionName,
  audioSeconds,
  userId,
  metadata = {},
}: LogWhisperParams): Promise<void> {
  try {
    const estimatedCost = calculateWhisperCost(audioSeconds)
    
    await supabase.from('api_usage_logs').insert({
      service: 'whisper',
      function_name: functionName,
      audio_seconds: audioSeconds,
      estimated_cost: estimatedCost,
      user_id: userId || null,
      metadata,
    })
  } catch (error) {
    console.error('Failed to log Whisper usage:', error)
  }
}

// Logger un appel OpenAI
export async function logOpenAIUsage({
  functionName,
  model = 'gpt-4-vision',
  inputTokens,
  outputTokens,
  userId,
  metadata = {},
}: LogOpenAIParams): Promise<void> {
  try {
    const estimatedCost = calculateOpenAICost(model, inputTokens, outputTokens)
    
    await supabase.from('api_usage_logs').insert({
      service: 'openai',
      function_name: functionName,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost: estimatedCost,
      user_id: userId || null,
      metadata: { model, ...metadata },
    })
  } catch (error) {
    console.error('Failed to log OpenAI usage:', error)
  }
}

// Helper pour extraire les tokens d'une réponse Claude
export function extractClaudeTokens(response: any): { inputTokens: number; outputTokens: number } {
  return {
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  }
}

// Exemple d'utilisation dans une route API:
/*
import { logClaudeUsage, extractClaudeTokens } from '@/lib/api-logger'

const response = await anthropic.messages.create({...})

// Logger l'utilisation
const tokens = extractClaudeTokens(response)
await logClaudeUsage({
  functionName: 'analyze-meter',
  inputTokens: tokens.inputTokens,
  outputTokens: tokens.outputTokens,
  metadata: { meterType: 'gas' }
})
*/
