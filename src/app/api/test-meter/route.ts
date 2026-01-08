import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { logApiUsage, createTimer } from '@/lib/api-usage'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: NextRequest) {
  const timer = createTimer()
  let inputTokens = 0
  let outputTokens = 0
  let success = false
  let errorMessage: string | null = null

  try {
    const body = await request.json()
    const { testPhoto, modelId, promptRules, modelData, imageConfig } = body

    if (!testPhoto) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    // Si modelId fourni, récupérer les infos du modèle
    let modelInfo = modelData
    if (modelId && !modelData) {
      const { data: model } = await supabase
        .from('meter_models')
        .select('*')
        .eq('id', modelId)
        .single()
      
      if (model) {
        modelInfo = {
          name: model.name,
          manufacturer: model.manufacturer,
          meterType: model.meter_type,
          unit: model.unit,
          description: model.ai_description,
          zones: model.reading_zones || []
        }
      }
    }

    // Construire le prompt
    let prompt: string

    if (promptRules && promptRules.trim()) {
      // Utiliser le prompt personnalisé du modèle
      prompt = `${promptRules}

TÂCHE:
Analyse cette photo de compteur et extrais les informations demandées.

IMPORTANT: 
- Lis attentivement TOUS les chiffres visibles
- Le numéro de série est souvent gravé ou imprimé sur le boîtier
- L'index est la série de chiffres sur le cadran principal

RETOURNE UNIQUEMENT CE JSON (sans texte avant ou après):
{
  "matches": true,
  "confidence": 0.0-1.0,
  "serial": "Numéro de série extrait ou null",
  "reading": "Index complet extrait ou null",
  "reading_day": "Index jour si bi-horaire ou null",
  "reading_night": "Index nuit si bi-horaire ou null"
}`
    } else if (modelInfo) {
      // Construire un prompt basé sur les infos du modèle
      const { name, manufacturer, meterType, unit, zones } = modelInfo
      const zonesText = (zones || []).map((z: any) => `${z.label || z.id}: ${z.type}`).join(', ')

      prompt = `Tu es un expert en lecture de compteurs. Analyse cette photo.

MODÈLE ATTENDU:
- Compteur: ${manufacturer || ''} ${name}
- Type: ${meterType}
- Unité: ${unit || 'm³'}
${zonesText ? `- Zones à extraire: ${zonesText}` : ''}

TÂCHE:
1. Identifie le numéro de série (souvent gravé sur le boîtier, format: lettres + chiffres)
2. Lis l'index principal (les chiffres du cadran, inclure les décimales si visibles)
3. Évalue ta confiance de 0.0 à 1.0

CONSEILS:
- Le numéro de série commence souvent par "nr", "N°", ou est près de la marque
- L'index est la grande série de chiffres, parfois avec des rouleaux rouges pour les décimales
- Inclure TOUS les chiffres visibles

RETOURNE UNIQUEMENT CE JSON:
{
  "matches": true,
  "confidence": 0.0-1.0,
  "serial": "Numéro de série complet ou null",
  "reading": "Index complet (ex: 84728.674) ou null"
}`
    } else {
      // Analyse générique
      prompt = `Tu es un expert en lecture de compteurs d'énergie (gaz, électricité, eau).

Analyse cette photo et extrais:
1. Le numéro de série du compteur (gravé ou imprimé sur le boîtier)
2. L'index/relevé (la valeur de consommation affichée)
3. Ta confiance dans la lecture (0.0 à 1.0)

RETOURNE UNIQUEMENT CE JSON:
{
  "matches": true,
  "confidence": 0.0-1.0,
  "serial": "Numéro de série ou null",
  "reading": "Index/relevé ou null",
  "meter_type": "gas/electricity/water"
}`
    }

    // Appel Claude Vision
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { 
            type: 'image', 
            source: { 
              type: 'base64', 
              media_type: 'image/jpeg', 
              data: testPhoto 
            } 
          },
          { type: 'text', text: prompt }
        ]
      }]
    })

    inputTokens = response.usage?.input_tokens || 0
    outputTokens = response.usage?.output_tokens || 0

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Pas de réponse de Claude')
    }

    console.log('Claude response:', textContent.text)

    // Parser le JSON
    let result
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw:', textContent.text)
      result = null
    }

    if (!result) {
      return NextResponse.json({
        success: false,
        confidence: 0,
        extractedSerial: null,
        extractedReading: null,
        error: 'Impossible de parser la réponse',
        rawResponse: textContent.text
      })
    }

    success = true

    return NextResponse.json({
      success: result.matches !== false && (result.serial || result.reading),
      confidence: result.confidence || 0.5,
      extractedSerial: result.serial || null,
      extractedReading: result.reading || null,
      extractedReadingDay: result.reading_day || null,
      extractedReadingNight: result.reading_night || null,
      meterType: result.meter_type || null,
      reason: result.reason || null
    })

  } catch (error: any) {
    errorMessage = error.message || 'Erreur test'
    console.error('Test meter error:', error)
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      confidence: 0,
      extractedSerial: null,
      extractedReading: null
    }, { status: 500 })

  } finally {
    await logApiUsage({
      functionId: 'test_model',
      endpoint: '/api/test-meter',
      inputTokens,
      outputTokens,
      imageCount: 1,
      success,
      responseTimeMs: timer.elapsed(),
      errorMessage: errorMessage || undefined
    })
  }
}
