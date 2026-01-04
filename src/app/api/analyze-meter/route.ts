import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// ============================================
// PROMPT MINIMALISTE (économie tokens)
// ============================================
const BASE_PROMPT = `Analyse ce compteur. Extrais les informations visibles.

RÈGLES PAR TYPE:
- GAZ: Index format XXXX,XXX (3 décimales, souvent rouges)
- EAU: Index format XXXXX,XX (2 décimales)
- ELEC: Peut avoir jour/nuit séparés

RETOURNE UNIQUEMENT CE JSON:
{
  "detected": {
    "brand": "Fabricant exact visible",
    "model": "Modèle exact visible",
    "type": "gas|electricity|water_general|water_passage|oil_tank|calorimeter|other",
    "keywords": ["MOT1", "MOT2"]
  },
  "extracted": {
    "serial": "Numéro de série ou null",
    "reading": "Index avec virgule ou null",
    "readingDay": "Index jour si bi-horaire ou null",
    "readingNight": "Index nuit si bi-horaire ou null"
  },
  "zones": [
    {
      "type": "serialNumber|readingSingle|readingDay|readingNight|ean",
      "label": "Libellé",
      "value": "Valeur extraite",
      "decimals": 0,
      "position": {"x": 0.0-1.0, "y": 0.0-1.0, "w": 0.0-1.0, "h": 0.0-1.0}
    }
  ],
  "confidence": 0.0-1.0,
  "quality": {
    "score": 0-100,
    "issues": []
  }
}`

// ============================================
// PROMPT ENRICHI (si modèle connu)
// ============================================
function buildEnrichedPrompt(rules: any): string {
  if (!rules) return BASE_PROMPT
  
  let prompt = `Analyse ce compteur ${rules.brand_name || ''} ${rules.name || ''}.

RÈGLES SPÉCIFIQUES:`
  
  if (rules.prompt_rules) {
    prompt += `\n${rules.prompt_rules}`
  }
  
  if (rules.reading_decimal_digits) {
    prompt += `\n- Index: ${rules.reading_decimal_digits} décimales`
  }
  
  if (rules.decimal_indicator === 'red_digits') {
    prompt += `\n- Chiffres rouges = décimales`
  }
  
  if (rules.extraction_tips) {
    prompt += `\n- Conseil: ${rules.extraction_tips}`
  }

  prompt += `

RETOURNE UNIQUEMENT CE JSON:
{
  "extracted": {
    "serial": "Numéro de série ou null",
    "reading": "Index avec virgule ou null"
  },
  "zones": [
    {"type": "serialNumber", "value": "...", "position": {"x":0,"y":0,"w":0,"h":0}},
    {"type": "readingSingle", "value": "...", "decimals": ${rules.reading_decimal_digits || 3}, "position": {"x":0,"y":0,"w":0,"h":0}}
  ],
  "confidence": 0.0-1.0
}`

  return prompt
}

// ============================================
// RECHERCHE MODÈLE SIMILAIRE EN DB
// ============================================
async function findSimilarModel(detected: any) {
  if (!detected?.brand && !detected?.keywords?.length) return null
  
  const supabase = createAdminClient()
  
  let query = supabase
    .from('meter_models_search')
    .select('*')
    .eq('is_active', true)
  
  // Filtre par type si détecté
  if (detected.type) {
    query = query.eq('meter_type', detected.type)
  }
  
  // Filtre par marque si détectée
  if (detected.brand) {
    query = query.ilike('brand_name', `%${detected.brand}%`)
  }
  
  const { data } = await query.limit(3)
  
  if (!data || data.length === 0) return null
  
  // Score de matching par mots-clés
  const keywords = detected.keywords || []
  let bestMatch = null
  let bestScore = 0
  
  for (const model of data) {
    const modelKeywords = model.primary_keywords || []
    const matches = keywords.filter((k: string) => 
      modelKeywords.some((mk: string) => 
        mk.toLowerCase().includes(k.toLowerCase()) || 
        k.toLowerCase().includes(mk.toLowerCase())
      )
    ).length
    
    if (matches > bestScore) {
      bestScore = matches
      bestMatch = model
    }
  }
  
  return bestMatch
}

// ============================================
// ANALYSE AVEC CLAUDE
// ============================================
async function analyzeWithClaude(base64Image: string, prompt: string): Promise<any> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64Image }
        },
        { type: 'text', text: prompt }
      ]
    }]
  })

  const textContent = response.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No response')
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch {
    return null
  }
}

// ============================================
// MAIN ENDPOINT
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      photos, 
      doubleRead = false,  // Dashboard = true, App iOS = false
      modelId = null       // Si modèle déjà connu
    } = body

    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    const base64Image = photos[0]
    let prompt = BASE_PROMPT
    let knownModel = null

    // Si modèle connu, récupérer ses règles
    if (modelId) {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('meter_models_search')
        .select('*')
        .eq('id', modelId)
        .single()
      
      if (data) {
        knownModel = data
        prompt = buildEnrichedPrompt(data)
      }
    }

    // Première lecture
    const result1 = await analyzeWithClaude(base64Image, prompt)
    
    if (!result1) {
      return NextResponse.json({ error: 'Analyse échouée' }, { status: 500 })
    }

    // Vérifier qualité photo
    if (result1.quality?.score && result1.quality.score < 70) {
      return NextResponse.json({
        error: 'Photo de mauvaise qualité',
        quality: result1.quality,
        suggestion: 'Reprenez la photo avec meilleur éclairage'
      }, { status: 400 })
    }

    // Si pas de modèle connu, chercher en DB
    if (!knownModel && result1.detected) {
      knownModel = await findSimilarModel(result1.detected)
    }

    // Double lecture si demandée (dashboard)
    let result2 = null
    let finalResult = result1
    
    if (doubleRead) {
      // Deuxième lecture avec prompt légèrement différent
      const prompt2 = prompt + '\nVérifie bien les décimales et le numéro de série.'
      result2 = await analyzeWithClaude(base64Image, prompt2)
      
      if (result2) {
        // Comparer les deux lectures
        const serial1 = result1.extracted?.serial
        const serial2 = result2.extracted?.serial
        const reading1 = result1.extracted?.reading
        const reading2 = result2.extracted?.reading
        
        // Si les deux lectures concordent = haute confiance
        if (serial1 === serial2 && reading1 === reading2) {
          finalResult = {
            ...result1,
            confidence: Math.min((result1.confidence || 0.8) + 0.1, 0.99),
            doubleReadMatch: true
          }
        } else {
          // Différence = basse confiance, flag pour vérification
          finalResult = {
            ...result1,
            confidence: Math.min(result1.confidence || 0.5, 0.6),
            doubleReadMatch: false,
            alternatives: {
              serial: serial2,
              reading: reading2
            },
            requiresVerification: true
          }
        }
      }
    }

    // Construire la réponse
    const response: any = {
      // Infos détectées
      name: knownModel?.name || result1.detected?.model || '',
      manufacturer: knownModel?.brand_name || result1.detected?.brand || '',
      meterType: result1.detected?.type || 'other',
      
      // Valeurs extraites
      serialNumber: finalResult.extracted?.serial || '',
      reading: finalResult.extracted?.reading || '',
      readingDay: finalResult.extracted?.readingDay || null,
      readingNight: finalResult.extracted?.readingNight || null,
      
      // Zones avec valeurs
      suggestedZones: (finalResult.zones || []).map((z: any) => ({
        fieldType: z.type,
        label: z.label || getZoneLabel(z.type),
        extractedValue: z.value || '',
        hasDecimals: (z.decimals || 0) > 0,
        decimalDigits: z.decimals || 0,
        position: z.position?.x ? z.position : null
      })),
      
      // Mots-clés
      keywords: result1.detected?.keywords || [],
      
      // Confiance
      confidence: finalResult.confidence || 0.7,
      doubleReadMatch: finalResult.doubleReadMatch,
      requiresVerification: finalResult.requiresVerification || false,
      
      // Qualité
      quality: result1.quality || { score: 80, issues: [] },
      
      // Modèle suggéré si trouvé
      suggestedModel: knownModel ? {
        id: knownModel.id,
        name: knownModel.name,
        brand: knownModel.brand_name
      } : null,
      
      // Description générée
      description: knownModel 
        ? `${knownModel.brand_name} ${knownModel.name}` 
        : `Compteur ${result1.detected?.brand || ''} ${result1.detected?.model || ''}`
    }

    // Ajouter zones par défaut si aucune
    if (response.suggestedZones.length === 0) {
      response.suggestedZones = [
        {
          fieldType: 'serialNumber',
          label: 'Numéro de série',
          extractedValue: response.serialNumber,
          hasDecimals: false,
          decimalDigits: 0,
          position: null
        },
        {
          fieldType: 'readingSingle',
          label: 'Index',
          extractedValue: response.reading,
          hasDecimals: true,
          decimalDigits: 3,
          position: null
        }
      ]
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Meter analysis error:', error)
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 })
  }
}

// Helper
function getZoneLabel(type: string): string {
  const labels: Record<string, string> = {
    serialNumber: 'Numéro de série',
    readingSingle: 'Index',
    readingDay: 'Index Jour',
    readingNight: 'Index Nuit',
    ean: 'Code EAN',
    subscribedPower: 'Puissance souscrite'
  }
  return labels[type] || type
}
