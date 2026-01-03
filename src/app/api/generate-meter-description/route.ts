import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { photo, name, manufacturer, meterType, zones, userAnalysis } = body

    if (!photo || !name || !meterType) {
      return NextResponse.json(
        { error: 'Photo, nom et type requis' },
        { status: 400 }
      )
    }

    // Build zones description
    const zonesDescription = zones.map((zone: any) => {
      const position = zone.position
      return `- ${zone.label || zone.fieldType}: position (${position.x.toFixed(1)}%, ${position.y.toFixed(1)}%), taille (${position.width.toFixed(1)}% x ${position.height.toFixed(1)}%)${zone.hasDecimals ? `, ${zone.decimalDigits} décimales` : ''}`
    }).join('\n')

    // Build the prompt
    const prompt = `Tu es un expert en reconnaissance de compteurs d'énergie. 

Voici les informations validées par l'utilisateur pour ce modèle de compteur:
- Nom: ${name}
- Fabricant: ${manufacturer || 'Non spécifié'}
- Type: ${meterType}
- Zones de lecture définies:
${zonesDescription}

${userAnalysis ? `Analyse utilisateur: ${userAnalysis}` : ''}

En te basant sur la photo et ces informations, génère une DESCRIPTION TECHNIQUE PRÉCISE qui servira à Claude pour reconnaître ce type de compteur lors de futurs scans.

La description doit inclure:
1. Caractéristiques visuelles distinctives (forme, couleur, disposition)
2. Type d'affichage (rouleaux mécaniques, LCD, aiguilles...)
3. Emplacement typique des informations (numéro de série en haut, index au centre...)
4. Particularités de lecture (chiffres noirs = entiers, rouges = décimales...)
5. Marques ou logos identifiables

IMPORTANT: Cette description sera utilisée par l'IA pour la reconnaissance automatique. Sois précis et factuel.

Réponds avec UNIQUEMENT la description, sans introduction ni conclusion.`

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
                data: photo,
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
    const description = textContent && 'text' in textContent ? textContent.text : ''

    return NextResponse.json({ description })

  } catch (error) {
    console.error('Generate description error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la génération' },
      { status: 500 }
    )
  }
}
