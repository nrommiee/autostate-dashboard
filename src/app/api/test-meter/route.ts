import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage, createTimer } from '@/lib/api-usage'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(request: NextRequest) {
  const timer = createTimer()
  let inputTokens = 0
  let outputTokens = 0
  let success = false
  let errorMessage: string | null = null

  try {
    const body = await request.json()
    const { testPhoto, promptRules, modelData } = body

    if (!testPhoto) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    // Utiliser soit promptRules (nouveau format) soit modelData (ancien format)
    let prompt: string
    
    if (promptRules) {
      // Nouveau format - prompt déjà généré
      prompt = `${promptRules}

TÂCHE:
Analyse cette photo de compteur et extrais les informations demandées.

RETOURNE UNIQUEMENT CE JSON:
{
  "matches": true,
  "confidence": 0.0-1.0,
  "serial": "Numéro de série extrait ou null",
  "reading": "Index extrait ou null",
  "reading_day": "Index jour si bi-horaire ou null",
  "reading_night": "Index nuit si bi-horaire ou null"
}`
    } else if (modelData) {
      // Ancien format
      const { name, manufacturer, meterType, keywords, zones, description } = modelData
      const keywordsText = (keywords || []).slice(0, 10).join(', ')
      const zonesText = (zones || []).map((z: any) => z.label || z.fieldType).join(', ')

      prompt = `Tu dois vérifier si cette photo correspond au modèle de compteur suivant:

MODÈLE ATTENDU:
- Nom: ${name}
- Fabricant: ${manufacturer || 'Non spécifié'}
- Type: ${meterType}
- Mots-clés: ${keywordsText}
- Zones: ${zonesText}
${description ? `- Description: ${description}` : ''}

TÂCHE:
1. Vérifie si la photo correspond à ce modèle
2. Extrais le numéro de série et l'index si visible
3. Évalue ta confiance (0.0 à 1.0)

RETOURNE UNIQUEMENT CE JSON:
{
  "matches": true/false,
  "confidence": 0.0-1.0,
  "serial": "Numéro de série extrait ou null",
  "reading": "Index extrait ou null",
  "reason": "Raison si non reconnu"
}`
    } else {
      // Aucun prompt - analyse générique
      prompt = `Analyse cette photo de compteur d'énergie (gaz, électricité, eau).

TÂCHE:
1. Identifie le type de compteur
2. Extrais le numéro de série si visible
3. Extrais l'index (la valeur de consommation) si visible
4. Évalue ta confiance (0.0 à 1.0)

RETOURNE UNIQUEMENT CE JSON:
{
  "matches": true,
  "confidence": 0.0-1.0,
  "serial": "Numéro de série extrait ou null",
  "reading": "Index extrait ou null",
  "meter_type": "gas/electricity/water"
}`
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: testPhoto } },
          { type: 'text', text: prompt }
        ]
      }]
    })

    inputTokens = response.usage?.input_tokens || 0
    outputTokens = response.usage?.output_tokens || 0

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response')
    }

    let result
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      result = null
    }

    if (!result) {
      throw new Error('Analyse impossible')
    }

    success = true

    return NextResponse.json({
      success: result.matches === true,
      confidence: result.confidence || 0.5,
      extractedSerial: result.serial || null,
      extractedReading: result.reading || null,
      extractedReadingDay: result.reading_day || null,
      extractedReadingNight: result.reading_night || null,
      reason: result.reason || null
    })

  } catch (error: any) {
    errorMessage = error.message || 'Erreur test'
    console.error('Test meter error:', error)
    return NextResponse.json({ 
      success: false, 
      error: errorMessage,
      confidence: 0 
    }, { status: 500 })

  } finally {
    // Log usage
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
