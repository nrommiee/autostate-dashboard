import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase'
import { logApiUsage, createTimer } from '@/lib/api-usage'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// ============================================
// VALIDATION FORMAT
// ============================================
interface FormatRules {
  serial_digits?: number
  serial_prefix?: string
  reading_integer_digits?: number
  reading_decimal_digits?: number
}

interface ValidationResult {
  valid: boolean
  correctedValue?: string
  error?: string
}

function validateSerial(value: string | null, rules: FormatRules): ValidationResult {
  if (!value) return { valid: true }
  
  const digitsOnly = value.replace(/\D/g, '')
  
  if (rules.serial_digits && digitsOnly.length !== rules.serial_digits) {
    return {
      valid: false,
      error: `N° série: attendu ${rules.serial_digits} chiffres, lu ${digitsOnly.length}`
    }
  }
  
  if (rules.serial_prefix && !digitsOnly.startsWith(rules.serial_prefix)) {
    return {
      valid: false,
      error: `N° série: doit commencer par ${rules.serial_prefix}`
    }
  }
  
  return { valid: true, correctedValue: digitsOnly }
}

function validateReading(value: string | null, rules: FormatRules): ValidationResult {
  if (!value) return { valid: true }
  
  const normalized = value.replace('.', ',').trim()
  const parts = normalized.split(',')
  
  const integerPart = parts[0]?.replace(/\D/g, '') || ''
  const decimalPart = parts[1]?.replace(/\D/g, '') || ''
  
  // Vérifier partie entière
  if (rules.reading_integer_digits && integerPart.length !== rules.reading_integer_digits) {
    const allDigits = integerPart + decimalPart
    const expectedTotal = (rules.reading_integer_digits || 0) + (rules.reading_decimal_digits || 0)
    
    if (allDigits.length === expectedTotal) {
      // Correction automatique possible
      const correctedInteger = allDigits.slice(0, rules.reading_integer_digits)
      const correctedDecimal = allDigits.slice(rules.reading_integer_digits)
      return {
        valid: false,
        correctedValue: `${correctedInteger},${correctedDecimal}`,
        error: `Index corrigé: ${correctedInteger},${correctedDecimal} (IA avait lu ${normalized})`
      }
    }
    
    return {
      valid: false,
      error: `Index: attendu ${rules.reading_integer_digits} entiers, lu ${integerPart.length}`
    }
  }
  
  // Vérifier décimales
  if (rules.reading_decimal_digits && decimalPart.length !== rules.reading_decimal_digits) {
    return {
      valid: false,
      error: `Index: attendu ${rules.reading_decimal_digits} décimales, lu ${decimalPart.length}`
    }
  }
  
  return { valid: true, correctedValue: `${integerPart},${decimalPart}` }
}

// ============================================
// API SCAN METER - APP iOS
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
    const { photo, modelId } = body

    if (!photo) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let model: any = null
    let rules: FormatRules = {}
    let prompt = ''

    // ============================================
    // CAS 1: Modèle connu
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
        const modelRules = data.meter_reading_rules?.[0]
        
        rules = {
          serial_digits: modelRules?.serial_digits,
          serial_prefix: modelRules?.serial_prefix,
          reading_integer_digits: modelRules?.reading_integer_digits,
          reading_decimal_digits: modelRules?.reading_decimal_digits
        }

        prompt = `Lis ce compteur ${model.manufacturer || ''} ${model.name || ''}.

RÈGLES STRICTES:
- N° série: ${rules.serial_digits || '?'} chiffres${rules.serial_prefix ? `, commence par ${rules.serial_prefix}` : ''}
- Index: ${rules.reading_integer_digits || '?'} entiers + ${rules.reading_decimal_digits || '?'} décimales
- Format: ${'X'.repeat(rules.reading_integer_digits || 4)},${rules.reading_decimal_digits ? 'X'.repeat(rules.reading_decimal_digits) : 'XX'}
${modelRules?.decimal_indicator === 'red_digits' ? '- Chiffres ROUGES = décimales' : ''}
${modelRules?.prompt_rules || ''}

RETOURNE UNIQUEMENT:
{"serial": "${rules.serial_digits || 8} chiffres", "reading": "${rules.reading_integer_digits || 4}+${rules.reading_decimal_digits || 2} avec virgule", "confidence": 0.0-1.0}`
      }
    }

    // ============================================
    // CAS 2: Identification automatique
    // ============================================
    if (!model) {
      const detectPrompt = `Identifie ce compteur.
RETOURNE: {"brand": "...", "type": "gas|electricity|water_general|other", "keywords": ["MOT1", "MOT2"]}`

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

      if (detected) {
        let query = supabase
          .from('meter_models')
          .select(`*, meter_reading_rules (*)`)
          .eq('is_active', true)

        if (detected.type) query = query.eq('meter_type', detected.type)
        if (detected.brand) query = query.ilike('manufacturer', `%${detected.brand}%`)

        const { data: models } = await query.limit(5)

        if (models && models.length > 0) {
          const keywords = detected.keywords || []
          let bestScore = 0
          for (const m of models) {
            const modelKeywords = m.keywords || []
            const score = keywords.filter((k: string) =>
              modelKeywords.some((mk: string) => mk.toLowerCase().includes(k.toLowerCase()))
            ).length
            if (score > bestScore) { bestScore = score; model = m }
          }
        }
      }

      // Modèle non trouvé → encodage manuel
      if (!model) {
        return NextResponse.json({
          matched: false,
          unrecognized: true,
          message: 'Modèle non reconnu. Encodez manuellement ou créez ce modèle.',
          detectedBrand: detected?.brand || null,
          detectedType: detected?.type || null,
          detectedKeywords: detected?.keywords || []
        })
      }

      matchedModelId = model.id
      const modelRules = model.meter_reading_rules?.[0]
      rules = {
        serial_digits: modelRules?.serial_digits,
        serial_prefix: modelRules?.serial_prefix,
        reading_integer_digits: modelRules?.reading_integer_digits,
        reading_decimal_digits: modelRules?.reading_decimal_digits
      }

      prompt = `Lis ce compteur ${model.manufacturer || ''} ${model.name || ''}.
Index = ${rules.reading_integer_digits || 4} entiers + ${rules.reading_decimal_digits || 2} décimales
RETOURNE: {"serial": "...", "reading": "XXXX,XX", "confidence": 0.0-1.0}`
    }

    // ============================================
    // LECTURE
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

    // ============================================
    // VALIDATION FORMAT
    // ============================================
    const serialValidation = validateSerial(result.serial, rules)
    const readingValidation = validateReading(result.reading, rules)
    
    const formatErrors: string[] = []
    let finalSerial = result.serial
    let finalReading = result.reading
    
    if (!serialValidation.valid) {
      formatErrors.push(serialValidation.error!)
    } else if (serialValidation.correctedValue) {
      finalSerial = serialValidation.correctedValue
    }
    
    if (!readingValidation.valid) {
      formatErrors.push(readingValidation.error!)
      if (readingValidation.correctedValue) {
        finalReading = readingValidation.correctedValue
      }
    } else if (readingValidation.correctedValue) {
      finalReading = readingValidation.correctedValue
    }

    success = true

    // ============================================
    // RÉPONSE
    // ============================================
    const response: any = {
      model: {
        id: model.id,
        name: model.name,
        manufacturer: model.manufacturer,
        type: model.meter_type
      },
      matched: true,
      
      serial: finalSerial,
      reading: finalReading,
      
      // Si corrigé, montrer l'original
      originalReading: result.reading !== finalReading ? result.reading : undefined,
      
      // Validation
      formatValid: formatErrors.length === 0,
      formatErrors: formatErrors.length > 0 ? formatErrors : undefined,
      formatCorrected: !!readingValidation.correctedValue && !readingValidation.valid,
      
      // Règles utilisées
      expectedFormat: rules.reading_integer_digits && rules.reading_decimal_digits 
        ? `${rules.reading_integer_digits} entiers + ${rules.reading_decimal_digits} décimales`
        : undefined,
      
      confidence: formatErrors.length > 0 
        ? Math.min(result.confidence || 0.5, 0.6) 
        : result.confidence || 0.8,
      
      timestamp: new Date().toISOString()
    }

    // Update stats
    if (model) {
      await supabase
        .from('meter_models')
        .update({ 
          usage_count: (model.usage_count || 0) + 1,
          total_scans: (model.total_scans || 0) + 1,
          success_count: (model.success_count || 0) + (formatErrors.length === 0 ? 1 : 0)
        })
        .eq('id', model.id)
    }

    return NextResponse.json(response)

  } catch (error: any) {
    errorMessage = error.message || 'Erreur scan'
    console.error('Scan meter error:', error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })

  } finally {
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
