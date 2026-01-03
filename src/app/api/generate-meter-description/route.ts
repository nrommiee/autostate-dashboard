import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { photo, name, manufacturer, meterType, zones, analysis } = body

    if (!photo || !name || !meterType) {
      return NextResponse.json(
        { error: 'Photo, nom et type requis' },
        { status: 400 }
      )
    }

    // Build zones description with user notes
    const zonesDescription = zones.map((zone: any, index: number) => {
      const fieldLabels: Record<string, string> = {
        serialNumber: 'Numéro de compteur',
        ean: 'Code EAN',
        readingSingle: 'Index',
        readingDay: 'Index jour',
        readingNight: 'Index nuit',
        readingProduction: 'Index production',
        subscribedPower: 'Puissance souscrite',
      }
      
      let zoneDesc = `Zone ${index + 1} - ${fieldLabels[zone.fieldType] || zone.fieldType}:`
      
      if (zone.position) {
        zoneDesc += ` position relative (${zone.position.x?.toFixed(0)}%, ${zone.position.y?.toFixed(0)}%)`
      } else if (zone.path) {
        zoneDesc += ` tracé libre`
      }
      
      if (zone.note) {
        zoneDesc += `\n   Note utilisateur: "${zone.note}"`
      }
      
      return zoneDesc
    }).join('\n')

    // Build the prompt
    const prompt = `Tu es un expert en reconnaissance de compteurs d'énergie.

L'utilisateur a créé un modèle de compteur avec ces informations validées:

INFORMATIONS DU MODÈLE:
- Nom: ${name}
- Fabricant: ${manufacturer || 'Non spécifié'}
- Type: ${meterType}

ANALYSE DE L'UTILISATEUR:
- Type détecté: ${analysis?.type || 'Non spécifié'}
- Numéro de compteur: ${analysis?.serialNumber || 'Non spécifié'} (${analysis?.serialNumberLocation || ''})
- Index: ${analysis?.index || 'Non spécifié'} ${analysis?.indexUnit || ''}
- Note sur l'index: ${analysis?.indexNote || 'Aucune'}

ZONES DÉFINIES PAR L'UTILISATEUR:
${zonesDescription || 'Aucune zone définie'}

En te basant sur la photo et TOUTES ces informations, génère une DESCRIPTION TECHNIQUE COMPLÈTE qui servira à Claude pour reconnaître ce type de compteur lors de futurs scans.

La description doit inclure:
1. IDENTIFICATION VISUELLE
   - Forme et couleur du boîtier
   - Marques/logos visibles
   - Caractéristiques distinctives

2. NUMÉRO DE COMPTEUR
   - Où le trouver (position, couleur de l'étiquette, format)
   - Format typique (nombre de chiffres, préfixe)

3. LECTURE DE L'INDEX
   - Type d'affichage (rouleaux mécaniques, LCD, aiguilles)
   - Comment distinguer les entiers des décimales
   - Unité de mesure
   - Conseils de lecture

4. ZONES DE RÉFÉRENCE
   - Reprendre les notes utilisateur pour chaque zone
   - Positions relatives pour guider la lecture

IMPORTANT: Cette description sera utilisée par l'IA pour la reconnaissance automatique. Sois précis, structuré et inclus les notes de l'utilisateur.

Réponds avec UNIQUEMENT la description technique, sans introduction ni conclusion.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
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
