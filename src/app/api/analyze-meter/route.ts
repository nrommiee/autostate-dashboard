import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { photo, photos, mode, userCorrections } = body

    // Support both single photo and array
    const photoData = photo || (photos && photos[0])
    
    if (!photoData) {
      return NextResponse.json(
        { error: 'Photo requise' },
        { status: 400 }
      )
    }

    // Build prompt based on mode and corrections
    let prompt = ''
    
    if (userCorrections) {
      // Regeneration with user corrections
      prompt = `Tu es un expert en compteurs d'énergie. L'utilisateur a corrigé ton analyse précédente.

CORRECTIONS:
- Type: ${userCorrections.type || 'non spécifié'}
- Numéro de compteur: ${userCorrections.serialNumber || 'non spécifié'}
- Index: ${userCorrections.index || 'non spécifié'}
- Modèle: ${userCorrections.model || 'non spécifié'}

En tenant compte de ces corrections, affine ton analyse.

Réponds UNIQUEMENT avec ce format exact (pas de JSON, juste ce texte):

TYPE: [type de compteur: Gaz, Eau, Électricité, Mazout, ou Calorimètre]
NUMÉRO DE COMPTEUR: [numéro] ([où il se trouve sur le compteur])
INDEX: [valeur avec unité] ([explication: rouleaux noirs/rouges, décimales, comment lire])
MODÈLE: [fabricant et modèle]`

    } else {
      // Initial analysis - simplified format
      prompt = `Tu es un expert en compteurs d'énergie belges.

Analyse cette photo de compteur et donne-moi UNIQUEMENT ces informations dans ce format exact:

TYPE: [type de compteur: Gaz, Eau, Électricité, Mazout, ou Calorimètre]
NUMÉRO DE COMPTEUR: [numéro que tu vois] ([où il se trouve: ex "étiquette bleue en bas à droite"])
INDEX: [valeur lue avec unité] ([explication de lecture: ex "rouleaux noirs sans décimales" ou "5 rouleaux noirs + 3 rouges = décimales"])
MODÈLE: [fabricant et modèle si visible]

IMPORTANT:
- Sois précis sur les valeurs que tu lis
- Explique comment tu lis l'index (décimales ou pas)
- Si tu ne vois pas une information, écris "Non visible"

Réponds UNIQUEMENT avec ce format, rien d'autre.`
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: photoData,
              },
            },
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

    // Parse the simplified format
    const result = parseSimpleFormat(responseText)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Analyze meter error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'analyse' },
      { status: 500 }
    )
  }
}

function parseSimpleFormat(text: string) {
  const result = {
    type: '',
    serialNumber: '',
    serialNumberLocation: '',
    index: '',
    indexUnit: '',
    indexNote: '',
    model: '',
    rawResponse: text,
  }

  // Parse TYPE
  const typeMatch = text.match(/TYPE:\s*(.+?)(?:\n|$)/i)
  if (typeMatch) {
    result.type = typeMatch[1].trim()
  }

  // Parse NUMÉRO DE COMPTEUR
  const serialMatch = text.match(/NUMÉRO DE COMPTEUR:\s*([^\(]+)(?:\(([^\)]+)\))?/i)
  if (serialMatch) {
    result.serialNumber = serialMatch[1].trim()
    result.serialNumberLocation = serialMatch[2]?.trim() || ''
  }

  // Parse INDEX
  const indexMatch = text.match(/INDEX:\s*([^\(]+)(?:\(([^\)]+)\))?/i)
  if (indexMatch) {
    const indexPart = indexMatch[1].trim()
    // Extract number and unit
    const unitMatch = indexPart.match(/^([\d\s,\.]+)\s*(.*)$/)
    if (unitMatch) {
      result.index = unitMatch[1].trim()
      result.indexUnit = unitMatch[2].trim()
    } else {
      result.index = indexPart
    }
    result.indexNote = indexMatch[2]?.trim() || ''
  }

  // Parse MODÈLE
  const modelMatch = text.match(/MODÈLE:\s*(.+?)(?:\n|$)/i)
  if (modelMatch) {
    result.model = modelMatch[1].trim()
  }

  return result
}
