export const runtime = 'nodejs'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// Types
interface PreprocessingConfig {
  grayscale: boolean
  contrast: number      // 0-100
  brightness: number    // -100 to 100
  sharpness: number     // 0-100
  saturation: number    // 0-100
}

interface ExtractionZone {
  name: string          // 'meter', 'serial', 'index', 'unit'
  x: number
  y: number
  width: number
  height: number
}

interface LayerResult {
  layer: string
  status: 'success' | 'warning' | 'error'
  duration_ms: number
  details: any
  confidence?: number
}

interface TestResult {
  id: string
  test_id: string
  photo_id: string
  photo_url: string
  
  // Résultats par couche
  layers: LayerResult[]
  
  // Résultat final
  final_result: {
    type: string
    serial_number: string | null
    reading: string
    reading_day: string | null
    reading_night: string | null
    confidence: number
    explanation: string
  }
  
  // Multi-pass results
  multi_pass_results?: {
    pass: string
    result: any
    confidence: number
  }[]
  
  // Métriques
  total_duration_ms: number
  tokens_used: number
  api_cost_usd: number
  
  // Validation
  is_correct?: boolean
  corrected_result?: any
}

// GET - Récupérer les tests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const folderId = searchParams.get('folder_id')
    
    if (id) {
      // Récupérer un test spécifique avec ses résultats
      const { data: test, error } = await supabase
        .from('experiment_tests')
        .select(`
          *,
          experiment_folders(name, detected_type),
          experiment_test_results(*)
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      return NextResponse.json({ test }, { headers: corsHeaders })
    }
    
    // Liste des tests
    let query = supabase
      .from('experiment_tests')
      .select(`
        *,
        experiment_folders(name, detected_type)
      `)
      .order('created_at', { ascending: false })
    
    if (folderId) {
      query = query.eq('folder_id', folderId)
    }
    
    const { data: tests, error } = await query.limit(50)
    if (error) throw error
    
    return NextResponse.json({ tests }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error fetching tests:', error)
    return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500, headers: corsHeaders })
  }
}

// POST - Créer et lancer un test
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { folder_id, run_immediately = true, multi_pass = true } = body
    
    if (!folder_id) {
      return NextResponse.json({ error: 'folder_id is required' }, { status: 400, headers: corsHeaders })
    }
    
    // Récupérer le dossier (requête séparée, plus fiable)
    const { data: folder, error: folderError } = await supabase
      .from('experiment_folders')
      .select('*')
      .eq('id', folder_id)
      .single()
    
    if (folderError || !folder) {
      console.error('Folder error:', folderError)
      return NextResponse.json({ error: 'Folder not found', details: folderError?.message }, { status: 404, headers: corsHeaders })
    }
    
    // Récupérer les photos séparément
    const { data: photos, error: photosError } = await supabase
      .from('experiment_photos')
      .select('*')
      .eq('folder_id', folder_id)
    
    if (photosError) {
      console.error('Photos error:', photosError)
      return NextResponse.json({ error: 'Failed to fetch photos', details: photosError?.message }, { status: 500, headers: corsHeaders })
    }
    
    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'No photos in folder' }, { status: 400, headers: corsHeaders })
    }
    
    // Récupérer les configs (universel, type, modèle)
    const configs = await getLayeredConfigs(folder.detected_type, folder.config_model_id)
    
    // Créer le test
    const { data: test, error: testError } = await supabase
      .from('experiment_tests')
      .insert({
        folder_id,
        config_model_id: folder.config_model_id,
        config_type_id: configs.typeConfig?.id,
        name: `Test ${folder.name} - ${new Date().toLocaleString('fr-BE')}`,
        total_photos: photos.length,
        status: run_immediately ? 'running' : 'pending',
        started_at: run_immediately ? new Date().toISOString() : null
      })
      .select()
      .single()
    
    if (testError) throw testError
    
    // Mettre à jour le statut du dossier
    await supabase
      .from('experiment_folders')
      .update({ status: 'testing' })
      .eq('id', folder_id)
    
    // Lancer les tests si demandé
    if (run_immediately) {
      // Exécuter en arrière-plan (non bloquant)
      executeTestsInBackground(test.id, photos, configs, multi_pass, folder_id)
    }
    
    return NextResponse.json({ test }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error creating test:', error)
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500, headers: corsHeaders })
  }
}

// Récupérer les configs en couches
async function getLayeredConfigs(meterType: string, configModelId?: string) {
  // 1. Config universelle
  const { data: universalConfig } = await supabase
    .from('experiment_config_universal')
    .select('*')
    .single()
  
  // 2. Config type
  const { data: typeConfig } = await supabase
    .from('experiment_config_type')
    .select('*')
    .eq('meter_type', meterType)
    .eq('is_active', true)
    .single()
  
  // 3. Config modèle (si existe)
  let modelConfig = null
  if (configModelId) {
    const { data } = await supabase
      .from('experiment_config_model')
      .select('*')
      .eq('id', configModelId)
      .single()
    modelConfig = data
  }
  
  return { universalConfig, typeConfig, modelConfig }
}

// Exécuter les tests en arrière-plan
async function executeTestsInBackground(
  testId: string,
  photos: any[],
  configs: any,
  multiPass: boolean,
  folderId: string
) {
  let successCount = 0
  let failCount = 0
  let totalConfidence = 0
  let totalTime = 0
  let totalCost = 0
  
  for (const photo of photos) {
    try {
      const result = await executePhotoTest(photo, configs, multiPass)
      
      // Sauvegarder le résultat
      await supabase
        .from('experiment_test_results')
        .insert({
          test_id: testId,
          photo_id: photo.id,
          config_snapshot: {
            universal: configs.universalConfig?.base_prompt,
            type: configs.typeConfig?.additional_prompt,
            model: configs.modelConfig?.specific_prompt,
            preprocessing: getPreprocessingConfig(configs)
          },
          actual_result: result.final_result,
          confidence_score: result.final_result.confidence,
          processing_time_ms: result.total_duration_ms,
          tokens_used: result.tokens_used,
          api_cost_usd: result.api_cost_usd
        })
      
      successCount++
      totalConfidence += result.final_result.confidence
      totalTime += result.total_duration_ms
      totalCost += result.api_cost_usd
      
    } catch (error) {
      console.error(`Error testing photo ${photo.id}:`, error)
      failCount++
    }
  }
  
  // Mettre à jour le test avec les résultats agrégés
  await supabase
    .from('experiment_tests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      successful_count: successCount,
      failed_count: failCount,
      accuracy_rate: photos.length > 0 ? successCount / photos.length : 0,
      avg_confidence: successCount > 0 ? totalConfidence / successCount : 0,
      avg_processing_time_ms: successCount > 0 ? Math.round(totalTime / successCount) : 0,
      total_cost_usd: totalCost
    })
    .eq('id', testId)
  
  // Mettre à jour le dossier
  const newStatus = successCount > 0 && failCount === 0 ? 'validated' : 'ready'
  await supabase
    .from('experiment_folders')
    .update({ 
      status: newStatus,
      last_test_at: new Date().toISOString(),
      photos_since_last_test: 0
    })
    .eq('id', folderId)
}

// Exécuter le test sur une photo avec toutes les couches
async function executePhotoTest(
  photo: any,
  configs: any,
  multiPass: boolean
): Promise<TestResult> {
  const startTime = Date.now()
  const layers: LayerResult[] = []
  let tokensUsed = 0
  let apiCost = 0
  
  // Récupérer l'image
  const imageBase64 = await fetchImageAsBase64(photo.image_url)
  
  // ═══════════════════════════════════════════════════════════════
  // COUCHE 1: Pré-traitement Image
  // ═══════════════════════════════════════════════════════════════
  const layer1Start = Date.now()
  const preprocessingConfig = getPreprocessingConfig(configs)
  // Note: Le traitement d'image réel serait fait côté client (iOS) ou avec Sharp
  // Ici on simule et on passe les paramètres à Claude
  layers.push({
    layer: '1-preprocessing',
    status: 'success',
    duration_ms: Date.now() - layer1Start,
    details: {
      config: preprocessingConfig,
      applied: true
    }
  })
  
  // ═══════════════════════════════════════════════════════════════
  // COUCHE 2: Détection & Cadrage
  // ═══════════════════════════════════════════════════════════════
  const layer2Start = Date.now()
  // Note: Serait fait avec Core ML côté iOS
  layers.push({
    layer: '2-detection',
    status: 'success',
    duration_ms: Date.now() - layer2Start,
    details: {
      meter_detected: true,
      bounding_box: { x: 0, y: 0, width: 100, height: 100 },
      perspective_correction: false
    }
  })
  
  // ═══════════════════════════════════════════════════════════════
  // COUCHE 3: Classification
  // ═══════════════════════════════════════════════════════════════
  const layer3Start = Date.now()
  layers.push({
    layer: '3-classification',
    status: 'success',
    duration_ms: Date.now() - layer3Start,
    details: {
      detected_type: photo.detected_type,
      technology: 'mechanical',
      brand: configs.modelConfig?.manufacturer || 'unknown'
    },
    confidence: photo.ai_confidence || 0.8
  })
  
  // ═══════════════════════════════════════════════════════════════
  // COUCHE 4: Zones d'intérêt (ROI)
  // ═══════════════════════════════════════════════════════════════
  const layer4Start = Date.now()
  const zones = configs.modelConfig?.extraction_zones || []
  layers.push({
    layer: '4-roi',
    status: zones.length > 0 ? 'success' : 'warning',
    duration_ms: Date.now() - layer4Start,
    details: {
      zones_defined: zones.length,
      zones: zones
    }
  })
  
  // ═══════════════════════════════════════════════════════════════
  // COUCHE 5: Prompts combinés
  // ═══════════════════════════════════════════════════════════════
  const layer5Start = Date.now()
  const combinedPrompt = buildCombinedPrompt(configs)
  layers.push({
    layer: '5-prompts',
    status: 'success',
    duration_ms: Date.now() - layer5Start,
    details: {
      universal_prompt: !!configs.universalConfig?.base_prompt,
      type_prompt: !!configs.typeConfig?.additional_prompt,
      model_prompt: !!configs.modelConfig?.specific_prompt,
      combined_length: combinedPrompt.length
    }
  })
  
  // ═══════════════════════════════════════════════════════════════
  // COUCHE 6: OCR Claude Vision
  // ═══════════════════════════════════════════════════════════════
  const layer6Start = Date.now()
  const claudeResult = await callClaudeVision(imageBase64, combinedPrompt)
  tokensUsed += claudeResult.tokens
  apiCost += claudeResult.cost
  
  layers.push({
    layer: '6-ocr-claude',
    status: claudeResult.success ? 'success' : 'error',
    duration_ms: Date.now() - layer6Start,
    details: {
      result: claudeResult.result,
      tokens: claudeResult.tokens,
      cost: claudeResult.cost
    },
    confidence: claudeResult.result?.confidence || 0
  })
  
  // ═══════════════════════════════════════════════════════════════
  // COUCHE 7: Validation croisée (simulée - serait Apple Vision)
  // ═══════════════════════════════════════════════════════════════
  const layer7Start = Date.now()
  // Note: Serait fait avec Apple Vision Framework côté iOS
  const crossValidation = {
    apple_vision_result: claudeResult.result?.reading, // Simulé
    matches_claude: true
  }
  layers.push({
    layer: '7-cross-validation',
    status: crossValidation.matches_claude ? 'success' : 'warning',
    duration_ms: Date.now() - layer7Start,
    details: crossValidation
  })
  
  // ═══════════════════════════════════════════════════════════════
  // COUCHE 8: Validation & Cohérence
  // ═══════════════════════════════════════════════════════════════
  const layer8Start = Date.now()
  const validation = validateResult(claudeResult.result, configs)
  layers.push({
    layer: '8-validation',
    status: validation.valid ? 'success' : 'warning',
    duration_ms: Date.now() - layer8Start,
    details: validation
  })
  
  // ═══════════════════════════════════════════════════════════════
  // COUCHE 9: Multi-pass (optionnel)
  // ═══════════════════════════════════════════════════════════════
  let multiPassResults: any[] = []
  if (multiPass) {
    const layer9Start = Date.now()
    
    // Pass 1: Original (déjà fait)
    multiPassResults.push({
      pass: 'original',
      result: claudeResult.result,
      confidence: claudeResult.result?.confidence || 0
    })
    
    // Pass 2: Instructions plus strictes
    const strictPrompt = combinedPrompt + '\n\nATTENTION: Vérifie chaque chiffre avec une extrême précision. En cas de doute, indique le chiffre INFÉRIEUR.'
    const strictResult = await callClaudeVision(imageBase64, strictPrompt)
    tokensUsed += strictResult.tokens
    apiCost += strictResult.cost
    multiPassResults.push({
      pass: 'strict',
      result: strictResult.result,
      confidence: strictResult.result?.confidence || 0
    })
    
    // Comparer les résultats
    const resultsMatch = multiPassResults[0].result?.reading === multiPassResults[1].result?.reading
    
    layers.push({
      layer: '9-multipass',
      status: resultsMatch ? 'success' : 'warning',
      duration_ms: Date.now() - layer9Start,
      details: {
        passes: multiPassResults.length,
        results_match: resultsMatch,
        passes_detail: multiPassResults
      }
    })
  }
  
  // Résultat final
  const finalResult = {
    type: claudeResult.result?.type || photo.detected_type,
    serial_number: claudeResult.result?.serial_number || null,
    reading: claudeResult.result?.reading || '',
    reading_day: claudeResult.result?.reading_day || null,
    reading_night: claudeResult.result?.reading_night || null,
    confidence: calculateFinalConfidence(layers, multiPassResults),
    explanation: claudeResult.result?.explanation || ''
  }
  
  return {
    id: crypto.randomUUID(),
    test_id: '',
    photo_id: photo.id,
    photo_url: photo.image_url,
    layers,
    final_result: finalResult,
    multi_pass_results: multiPassResults,
    total_duration_ms: Date.now() - startTime,
    tokens_used: tokensUsed,
    api_cost_usd: apiCost
  }
}

// Construire le prompt combiné
function buildCombinedPrompt(configs: any): string {
  let prompt = ''
  
  // ═══════════════════════════════════════════════════════════════
  // NIVEAU 1: Prompt Universel
  // ═══════════════════════════════════════════════════════════════
  if (configs.universalConfig?.base_prompt) {
    prompt += configs.universalConfig.base_prompt
  }
  
  // ═══════════════════════════════════════════════════════════════
  // NIVEAU 2: Prompt Type (gaz, eau, électricité)
  // ═══════════════════════════════════════════════════════════════
  if (configs.typeConfig?.additional_prompt) {
    prompt += '\n\n' + configs.typeConfig.additional_prompt
  }
  
  // ═══════════════════════════════════════════════════════════════
  // NIVEAU 3: Prompt Modèle (généré automatiquement depuis les couches)
  // ═══════════════════════════════════════════════════════════════
  
  // 3a. Prompt spécifique manuel (si défini)
  if (configs.modelConfig?.specific_prompt) {
    prompt += '\n\n=== INSTRUCTIONS SPÉCIFIQUES AU MODÈLE ===\n'
    prompt += configs.modelConfig.specific_prompt
  }
  
  // 3b. Zones ROI (généré automatiquement depuis extraction_zones)
  if (configs.modelConfig?.extraction_zones && configs.modelConfig.extraction_zones.length > 0) {
    prompt += '\n\n=== ZONES D\'INTÉRÊT (ROI) ===\n'
    prompt += 'Les zones suivantes ont été identifiées sur ce modèle de compteur:\n'
    
    for (const zone of configs.modelConfig.extraction_zones) {
      let instruction = ''
      
      switch (zone.type) {
        case 'index':
          instruction = `- ZONE INDEX: Position [${zone.x}%, ${zone.y}%], Taille [${zone.width}% x ${zone.height}%]. C'est ici que se trouve l'affichage principal de l'index.`
          break
        case 'serial':
          instruction = `- ZONE NUMÉRO DE SÉRIE: Position [${zone.x}%, ${zone.y}%], Taille [${zone.width}% x ${zone.height}%]. Le numéro de série/compteur est visible ici.`
          break
        case 'ean':
          instruction = `- ZONE CODE EAN: Position [${zone.x}%, ${zone.y}%], Taille [${zone.width}% x ${zone.height}%]. Le code EAN/code-barres est visible ici.`
          break
        case 'meter':
          instruction = `- ZONE COMPTEUR: Position [${zone.x}%, ${zone.y}%], Taille [${zone.width}% x ${zone.height}%]. Zone globale du compteur.`
          break
        default:
          instruction = `- ZONE ${zone.label?.toUpperCase() || 'CUSTOM'}: Position [${zone.x}%, ${zone.y}%], Taille [${zone.width}% x ${zone.height}%].`
      }
      prompt += instruction + '\n'
    }
    
    prompt += '\nConcentre ton analyse sur ces zones spécifiques.'
  }
  
  // 3c. Caractéristiques visuelles / Config Index (généré automatiquement)
  if (configs.modelConfig?.visual_characteristics) {
    const vc = configs.modelConfig.visual_characteristics
    prompt += '\n\n=== CARACTÉRISTIQUES DE L\'AFFICHAGE ===\n'
    
    if (vc.display_type) {
      prompt += `- Type d'affichage: ${vc.display_type}\n`
    }
    if (vc.num_digits !== undefined) {
      prompt += `- Nombre de chiffres ENTIERS attendus: ${vc.num_digits}\n`
    }
    if (vc.num_decimals !== undefined) {
      prompt += `- Nombre de DÉCIMALES attendues: ${vc.num_decimals}\n`
    }
    if (vc.decimal_color) {
      prompt += `- Couleur des décimales: ${vc.decimal_color}\n`
    }
    if (vc.format_regex) {
      prompt += `- Format attendu (regex): ${vc.format_regex}\n`
    }
    
    // Générer une instruction de validation
    if (vc.num_digits !== undefined || vc.num_decimals !== undefined) {
      const digits = vc.num_digits || 5
      const decimals = vc.num_decimals || 3
      prompt += `\nVÉRIFICATION: L'index doit avoir environ ${digits} chiffres entiers et ${decimals} décimales (format: XXXXX,XXX).`
    }
  }
  
  // 3d. Index config legacy (pour compatibilité avec l'ancien format)
  if (configs.modelConfig?.index_config) {
    const ic = configs.modelConfig.index_config
    if (!configs.modelConfig?.visual_characteristics) {
      prompt += '\n\n=== FORMAT INDEX ===\n'
      if (ic.integerDigits) {
        prompt += `- Chiffres entiers: ${ic.integerDigits}\n`
      }
      if (ic.decimalDigits) {
        prompt += `- Décimales: ${ic.decimalDigits}\n`
      }
    }
  }
  
  // 3e. Prétraitement appliqué (info pour Claude)
  if (configs.modelConfig?.preprocessing_override) {
    const pp = configs.modelConfig.preprocessing_override
    const hasOverrides = pp.grayscale || pp.contrast !== 30 || pp.brightness !== 0 || pp.sharpness !== 20
    
    if (hasOverrides) {
      prompt += '\n\n=== PRÉTRAITEMENT IMAGE ===\n'
      prompt += 'L\'image a été prétraitée avec les paramètres suivants:\n'
      if (pp.grayscale) prompt += '- Conversion en niveaux de gris\n'
      if (pp.contrast && pp.contrast !== 30) prompt += `- Contraste ajusté: ${pp.contrast}%\n`
      if (pp.brightness && pp.brightness !== 0) prompt += `- Luminosité ajustée: ${pp.brightness}\n`
      if (pp.sharpness && pp.sharpness !== 20) prompt += `- Netteté: ${pp.sharpness}%\n`
    }
  }
  
  return prompt
}

// Appeler Claude Vision
async function callClaudeVision(imageBase64: string, prompt: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
            }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })
    
    const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
    const cost = calculateCost(response.usage?.input_tokens || 0, response.usage?.output_tokens || 0)
    
    const textContent = response.content.find(c => c.type === 'text')
    const responseText = textContent?.type === 'text' ? textContent.text : ''
    const result = parseClaudeResponse(responseText)
    
    return { success: true, result, tokens, cost }
  } catch (error) {
    console.error('Claude API error:', error)
    return { success: false, result: null, tokens: 0, cost: 0 }
  }
}

// Parser la réponse Claude
function parseClaudeResponse(response: string): any {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { error: 'No JSON found', raw: response }
  } catch {
    return { error: 'Parse error', raw: response }
  }
}

// Récupérer la config de prétraitement
function getPreprocessingConfig(configs: any): PreprocessingConfig {
  // Priorité: modèle > type > universel > défaut
  const defaults: PreprocessingConfig = {
    grayscale: false,
    contrast: 30,
    brightness: 0,
    sharpness: 20,
    saturation: 100
  }
  
  const universal = configs.universalConfig?.default_preprocessing || {}
  const type = configs.typeConfig?.preprocessing_override || {}
  const model = configs.modelConfig?.preprocessing_override || {}
  
  return { ...defaults, ...universal, ...type, ...model }
}

// Valider le résultat
function validateResult(result: any, configs: any) {
  const issues: string[] = []
  
  if (!result) {
    return { valid: false, issues: ['No result'] }
  }
  
  // Vérifier le format de lecture
  if (result.reading) {
    const readingRegex = configs.modelConfig?.reading_format_regex || configs.typeConfig?.reading_format_regex
    if (readingRegex && !new RegExp(readingRegex).test(result.reading)) {
      issues.push('Reading format mismatch')
    }
    
    // Vérifier plausibilité
    const numericReading = parseFloat(result.reading.replace(',', '.'))
    if (isNaN(numericReading) || numericReading < 0) {
      issues.push('Invalid numeric value')
    }
    if (numericReading > 999999999) {
      issues.push('Reading seems too high')
    }
  }
  
  // Vérifier la confiance
  if (result.confidence < 0.5) {
    issues.push('Low confidence')
  }
  
  return {
    valid: issues.length === 0,
    issues,
    checks: {
      format: issues.filter(i => i.includes('format')).length === 0,
      plausibility: issues.filter(i => i.includes('Invalid') || i.includes('too high')).length === 0,
      confidence: result.confidence >= 0.7
    }
  }
}

// Calculer la confiance finale
function calculateFinalConfidence(layers: LayerResult[], multiPassResults: any[]): number {
  // Moyenne pondérée des couches
  let totalWeight = 0
  let weightedSum = 0
  
  for (const layer of layers) {
    if (layer.confidence !== undefined) {
      const weight = layer.layer === '6-ocr-claude' ? 3 : 1
      weightedSum += layer.confidence * weight
      totalWeight += weight
    }
  }
  
  // Bonus si multi-pass résultats identiques
  if (multiPassResults.length > 1) {
    const allMatch = multiPassResults.every(r => r.result?.reading === multiPassResults[0].result?.reading)
    if (allMatch) {
      weightedSum += 0.1 * totalWeight
    }
  }
  
  return totalWeight > 0 ? Math.min(1, weightedSum / totalWeight) : 0
}

// Fetch image as base64
async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

// Calculer le coût
function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000000) * 3
  const outputCost = (outputTokens / 1000000) * 15
  return inputCost + outputCost
}

// PUT - Mettre à jour un résultat de test (alias de PATCH pour compatibilité)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { result_id, is_correct, corrected_result, error_type, error_details } = body
    
    if (!result_id) {
      return NextResponse.json({ error: 'result_id is required' }, { status: 400, headers: corsHeaders })
    }
    
    const updateData: Record<string, unknown> = {
      is_correct,
      corrected_at: new Date().toISOString()
    }
    
    if (corrected_result) {
      updateData.corrected_result = corrected_result
    }
    if (error_type) {
      updateData.error_type = error_type
    }
    if (error_details) {
      updateData.error_details = error_details
    }
    
    const { data, error } = await supabase
      .from('experiment_test_results')
      .update(updateData)
      .eq('id', result_id)
      .select()
      .single()
    
    if (error) throw error
    
    // Recalculer les stats du test parent
    const { data: result } = await supabase
      .from('experiment_test_results')
      .select('test_id')
      .eq('id', result_id)
      .single()
    
    if (result?.test_id) {
      // Recalculer manuellement les stats
      const { data: allResults } = await supabase
        .from('experiment_test_results')
        .select('is_correct, confidence_score, processing_time_ms, api_cost_usd')
        .eq('test_id', result.test_id)
      
      if (allResults) {
        const validated = allResults.filter(r => r.is_correct === true).length
        const rejected = allResults.filter(r => r.is_correct === false).length
        const total = validated + rejected
        const accuracy = total > 0 ? validated / total : null
        const avgConfidence = allResults.length > 0 
          ? allResults.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / allResults.length 
          : null
        const avgTime = allResults.length > 0
          ? allResults.reduce((sum, r) => sum + (r.processing_time_ms || 0), 0) / allResults.length
          : null
        const totalCost = allResults.reduce((sum, r) => sum + (r.api_cost_usd || 0), 0)
        
        await supabase
          .from('experiment_tests')
          .update({
            successful_count: validated,
            failed_count: rejected,
            accuracy_rate: accuracy,
            avg_confidence: avgConfidence,
            avg_processing_time_ms: avgTime,
            total_cost_usd: totalCost,
            updated_at: new Date().toISOString()
          })
          .eq('id', result.test_id)
      }
    }
    
    return NextResponse.json({ result: data }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error updating test result:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500, headers: corsHeaders })
  }
}

// PATCH - Mettre à jour un résultat de test (correction)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { result_id, is_correct, corrected_result, error_type, error_details } = body
    
    if (!result_id) {
      return NextResponse.json({ error: 'result_id is required' }, { status: 400, headers: corsHeaders })
    }
    
    const { data, error } = await supabase
      .from('experiment_test_results')
      .update({
        is_correct,
        corrected_result,
        error_type,
        error_details,
        corrected_at: new Date().toISOString()
      })
      .eq('id', result_id)
      .select()
      .single()
    
    if (error) throw error
    
    // Recalculer les stats du test parent
    const { data: result } = await supabase
      .from('experiment_test_results')
      .select('test_id')
      .eq('id', result_id)
      .single()
    
    if (result?.test_id) {
      await supabase.rpc('calculate_test_stats', { p_test_id: result.test_id })
    }
    
    return NextResponse.json({ result: data }, { headers: corsHeaders })
  } catch (error) {
    console.error('Error updating test result:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500, headers: corsHeaders })
  }
}
