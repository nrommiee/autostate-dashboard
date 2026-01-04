import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(request: NextRequest) {
  try {
    const { photos, existingType, extractKeywords, suggestZonesOnly } = await request.json()

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: 'Au moins une photo est requise' },
        { status: 400 }
      )
    }

    const content: any[] = []

    // Add photos
    for (let i = 0; i < Math.min(photos.length, 4); i++) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: photos[i]
        }
      })
    }

    // Build prompt based on mode
    let prompt: string

    if (suggestZonesOnly) {
      prompt = `Analyse cette photo de compteur et identifie les zones de lecture.

Retourne UNIQUEMENT un JSON avec ce format:
{
  "suggestedZones": [
    {
      "fieldType": "serialNumber|ean|readingSingle|readingDay|readingNight|readingExclusiveNight|readingProduction|subscribedPower|custom",
      "label": "Libellé en français",
      "hasDecimals": true/false,
      "decimalDigits": 0-5,
      "position": {
        "x": 0.0-1.0,
        "y": 0.0-1.0,
        "width": 0.0-1.0,
        "height": 0.0-1.0
      }
    }
  ]
}

Position: coordonnées relatives (0-1) par rapport à l'image.
Réponds UNIQUEMENT avec le JSON.`

    } else {
      prompt = `Tu es un expert en compteurs d'énergie. Analyse cette photo de compteur.

TÂCHE:
1. Identifie le fabricant (EXACT comme écrit sur le compteur)
2. Identifie le type (eau/gaz/électricité)
3. Extrais TOUS les textes/mots visibles sur le compteur
4. Suggère les zones de lecture

${existingType ? `Indication: L'utilisateur pense que c'est un compteur de type: ${existingType}` : ''}

Retourne UNIQUEMENT un JSON avec ce format:
{
  "name": "Nom du modèle (ex: Aquadis+)",
  "manufacturer": "Fabricant EXACT visible (ex: WATEAU, ITRON, ELSTER)",
  "meterType": "water_general|water_passage|electricity|gas|oil_tank|calorimeter|other",
  "description": "Description technique en 2-3 phrases",
  "keywords": [
    "FABRICANT_VISIBLE",
    "Texte1_visible",
    "Texte2_visible",
    "Class_X",
    "m³_ou_kWh",
    "autre_marquage"
  ],
  "suggestedZones": [
    {
      "fieldType": "serialNumber|ean|readingSingle|readingDay|readingNight|custom",
      "label": "Libellé",
      "hasDecimals": true/false,
      "decimalDigits": 2,
      "digitCount": 8
    }
  ],
  "photoQuality": {
    "score": 0-100,
    "issues": ["problème1", "problème2"]
  },
  "rawAnalysis": "Ton analyse détaillée"
}

RÈGLES POUR LES MOTS-CLÉS:
- Extrais TOUS les textes lisibles sur le compteur
- Le fabricant doit être EXACTEMENT comme écrit (WATEAU pas Wateau)
- Inclus les unités (m³, kWh, etc.)
- Inclus les classes (Class C, etc.)
- Inclus les codes techniques visibles
- Inclus les caractéristiques (Qn 1.5m³/h, PN 16, etc.)

RÈGLES QUALITÉ PHOTO:
- score 80-100: Bonne qualité, texte lisible
- score 50-79: Qualité moyenne, certains textes difficiles
- score 0-49: Mauvaise qualité
- issues: "Flou", "Trop sombre", "Reflets", "Angle incorrect"

Réponds UNIQUEMENT avec le JSON, sans markdown.`
    }

    content.push({ type: 'text', text: prompt })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    let analysis
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        analysis = JSON.parse(textContent.text)
      }
    } catch {
      analysis = {
        rawAnalysis: textContent.text,
        keywords: [],
        suggestedZones: []
      }
    }

    // Ensure keywords is always an array
    if (!analysis.keywords) {
      analysis.keywords = []
    }

    // Add manufacturer to keywords if not present
    if (analysis.manufacturer && !analysis.keywords.includes(analysis.manufacturer)) {
      analysis.keywords.unshift(analysis.manufacturer)
    }

    return NextResponse.json(analysis)

  } catch (error) {
    console.error('Meter analysis error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse' },
      { status: 500 }
    )
  }
}
