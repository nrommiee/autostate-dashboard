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
    const { testPhoto, modelData } = body

    if (!testPhoto || !modelData) {
      return NextResponse.json({ error: 'Photo et modèle requis' }, { status: 400 })
    }

    const { name, manufacturer, meterType, keywords, zones, description } = modelData

    // Construire le prompt de test
    const keywordsText = (keywords || []).slice(0, 10).join(', ')
    const zonesText = (zones || []).map((z: any) => z.label || z.fieldType).join(', ')

    const prompt = `Tu dois vérifier si cette photo correspond au modèle de compteur suivant:

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
