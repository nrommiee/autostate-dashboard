import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase'
import { logApiUsage, createTimer } from '@/lib/api-usage'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// ============================================
// PROMPT MINIMALISTE
// ============================================
const BASE_PROMPT = `Analyse ce compteur. Extrais les informations visibles.

RÈGLES PAR TYPE:
- GAZ: Index format XXXX,XX (2 décimales, souvent rouges). IGNORE le 3ème chiffre rouge s'il tourne.
- EAU: Index format XXXXX,XX (2 décimales)
- ELEC: Peut avoir jour/nuit séparés

RETOURNE UNIQUEMENT CE JSON:
{
  "detected": {
    "brand": "Fabricant exact visible",
    "model": "Modèle exact visible", 
    "type": "gas|electricity|water_general|water_passage|oil_tank|calorimeter|other",
    "keywords": ["MOT1", "MOT2"]
  },
  "extracted": {
    "serial": "Numéro de série ou null",
    "reading": "Index avec virgule (2 décimales) ou null"
  },
  "zones": [
    {
      "type": "serialNumber|readingSingle|readingDay|readingNight|ean",
      "label": "Libellé",
      "value": "Valeur extraite",
      "decimals": 2,
      "position": {"x": 0.0-1.0, "y": 0.0-1.0, "w": 0.0-1.0, "h": 0.0-1.0}
    }
  ],
  "confidence": 0.0-1.0,
  "quality": {
    "score": 0-100,
    "issues": []
  }
}`

// ============================================
// PROMPT ENRICHI (si modèle connu)
// ============================================
function buildEnrichedPrompt(rules: any): string {
  if (!rules) return BASE_PROMPT
  
  let prompt = `Analyse ce compteur ${rules.brand_name || ''} ${rules.name || ''}.

RÈGLES SPÉCIFIQUES:`
  
  if (rules.prompt_rules) {
    prompt += `\n${rules.prompt_rules}`
  }
  
  if (rules.reading_decimal_digits) {
    prompt += `\n- Index: ${rules.reading_decimal_digits} décimales seulement`
  }
  
  if (rules.decimal_indicator === 'red_digits') {
    prompt += `\n- Chiffres rouges = décimales`
  }
  
  if (rules.extraction_tips) {
    prompt += `\n- ${rules.extraction_tips}`
  }

  prompt += `

RETOURNE UNIQUEMENT CE JSON:
{
  "extracted": {
    "serial": "Numéro de série ou null",
    "reading": "Index avec virgule ou null"
  },
  "zones": [
    {"type": "serialNumber", "value": "...", "position": {"x":0,"y":0,"w":0,"h":0}},
    {"type": "readingSingle", "value": "...", "decimals": ${rules.reading_decimal_digits || 2}, "position": {"x":0,"y":0,"w":0,"h":0}}
  ],
  "confidence": 0.0-1.0
}`

  return prompt
}

// ============================================
// RECHERCHE MODÈLE SIMILAIRE
// ============================================
async function findSimilarModel(detected: any) {
  if (!detected?.brand && !detected?.keywords?.length) return null
  
  const supabase = createAdminClient()
  
  let query = supabase
    .from('meter_models')
    .select(`
      *,
      meter_reading_rules (*)
    `)
    .eq('is_active', true)
  
  if (detected.type) {
    query = query.eq('meter_type', detected.type)
  }
  
  if (detected.brand) {
    query = query.ilike('manufacturer', `%${detected.brand}%`)
  }
  
  const { data } = await query.limit(3)
  
  if (!data || data.length === 0) return null
  
  // Score par mots-clés
  const keywords = detected.keywords || []
  let bestMatch = null
  let bestScore = 0
  
  for (const model of data) {
    const modelKeywords = model.keywords || []
    const matches = keywords.filter((k: string) => 
      modelKeywords.some((mk: string) => 
        mk.toLowerCase().includes(k.toLowerCase()) || 
        k.toLowerCase().includes(mk.toLowerCase())
      )
    ).length
    
    if (matches > bestScore) {
      bestScore = matches
      bestMatch = { ...model, rules: model.meter_reading_rules?.[0] }
    }
  }
  
  return bestMatch
}

// ============================================
// ANALYSE AVEC CLAUDE
// ============================================
async function analyzeWithClaude(base64Image: string, prompt: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64Image }
        },
        { type: 'text', text: prompt }
      ]
    }]
  })

  const textContent = response.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No response')
  }

  let parsed = null
  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch {
    parsed = null
  }

  return {
    parsed,
    usage: response.usage
  }
}

// ============================================
// MAIN ENDPOINT
// ============================================
export async function POST(request: NextRequest) {
  const timer = createTimer()
  let inputTokens = 0
  let outputTokens = 0
  let success = false
  let errorMessage: string | null = null

  try {
    const body = await request.json()
    const { photos, doubleRead = false, modelId = null } = body

    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    const base64Image = photos[0]
    let prompt = BASE_PROMPT
    let knownModel = null

    // Si modèle connu
    if (modelId) {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('meter_models')
        .select(`*, meter_reading_rules (*)`)
        .eq('id', modelId)
        .single()
      
      if (data) {
        knownModel = { ...data, rules: data.meter_reading_rules?.[0] }
        prompt = buildEnrichedPrompt(knownModel.rules)
      }
    }

    // Première lecture
    const result1 = await analyzeWithClaude(base64Image, prompt)
    inputTokens += result1.usage?.input_tokens || 0
    outputTokens += result1.usage?.output_tokens || 0
    
    if (!result1.parsed) {
      throw new Error('Analyse échouée')
    }

    // Qualité photo
    if (result1.parsed.quality?.score && result1.parsed.quality.score < 70) {
      errorMessage = 'Photo de mauvaise qualité'
      return NextResponse.json({
        error: errorMessage,
        quality: result1.parsed.quality,
        suggestion: 'Reprenez la photo avec meilleur éclairage'
      }, { status: 400 })
    }

    // Chercher modèle si pas connu
    if (!knownModel && result1.parsed.detected) {
      knownModel = await findSimilarModel(result1.parsed.detected)
    }

    // Double lecture si demandée
    let finalResult = result1.parsed
    let doubleReadMatch = true
    
    if (doubleRead) {
      const prompt2 = prompt + '\nVérifie bien les décimales et le numéro de série.'
      const result2 = await analyzeWithClaude(base64Image, prompt2)
      inputTokens += result2.usage?.input_tokens || 0
      outputTokens += result2.usage?.output_tokens || 0
      
      if (result2.parsed) {
        const serial1 = result1.parsed.extracted?.serial
        const serial2 = result2.parsed.extracted?.serial
        const reading1 = result1.parsed.extracted?.reading
        const reading2 = result2.parsed.extracted?.reading
        
        if (serial1 === serial2 && reading1 === reading2) {
          finalResult.confidence = Math.min((finalResult.confidence || 0.8) + 0.1, 0.99)
          doubleReadMatch = true
        } else {
          finalResult.confidence = Math.min(finalResult.confidence || 0.5, 0.6)
          finalResult.requiresVerification = true
          finalResult.alternatives = { serial: serial2, reading: reading2 }
          doubleReadMatch = false
        }
      }
    }

    success = true

    // Réponse
    const response = {
      name: knownModel?.name || finalResult.detected?.model || '',
      manufacturer: knownModel?.manufacturer || finalResult.detected?.brand || '',
      meterType: finalResult.detected?.type || 'other',
      serialNumber: finalResult.extracted?.serial || '',
      reading: finalResult.extracted?.reading || '',
      suggestedZones: (finalResult.zones || []).map((z: any) => ({
        fieldType: z.type,
        label: z.label || z.type,
        extractedValue: z.value || '',
        hasDecimals: (z.decimals || 0) > 0,
        decimalDigits: z.decimals || 2,
        position: z.position?.x ? z.position : null
      })),
      keywords: finalResult.detected?.keywords || [],
      confidence: finalResult.confidence || 0.7,
      doubleReadMatch,
      requiresVerification: finalResult.requiresVerification || false,
      quality: finalResult.quality || { score: 80, issues: [] },
      suggestedModel: knownModel ? { id: knownModel.id, name: knownModel.name } : null,
      description: `${finalResult.detected?.brand || ''} ${finalResult.detected?.model || ''}`.trim()
    }

    // Zones par défaut
    if (response.suggestedZones.length === 0) {
      response.suggestedZones = [
        { fieldType: 'serialNumber', label: 'Numéro de série', extractedValue: response.serialNumber, hasDecimals: false, decimalDigits: 0, position: null },
        { fieldType: 'readingSingle', label: 'Index', extractedValue: response.reading, hasDecimals: true, decimalDigits: 2, position: null }
      ]
    }

    return NextResponse.json(response)

  } catch (error: any) {
    errorMessage = error.message || 'Erreur analyse'
    console.error('Meter analysis error:', error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })

  } finally {
    // Log usage
    await logApiUsage({
      functionId: 'analyze_model',
      endpoint: '/api/analyze-meter',
      inputTokens,
      outputTokens,
      imageCount: 1,
      success,
      responseTimeMs: timer.elapsed(),
      errorMessage: errorMessage || undefined
    })
  }
}
