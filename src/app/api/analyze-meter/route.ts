import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(request: NextRequest) {
  try {
    const { photos, existingType, extractKeywords, extractValues } = await request.json()

    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    const content: any[] = []

    for (let i = 0; i < Math.min(photos.length, 4); i++) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: photos[i] }
      })
    }

    const prompt = `Tu es un expert en compteurs d'énergie. Analyse cette photo.

TÂCHE:
1. Identifie le fabricant (EXACT comme écrit)
2. Identifie le modèle
3. Identifie le type (eau/gaz/électricité)
4. Extrais TOUS les textes visibles
5. Extrais le NUMÉRO DE SÉRIE actuel
6. Extrais l'INDEX actuel (avec décimales si visible)
7. Identifie les zones de lecture

${existingType ? `Type indiqué: ${existingType}` : ''}

Retourne UNIQUEMENT ce JSON:
{
  "name": "Nom du modèle",
  "manufacturer": "Fabricant EXACT visible",
  "meterType": "water_general|water_passage|electricity|gas|oil_tank|calorimeter|other",
  "description": "Description technique 2-3 phrases",
  "serialNumber": "Numéro de série extrait ou null",
  "reading": "Index extrait avec décimales (virgule) ou null",
  "keywords": ["MOT1", "MOT2", "..."],
  "suggestedZones": [
    {
      "fieldType": "serialNumber|readingSingle|readingDay|readingNight|ean|custom",
      "label": "Libellé",
      "hasDecimals": true/false,
      "decimalDigits": 3,
      "extractedValue": "Valeur extraite",
      "position": {"x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0}
    }
  ],
  "photoQuality": {
    "score": 0-100,
    "issues": []
  }
}

RÈGLES:
- serialNumber: Le numéro unique du compteur (souvent "Nr." ou "N°")
- reading: L'index de consommation actuel avec décimales (virgule française)
- keywords: TOUS les textes lisibles (fabricant, modèle, normes, etc.)
- position: Coordonnées relatives 0-1 si tu peux identifier où se trouve la zone
- Mets toujours au moins 2 zones: serialNumber et readingSingle

Réponds UNIQUEMENT avec le JSON.`

    content.push({ type: 'text', text: prompt })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No response')
    }

    let analysis
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textContent.text)
    } catch {
      analysis = { rawAnalysis: textContent.text, keywords: [], suggestedZones: [] }
    }

    // Ensure arrays exist
    if (!analysis.keywords) analysis.keywords = []
    if (!analysis.suggestedZones) analysis.suggestedZones = []

    // Add manufacturer to keywords if not present
    if (analysis.manufacturer && !analysis.keywords.includes(analysis.manufacturer)) {
      analysis.keywords.unshift(analysis.manufacturer)
    }

    // Ensure we have at least default zones with extracted values
    if (analysis.suggestedZones.length === 0) {
      analysis.suggestedZones = [
        {
          fieldType: 'serialNumber',
          label: 'Numéro de série',
          hasDecimals: false,
          extractedValue: analysis.serialNumber || ''
        },
        {
          fieldType: 'readingSingle',
          label: 'Index',
          hasDecimals: true,
          decimalDigits: 3,
          extractedValue: analysis.reading || ''
        }
      ]
    } else {
      // Add extracted values to zones if not present
      analysis.suggestedZones = analysis.suggestedZones.map((zone: any) => {
        if (zone.fieldType === 'serialNumber' && !zone.extractedValue) {
          zone.extractedValue = analysis.serialNumber || ''
        }
        if (zone.fieldType === 'readingSingle' && !zone.extractedValue) {
          zone.extractedValue = analysis.reading || ''
        }
        return zone
      })
    }

    return NextResponse.json(analysis)

  } catch (error) {
    console.error('Meter analysis error:', error)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}
