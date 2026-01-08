import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// Helper to detect image media type from base64
function detectMediaType(base64: string): string {
  // Check the first few bytes for image signatures
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBORw')) return 'image/png'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  if (base64.startsWith('UklGR')) return 'image/webp'
  // Default to jpeg
  return 'image/jpeg'
}

export async function POST(request: NextRequest) {
  try {
    const { photos, existingType } = await request.json()

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: 'Au moins une photo est requise' },
        { status: 400 }
      )
    }

    // Build the message content with images
    const content: any[] = []

    // Add each photo as an image
    for (let i = 0; i < Math.min(photos.length, 4); i++) {
      const mediaType = detectMediaType(photos[i])
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: photos[i]
        }
      })
    }

    // Add the analysis prompt
    content.push({
      type: 'text',
      text: `Tu es un expert en compteurs d'énergie (eau, électricité, gaz, mazout). Analyse cette/ces photo(s) de compteur et fournis les informations suivantes en JSON:

{
  "name": "Nom du modèle de compteur (ex: Itron Aquadis+)",
  "manufacturer": "Fabricant (ex: Itron, Landis+Gyr, Elster)",
  "meterType": "Type parmi: water_general, water_passage, electricity, gas, oil_tank, calorimeter, other",
  "displayType": "Type d'affichage parmi: mechanical, digital, dials, other",
  "description": "Description technique du compteur en 2-3 phrases",
  "serialNumber": "Numéro de série visible ou null",
  "reading": "Index/lecture visible ou null",
  "keywords": ["mot-clé1", "mot-clé2"],
  "suggestedZones": [
    {
      "fieldType": "Type parmi: serialNumber, ean, readingSingle, readingDay, readingNight, readingExclusiveNight, readingProduction, subscribedPower, custom",
      "label": "Libellé en français",
      "hasDecimals": true/false,
      "decimalDigits": 2,
      "digitCount": 8
    }
  ],
  "rawAnalysis": "Ton analyse détaillée du compteur"
}

Types de champs possibles:
- serialNumber: Numéro de série du compteur
- ean: Code EAN (18 chiffres)
- readingSingle: Index unique (compteur mono-horaire)
- readingDay: Index jour / heures pleines
- readingNight: Index nuit / heures creuses
- readingExclusiveNight: Index exclusif nuit
- readingProduction: Index production (panneaux solaires)
- subscribedPower: Puissance souscrite
- custom: Champ personnalisé

${existingType ? `L'utilisateur a indiqué que c'est un compteur de type: ${existingType}` : ''}

Réponds UNIQUEMENT avec le JSON, sans markdown ni explications.`
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content
        }
      ]
    })

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON response
    let analysis
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        analysis = JSON.parse(textContent.text)
      }
    } catch (parseError) {
      console.error('JSON parse error:', textContent.text)
      // If JSON parsing fails, return raw analysis
      analysis = {
        rawAnalysis: textContent.text,
        suggestedZones: []
      }
    }

    return NextResponse.json(analysis)
  } catch (error: any) {
    console.error('Meter analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'analyse' },
      { status: 500 }
    )
  }
}
