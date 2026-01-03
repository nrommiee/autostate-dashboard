import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { photos, existingType, userCorrections } = body

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: 'Au moins une photo requise' },
        { status: 400 }
      )
    }

    // Build image content
    const imageContent = photos.slice(0, 4).map((photo: string) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: photo,
      },
    }))

    // Build prompt based on whether we have user corrections
    let prompt = ''
    
    if (userCorrections) {
      // Regeneration with user corrections
      prompt = `Tu es un expert en compteurs d'énergie belges. L'utilisateur a corrigé ton analyse précédente.

CORRECTIONS DE L'UTILISATEUR:
${userCorrections.analysis ? `- Analyse corrigée: "${userCorrections.analysis}"` : ''}
${userCorrections.name ? `- Nom du modèle: ${userCorrections.name}` : ''}
${userCorrections.manufacturer ? `- Fabricant: ${userCorrections.manufacturer}` : ''}
${userCorrections.meterType ? `- Type: ${userCorrections.meterType}` : ''}

En tenant compte de ces corrections, ré-analyse la/les photo(s) et affine ton analyse.

Réponds en JSON strict:
{
  "name": "nom du modèle de compteur",
  "manufacturer": "fabricant",
  "meterType": "water_general|water_passage|electricity|gas|oil_tank|calorimeter|other",
  "description": "description technique courte pour le formulaire",
  "rawAnalysis": "analyse détaillée du compteur visible sur la photo, incluant: apparence physique, type d'affichage, disposition des éléments, numéros visibles, particularités de lecture",
  "suggestedZones": [
    {
      "fieldType": "serialNumber|ean|readingSingle|readingDay|readingNight|readingExclusiveNight|readingProduction|subscribedPower",
      "label": "libellé descriptif",
      "hasDecimals": true/false,
      "decimalDigits": 3
    }
  ]
}`
    } else {
      // Initial analysis
      prompt = `Tu es un expert en compteurs d'énergie belges (eau, électricité, gaz, mazout, calorimètres).

Analyse cette/ces photo(s) de compteur et identifie:
1. Le MODÈLE et FABRICANT (ex: "Itron Aquadis+", "Siconia S442")
2. Le TYPE de compteur
3. Les ZONES DE LECTURE visibles (numéro de série, index, code EAN...)
4. Les CARACTÉRISTIQUES visuelles (affichage à rouleaux, LCD, aiguilles, couleurs...)

${existingType ? `L'utilisateur pense que c'est un compteur de type: ${existingType}` : ''}

Réponds en JSON strict:
{
  "name": "nom du modèle de compteur (ex: Itron Aquadis+)",
  "manufacturer": "fabricant (ex: Itron, Siconia, Elster)",
  "meterType": "water_general|water_passage|electricity|gas|oil_tank|calorimeter|other",
  "description": "description technique courte pour le formulaire",
  "rawAnalysis": "analyse détaillée du compteur visible sur la photo, incluant: apparence physique, type d'affichage (rouleaux noirs/rouges, LCD, aiguilles), disposition des éléments, numéros visibles, particularités de lecture des index",
  "suggestedZones": [
    {
      "fieldType": "serialNumber|ean|readingSingle|readingDay|readingNight|readingExclusiveNight|readingProduction|subscribedPower",
      "label": "libellé descriptif (ex: Numéro de série, Index principal)",
      "hasDecimals": true/false,
      "decimalDigits": 3
    }
  ]
}

IMPORTANT pour suggestedZones:
- serialNumber: numéro de série/compteur
- ean: code EAN 18 chiffres (électricité/gaz)
- readingSingle: index unique (compteurs simples)
- readingDay: index jour/heures pleines (bi-horaire)
- readingNight: index nuit/heures creuses
- readingProduction: index injection (panneaux solaires)
- subscribedPower: puissance souscrite (kVA)

Pour les décimales:
- Compteurs eau: souvent 3 décimales (rouleaux rouges)
- Compteurs électricité: généralement pas de décimales visibles
- Si cadran avec aiguilles rouges = décimales`
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    // Extract text from response
    const textContent = response.content.find(c => c.type === 'text')
    const responseText = textContent && 'text' in textContent ? textContent.text : ''

    // Parse JSON from response
    let result = {
      name: '',
      manufacturer: '',
      meterType: 'other',
      description: '',
      rawAnalysis: responseText,
      suggestedZones: [],
    }

    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        result = {
          name: parsed.name || '',
          manufacturer: parsed.manufacturer || '',
          meterType: parsed.meterType || 'other',
          description: parsed.description || '',
          rawAnalysis: parsed.rawAnalysis || responseText,
          suggestedZones: parsed.suggestedZones || [],
        }
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      // Keep rawAnalysis as the full response if parsing fails
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Analyze meter error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse' },
      { status: 500 }
    )
  }
}
