import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

export async function POST(request: NextRequest) {
  try {
    const { testPhoto, modelData } = await request.json()

    if (!testPhoto) {
      return NextResponse.json(
        { error: 'Photo de test requise' },
        { status: 400 }
      )
    }

    if (!modelData) {
      return NextResponse.json(
        { error: 'Données du modèle requises' },
        { status: 400 }
      )
    }

    // Build the context from model data
    const modelContext = buildModelContext(modelData)

    const content: any[] = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: testPhoto
        }
      },
      {
        type: 'text',
        text: `Tu es un système de reconnaissance de compteurs. 
        
MODÈLE À RECONNAÎTRE:
${modelContext}

TÂCHE:
1. Vérifie si le compteur sur la photo correspond au modèle décrit
2. Si oui, extrais les données (numéro de série, index)
3. Évalue ta confiance

CRITÈRES DE CORRESPONDANCE:
- Le fabricant visible DOIT correspondre exactement au fabricant du modèle
- Le type de compteur DOIT correspondre (eau/gaz/électricité)
- Les mots-clés doivent être présents sur le compteur

Retourne UNIQUEMENT un JSON:
{
  "success": true/false,
  "confidence": 0.0-1.0,
  "matchDetails": {
    "manufacturerMatch": true/false,
    "typeMatch": true/false,
    "keywordsFound": ["mot1", "mot2"],
    "keywordsMissing": ["mot3"]
  },
  "extractedSerial": "numéro ou null",
  "extractedReading": "index avec virgule ou null",
  "explanation": "Pourquoi ça correspond ou non"
}

RÈGLES:
- success = true SEULEMENT si manufacturerMatch ET typeMatch sont true
- confidence >= 0.8 pour un match fiable
- Virgule comme séparateur décimal pour l'index

Réponds UNIQUEMENT avec le JSON.`
      }
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    let result
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        result = JSON.parse(textContent.text)
      }
    } catch {
      result = {
        success: false,
        confidence: 0,
        explanation: 'Erreur de parsing de la réponse'
      }
    }

    return NextResponse.json({
      success: result.success || false,
      confidence: result.confidence || 0,
      extractedSerial: result.extractedSerial || null,
      extractedReading: result.extractedReading || null,
      aiResponse: result
    })

  } catch (error) {
    console.error('Test meter error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du test' },
      { status: 500 }
    )
  }
}

function buildModelContext(modelData: any): string {
  const lines: string[] = []

  lines.push(`NOM: ${modelData.name}`)
  lines.push(`FABRICANT: ${modelData.manufacturer || 'Non spécifié'}`)
  
  const typeLabels: Record<string, string> = {
    water_general: 'Eau - Général',
    water_passage: 'Eau - Passage',
    electricity: 'Électricité',
    gas: 'Gaz',
    oil_tank: 'Mazout',
    calorimeter: 'Calorimètre'
  }
  lines.push(`TYPE: ${typeLabels[modelData.meterType] || modelData.meterType}`)
  lines.push(`UNITÉ: ${modelData.unit}`)

  if (modelData.keywords && modelData.keywords.length > 0) {
    lines.push('')
    lines.push('MOTS-CLÉS À VÉRIFIER:')
    modelData.keywords.forEach((kw: string) => {
      lines.push(`- ${kw}`)
    })
  }

  if (modelData.zones && modelData.zones.length > 0) {
    lines.push('')
    lines.push('ZONES À EXTRAIRE:')
    modelData.zones.forEach((zone: any) => {
      let zoneDesc = `- ${zone.label || zone.fieldType}`
      if (zone.hasDecimals) {
        zoneDesc += ` (${zone.decimalDigits || 2} décimales)`
      }
      lines.push(zoneDesc)
    })
  }

  if (modelData.description) {
    lines.push('')
    lines.push('DESCRIPTION:')
    lines.push(modelData.description)
  }

  return lines.join('\n')
}
