import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase'
import { logApiUsage, createTimer } from '@/lib/api-usage'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// ============================================
// API POUR L'APP iOS - SCAN TERRAIN
// 1 seule lecture, rapide, optimisée tokens
// ============================================

export async function POST(request: NextRequest) {
  const timer = createTimer()
  let inputTokens = 0
  let outputTokens = 0
  let success = false
  let errorMessage: string | null = null
  let matchedModelId: string | null = null

  try {
    const body = await request.json()
    const { photo, modelId, propertyId } = body

    if (!photo) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let model = null
    let prompt = ''

    // ============================================
    // CAS 1: Modèle déjà connu (passé par l'app)
    // ============================================
    if (modelId) {
      const { data } = await supabase
        .from('meter_models')
        .select(`*, meter_reading_rules (*)`)
        .eq('id', modelId)
        .single()

      if (data) {
        model = data
        matchedModelId = model.id
        const rules = data.meter_reading_rules?.[0]

        prompt = `Lis ce compteur ${model.manufacturer || ''} ${model.name || ''}.

RÈGLES:
${rules?.prompt_rules || `- Index: ${rules?.reading_decimal_digits || 2} décimales`}
${rules?.decimal_indicator === 'red_digits' ? '- Chiffres rouges = décimales' : ''}

RETOURNE UNIQUEMENT CE JSON:
{
  "serial": "Numéro de série lu",
  "reading": "Index lu avec virgule (${rules?.reading_decimal_digits || 2} décimales)",
  "confidence": 0.0-1.0
}`
      }
    }

    // ============================================
    // CAS 2: Modèle inconnu - Détection automatique
    // ============================================
    if (!model) {
      // D'abord, identifier le compteur
      const detectPrompt = `Identifie ce compteur rapidement.
RETOURNE UNIQUEMENT: {"brand": "...", "type": "gas|electricity|water_general|other", "keywords": ["MOT1", "MOT2"]}`

      const detectResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo } },
            { type: 'text', text: detectPrompt }
          ]
        }]
      })

      inputTokens += detectResponse.usage?.input_tokens || 0
      outputTokens += detectResponse.usage?.output_tokens || 0

      let detected = null
      const detectText = detectResponse.content.find(c => c.type === 'text')
      if (detectText && detectText.type === 'text') {
        try {
          const match = detectText.text.match(/\{[\s\S]*\}/)
          detected = match ? JSON.parse(match[0]) : null
        } catch {}
      }

      // Chercher modèle correspondant
      if (detected) {
        let query = supabase
          .from('meter_models')
          .select(`*, meter_reading_rules (*)`)
          .eq('is_active', true)

        if (detected.type) {
          query = query.eq('meter_type', detected.type)
        }
        if (detected.brand) {
          query = query.ilike('manufacturer', `%${detected.brand}%`)
        }

        const { data: models } = await query.limit(5)

        if (models && models.length > 0) {
          // Trouver le meilleur match par keywords
          const keywords = detected.keywords || []
          let bestScore = 0
          
          for (const m of models) {
            const modelKeywords = m.keywords || []
            const score = keywords.filter((k: string) =>
              modelKeywords.some((mk: string) => 
                mk.toLowerCase().includes(k.toLowerCase())
              )
            ).length
            
            if (score > bestScore) {
              bestScore = score
              model = m
            }
          }
        }
      }

      // Construire le prompt de lecture
      if (model) {
        matchedModelId = model.id
        const rules = model.meter_reading_rules?.[0]
        prompt = `Lis ce compteur ${model.manufacturer || ''} ${model.name || ''}.
RÈGLES: ${rules?.prompt_rules || 'Index avec 2 décimales'}
RETOURNE: {"serial": "...", "reading": "...", "confidence": 0.0-1.0}`
      } else {
        // Aucun modèle trouvé - lecture générique
        prompt = `Lis ce compteur.
RETOURNE: {"serial": "N° série ou null", "reading": "Index avec virgule ou null", "type": "gas|electricity|water_general|other", "brand": "Fabricant", "confidence": 0.0-1.0, "unrecognized": true}`
      }
    }

    // ============================================
    // LECTURE DU COMPTEUR
    // ============================================
    const readResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo } },
          { type: 'text', text: prompt }
        ]
      }]
    })

    inputTokens += readResponse.usage?.input_tokens || 0
    outputTokens += readResponse.usage?.output_tokens || 0

    let result = null
    const readText = readResponse.content.find(c => c.type === 'text')
    if (readText && readText.type === 'text') {
      try {
        const match = readText.text.match(/\{[\s\S]*\}/)
        result = match ? JSON.parse(match[0]) : null
      } catch {}
    }

    if (!result) {
      throw new Error('Impossible de lire le compteur')
    }

    success = true

    // ============================================
    // RÉPONSE
    // ============================================
    const response = {
      // Modèle trouvé
      model: model ? {
        id: model.id,
        name: model.name,
        manufacturer: model.manufacturer,
        type: model.meter_type
      } : null,
      matched: !!model,
      
      // Valeurs lues
      serial: result.serial || null,
      reading: result.reading || null,
      
      // Confiance
      confidence: result.confidence || 0.7,
      
      // Si non reconnu
      unrecognized: result.unrecognized || false,
      detectedType: result.type || model?.meter_type || null,
      detectedBrand: result.brand || model?.manufacturer || null,
      
      // Métadonnées
      timestamp: new Date().toISOString()
    }

    // Incrémenter usage_count du modèle
    if (model) {
      await supabase
        .from('meter_models')
        .update({ 
          usage_count: model.usage_count + 1,
          total_scans: model.total_scans + 1,
          success_count: model.success_count + (success ? 1 : 0)
        })
        .eq('id', model.id)
    }

    return NextResponse.json(response)

  } catch (error: any) {
    errorMessage = error.message || 'Erreur scan'
    console.error('Scan meter error:', error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })

  } finally {
    // Log usage
    await logApiUsage({
      functionId: 'scan_meter',
      endpoint: '/api/scan-meter',
      inputTokens,
      outputTokens,
      imageCount: 1,
      success,
      responseTimeMs: timer.elapsed(),
      modelId: matchedModelId || undefined,
      errorMessage: errorMessage || undefined
    })
  }
}
