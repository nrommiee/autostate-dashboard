import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// Types
interface PreprocessingConfig {
  brightness?: number
  contrast?: number
  saturation?: number
  sharpness?: number
  grayscale?: boolean
  binarization?: 'otsu' | 'sauvola' | null
  denoise?: 'median' | 'bilateral' | null
}

interface PromptConfig {
  base_prompt?: string
  meter_type_addon?: string
  output_format?: string
}

interface ExperimentConfig {
  id: string
  name: string
  config_type: string
  config_data: PreprocessingConfig | PromptConfig | any
}

// GET - Liste des runs ou un run spécifique
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const batchId = searchParams.get('batch_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('experiment_runs')
      .select('*, experiment_configs(name, config_type)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (id) {
      query = supabase
        .from('experiment_runs')
        .select('*, experiment_configs(name, config_type)')
        .eq('id', id)
        .single()
    } else {
      if (batchId) {
        query = query.eq('batch_id', batchId)
      }
      if (status) {
        query = query.eq('status', status)
      }
    }

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({ 
      runs: id ? [data] : data,
      total: count 
    })
  } catch (error) {
    console.error('Error fetching runs:', error)
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
  }
}

// POST - Créer et exécuter un nouveau test
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      config_id, 
      image_url, 
      image_base64,
      expected_result,
      batch_id,
      run_immediately = true 
    } = body

    if (!config_id) {
      return NextResponse.json({ error: 'config_id is required' }, { status: 400 })
    }

    if (!image_url && !image_base64) {
      return NextResponse.json({ error: 'image_url or image_base64 is required' }, { status: 400 })
    }

    // Récupérer la config
    const { data: config, error: configError } = await supabase
      .from('experiment_configs')
      .select('*')
      .eq('id', config_id)
      .single()

    if (configError || !config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    // Calculer le hash de l'image pour éviter les doublons
    const imageHash = image_base64 
      ? hashString(image_base64.substring(0, 1000))
      : hashString(image_url)

    // Créer le run
    const { data: run, error: runError } = await supabase
      .from('experiment_runs')
      .insert({
        config_id,
        image_url: image_url || null,
        image_hash: imageHash,
        expected_result: expected_result || null,
        batch_id: batch_id || null,
        status: run_immediately ? 'running' : 'pending'
      })
      .select()
      .single()

    if (runError) throw runError

    // Si run_immediately, exécuter le test
    if (run_immediately) {
      const result = await executeExperiment(run.id, config, image_base64 || image_url)
      return NextResponse.json({ run: result })
    }

    return NextResponse.json({ run })
  } catch (error) {
    console.error('Error creating run:', error)
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 })
  }
}

// Fonction principale d'exécution d'un test
async function executeExperiment(
  runId: string, 
  config: ExperimentConfig, 
  imageData: string
): Promise<any> {
  const startTime = Date.now()
  
  try {
    // Construire le prompt selon la config
    const prompt = buildPrompt(config)
    
    // Préparer l'image
    const imageContent = imageData.startsWith('http') 
      ? await fetchImageAsBase64(imageData)
      : imageData

    // Appel Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageContent.replace(/^data:image\/\w+;base64,/, '')
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    })

    const processingTime = Date.now() - startTime
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
    const apiCost = calculateCost(response.usage?.input_tokens || 0, response.usage?.output_tokens || 0)

    // Parser la réponse
    const textContent = response.content.find(c => c.type === 'text')
    const responseText = textContent?.type === 'text' ? textContent.text : ''
    const actualResult = parseClaudeResponse(responseText)

    // Mettre à jour le run
    const { data: updatedRun, error } = await supabase
      .from('experiment_runs')
      .update({
        actual_result: actualResult,
        confidence_score: actualResult.confidence || 0,
        processing_time_ms: processingTime,
        tokens_used: tokensUsed,
        api_cost_usd: apiCost,
        status: 'completed'
      })
      .eq('id', runId)
      .select()
      .single()

    if (error) throw error

    return updatedRun
  } catch (error) {
    // Marquer comme failed
    await supabase
      .from('experiment_runs')
      .update({
        status: 'failed',
        actual_result: { error: String(error) }
      })
      .eq('id', runId)

    throw error
  }
}

// Construire le prompt selon la config
function buildPrompt(config: ExperimentConfig): string {
  const configData = config.config_data as PromptConfig

  // Prompt de base par défaut
  const basePrompt = configData.base_prompt || `
Tu es un expert en identification de compteurs d'énergie.

Analyse cette image de compteur et extrais:
1. Le TYPE de compteur (électricité, gaz, eau)
2. Le NUMÉRO de série/compteur
3. L'INDEX affiché (avec décimales si présentes)
4. Ta CONFIANCE dans la lecture (0.0 à 1.0)

Règles importantes:
- Pour les compteurs mécaniques à rouleaux, si un chiffre est entre deux positions, prends le chiffre INFÉRIEUR
- Les décimales sont souvent en rouge
- Utilise la virgule comme séparateur décimal

Réponds UNIQUEMENT en JSON:
{
  "type": "electricity|gas|water",
  "serial_number": "string ou null",
  "reading": "string avec virgule",
  "reading_day": "string ou null (si bi-horaire)",
  "reading_night": "string ou null (si bi-horaire)",
  "confidence": 0.0 à 1.0,
  "matched_model_name": "string ou null",
  "explanation": "courte explication"
}
`

  // Ajouter l'addon selon le type de compteur si présent
  const addon = configData.meter_type_addon || ''

  return basePrompt + (addon ? `\n\nINSTRUCTIONS SUPPLÉMENTAIRES:\n${addon}` : '')
}

// Parser la réponse de Claude
function parseClaudeResponse(response: string): any {
  try {
    // Extraire le JSON de la réponse
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { error: 'No JSON found in response', raw: response }
  } catch (e) {
    return { error: 'Failed to parse response', raw: response }
  }
}

// Fetch image et convertir en base64
async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

// Calculer le coût API (Claude Sonnet pricing)
function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000000) * 3  // $3 per 1M input tokens
  const outputCost = (outputTokens / 1000000) * 15  // $15 per 1M output tokens
  return inputCost + outputCost
}

// Simple hash function
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

// PATCH - Évaluer un run (marquer comme correct/incorrect)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, is_correct, error_type, error_details, corrected_values } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Mettre à jour le run
    const { data: run, error } = await supabase
      .from('experiment_runs')
      .update({
        is_correct,
        error_type: is_correct ? null : error_type,
        error_details: is_correct ? null : error_details,
        status: 'evaluated',
        evaluated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Si des corrections sont fournies, les enregistrer
    if (corrected_values && !is_correct) {
      const corrections = Object.entries(corrected_values).map(([field, value]) => ({
        run_id: id,
        original_value: {
          field,
          value: run.actual_result?.[field],
          confidence: run.confidence_score
        },
        corrected_value: { field, value },
        error_category: error_type,
        error_details
      }))

      await supabase
        .from('experiment_corrections')
        .insert(corrections)
    }

    // Si le run fait partie d'un batch, recalculer les stats
    if (run.batch_id) {
      await supabase.rpc('calculate_batch_stats', { p_batch_id: run.batch_id })
    }

    return NextResponse.json({ run })
  } catch (error) {
    console.error('Error evaluating run:', error)
    return NextResponse.json({ error: 'Failed to evaluate run' }, { status: 500 })
  }
}
