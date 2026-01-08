import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// =====================================================
// PERCEPTUAL HASH (pHash) - Génère un fingerprint d'image
// =====================================================

async function generateImageHash(base64: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64, 'base64')
    
    // 1. Réduire à 32x32 en grayscale
    const { data } = await sharp(buffer)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
    
    // 2. Calculer la moyenne des pixels
    const pixels = Array.from(data)
    const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length
    
    // 3. Générer le hash binaire (1 si pixel > moyenne, 0 sinon)
    const hash = pixels.map(p => p > avg ? '1' : '0').join('')
    
    // 4. Convertir en hex pour stockage compact
    let hexHash = ''
    for (let i = 0; i < hash.length; i += 4) {
      hexHash += parseInt(hash.substr(i, 4), 2).toString(16)
    }
    
    return hexHash
  } catch (err) {
    console.error('Hash generation error:', err)
    return ''
  }
}

// Calculer la distance de Hamming entre deux hashs
function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return Infinity
  
  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    const bin1 = parseInt(hash1[i], 16).toString(2).padStart(4, '0')
    const bin2 = parseInt(hash2[i], 16).toString(2).padStart(4, '0')
    for (let j = 0; j < 4; j++) {
      if (bin1[j] !== bin2[j]) distance++
    }
  }
  return distance
}

// Similarité en pourcentage (0-100)
function hashSimilarity(hash1: string, hash2: string): number {
  const maxBits = hash1.length * 4 // 4 bits par caractère hex
  const distance = hammingDistance(hash1, hash2)
  return Math.round((1 - distance / maxBits) * 100)
}

// =====================================================
// COMPRESSION D'IMAGE
// =====================================================

async function compressImage(base64: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64, 'base64')
    const compressed = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer()
    return compressed.toString('base64')
  } catch (err) {
    return base64
  }
}

// =====================================================
// FUZZY TEXT MATCHING
// =====================================================

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '') // Keep only alphanumeric
}

function textSimilarity(text1: string, text2: string): number {
  const a = normalizeText(text1)
  const b = normalizeText(text2)
  
  if (!a || !b) return 0
  if (a === b) return 100
  
  // Check if one contains the other
  if (a.includes(b) || b.includes(a)) return 80
  
  // Levenshtein-like similarity
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  
  if (longer.length === 0) return 100
  
  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++
  }
  
  return Math.round((matches / longer.length) * 100)
}

// =====================================================
// MAIN API
// =====================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('=== CHECK DUPLICATE START ===')
  
  try {
    const { photo_base64, detected_name, detected_manufacturer, detected_type } = await request.json()

    if (!photo_base64) {
      return NextResponse.json({ error: 'Photo requise' }, { status: 400 })
    }

    // Setup
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Config error', isDuplicate: false }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // =====================================================
    // STEP 1: Generate pHash for new photo (~50ms)
    // =====================================================
    console.log('Step 1: Generating pHash...')
    const newHash = await generateImageHash(photo_base64)
    console.log('New photo hash:', newHash.substring(0, 16) + '...')

    // =====================================================
    // STEP 2: Get all models with their hashes
    // =====================================================
    console.log('Step 2: Loading models...')
    const { data: models, error: dbError } = await supabase
      .from('meter_models')
      .select('id, name, manufacturer, meter_type, reference_photos, image_hash')
    
    if (dbError) {
      console.error('DB error:', dbError)
      return NextResponse.json({ error: 'DB error', isDuplicate: false }, { status: 500 })
    }

    const allModels = models || []
    console.log('Total models:', allModels.length)

    if (allModels.length === 0) {
      return NextResponse.json({ isDuplicate: false, matchedModel: null, confidence: 0 })
    }

    // =====================================================
    // STEP 3: Check pHash similarity (~5ms for 500 models)
    // =====================================================
    console.log('Step 3: Checking pHash similarity...')
    const hashMatches: { model: typeof allModels[0], similarity: number }[] = []
    
    for (const model of allModels) {
      if (model.image_hash && newHash) {
        const similarity = hashSimilarity(newHash, model.image_hash)
        if (similarity >= 85) {
          hashMatches.push({ model, similarity })
          console.log(`pHash match: ${model.name} (${similarity}%)`)
        }
      }
    }

    // Sort by similarity
    hashMatches.sort((a, b) => b.similarity - a.similarity)

    // If very high similarity (>95%), it's definitely a duplicate
    if (hashMatches.length > 0 && hashMatches[0].similarity >= 95) {
      const match = hashMatches[0]
      console.log(`DUPLICATE by pHash: ${match.model.name} (${match.similarity}%)`)
      console.log(`Time: ${Date.now() - startTime}ms`)
      
      return NextResponse.json({
        isDuplicate: true,
        matchedModel: {
          id: match.model.id,
          name: match.model.name,
          manufacturer: match.model.manufacturer,
          meter_type: match.model.meter_type,
          photo: match.model.reference_photos?.[0]
        },
        confidence: match.similarity,
        reason: 'Image identique détectée',
        method: 'pHash'
      })
    }

    // =====================================================
    // STEP 4: Check text similarity (~5ms)
    // =====================================================
    console.log('Step 4: Checking text similarity...')
    const textMatches: { model: typeof allModels[0], similarity: number }[] = []
    
    for (const model of allModels) {
      const nameSim = textSimilarity(detected_name || '', model.name)
      const mfgSim = textSimilarity(detected_manufacturer || '', model.manufacturer || '')
      const combinedSim = Math.max(nameSim, (nameSim + mfgSim) / 2)
      
      if (combinedSim >= 70) {
        textMatches.push({ model, similarity: combinedSim })
        console.log(`Text match: ${model.name} (${combinedSim}%)`)
      }
    }

    // If exact text match, likely duplicate
    if (textMatches.length > 0 && textMatches[0].similarity >= 95) {
      // But confirm with Claude to be 100% sure
      console.log('Exact text match, confirming with Claude...')
    }

    // =====================================================
    // STEP 5: Combine candidates for Claude verification
    // =====================================================
    const candidates = new Map<string, typeof allModels[0]>()
    
    // Add hash matches
    hashMatches.slice(0, 3).forEach(m => candidates.set(m.model.id, m.model))
    
    // Add text matches
    textMatches.slice(0, 3).forEach(m => candidates.set(m.model.id, m.model))
    
    const candidateList = Array.from(candidates.values())
    console.log('Candidates for Claude:', candidateList.length)

    // If no candidates, not a duplicate
    if (candidateList.length === 0) {
      console.log('No candidates found, not a duplicate')
      console.log(`Time: ${Date.now() - startTime}ms`)
      
      return NextResponse.json({
        isDuplicate: false,
        matchedModel: null,
        confidence: 0,
        reason: 'Aucun modèle similaire trouvé',
        method: 'pHash+text',
        newHash // Return hash so it can be saved
      })
    }

    // =====================================================
    // STEP 6: Claude verification on candidates only (~2-3s)
    // =====================================================
    if (!anthropicKey) {
      // No Claude key, return best guess from pHash/text
      const bestMatch = hashMatches[0] || textMatches[0]
      if (bestMatch && bestMatch.similarity >= 85) {
        return NextResponse.json({
          isDuplicate: true,
          matchedModel: {
            id: bestMatch.model.id,
            name: bestMatch.model.name,
            manufacturer: bestMatch.model.manufacturer,
            meter_type: bestMatch.model.meter_type,
            photo: bestMatch.model.reference_photos?.[0]
          },
          confidence: bestMatch.similarity,
          reason: 'Match probable (sans vérification IA)',
          method: 'pHash+text'
        })
      }
      return NextResponse.json({ isDuplicate: false, matchedModel: null, confidence: 0 })
    }

    console.log('Step 6: Claude verification...')
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    
    // Compress images for Claude
    const compressedInput = await compressImage(photo_base64)
    
    const content: any[] = [
      {
        type: 'text',
        text: `Compare cette NOUVELLE PHOTO avec les ${candidateList.length} modèles candidats.

NOUVELLE PHOTO - Nom détecté: "${detected_name || 'N/A'}", Fabricant: "${detected_manufacturer || 'N/A'}"`
      },
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: compressedInput }
      }
    ]

    for (let i = 0; i < candidateList.length; i++) {
      const model = candidateList[i]
      const photoUrl = model.reference_photos?.[0]
      
      if (photoUrl) {
        let modelBase64 = ''
        if (photoUrl.startsWith('data:')) {
          modelBase64 = photoUrl.split(',')[1]
        } else if (photoUrl.startsWith('http')) {
          try {
            const resp = await fetch(photoUrl)
            if (resp.ok) {
              const buf = await resp.arrayBuffer()
              modelBase64 = Buffer.from(buf).toString('base64')
            }
          } catch {}
        }
        
        if (modelBase64) {
          const compressed = await compressImage(modelBase64)
          content.push({
            type: 'text',
            text: `\nMODÈLE ${i + 1}: "${model.name}" (${model.manufacturer || 'N/A'})`
          })
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: compressed }
          })
        }
      }
    }

    content.push({
      type: 'text',
      text: `

La NOUVELLE PHOTO montre-t-elle le MÊME modèle de compteur qu'un des candidats ?

Réponds en JSON:
{"isDuplicate": true/false, "matchedModelIndex": 1-${candidateList.length} ou null, "confidence": 0-100, "reason": "explication"}

isDuplicate=true SEULEMENT si c'est exactement le même modèle.
JSON:`
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content }]
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ isDuplicate: false, matchedModel: null, confidence: 0, newHash })
    }

    console.log('Claude response:', textContent.text)

    let result
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      return NextResponse.json({ isDuplicate: false, matchedModel: null, confidence: 0, newHash })
    }

    console.log(`Time: ${Date.now() - startTime}ms`)

    if (result?.isDuplicate && result.matchedModelIndex >= 1 && result.matchedModelIndex <= candidateList.length) {
      const matched = candidateList[result.matchedModelIndex - 1]
      console.log('DUPLICATE confirmed by Claude:', matched.name)
      
      return NextResponse.json({
        isDuplicate: true,
        matchedModel: {
          id: matched.id,
          name: matched.name,
          manufacturer: matched.manufacturer,
          meter_type: matched.meter_type,
          photo: matched.reference_photos?.[0]
        },
        confidence: result.confidence || 90,
        reason: result.reason || 'Doublon confirmé par IA',
        method: 'pHash+text+Claude',
        newHash
      })
    }

    return NextResponse.json({
      isDuplicate: false,
      matchedModel: null,
      confidence: 0,
      reason: result?.reason || 'Pas de doublon',
      method: 'pHash+text+Claude',
      newHash
    })

  } catch (error: any) {
    console.error('Check duplicate error:', error.message)
    return NextResponse.json({ 
      error: error.message, 
      isDuplicate: false, 
      matchedModel: null 
    }, { status: 500 })
  }
}
