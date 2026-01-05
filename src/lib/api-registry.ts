// ============================================
// API REGISTRY - Configuration centrale
// ============================================
// Pour ajouter une nouvelle fonction :
// 1. Ajouter une entrée dans API_FUNCTIONS
// 2. C'est tout ! La route /api/ai/[function] la gère automatiquement
// ============================================

export type AIProvider = 'anthropic' | 'openai'

export interface ApiFunctionConfig {
  id: string
  name: string
  description: string
  provider: AIProvider
  model: string
  icon: string
  // Pricing
  inputCostPer1M: number
  outputCostPer1M: number
  imageCost?: number
  audioCostPerMinute?: number
  // Configuration
  maxTokens: number
  supportsImages?: boolean
  supportsAudio?: boolean
  // Prompt template (optionnel - peut être fourni dynamiquement)
  systemPrompt?: string
}

// ============================================
// PRICING CONSTANTS
// ============================================
const ANTHROPIC_SONNET_PRICING = {
  inputCostPer1M: 3.0,
  outputCostPer1M: 15.0,
  imageCost: 0.0048 // ~1600 tokens
}

const OPENAI_WHISPER_PRICING = {
  inputCostPer1M: 0,
  outputCostPer1M: 0,
  audioCostPerMinute: 0.006
}

const OPENAI_GPT4O_PRICING = {
  inputCostPer1M: 2.5,
  outputCostPer1M: 10.0,
  imageCost: 0.003
}

// ============================================
// FONCTIONS DISPONIBLES
// ============================================
export const API_FUNCTIONS: Record<string, ApiFunctionConfig> = {
  
  // ==========================================
  // COMPTEURS
  // ==========================================
  scan_meter: {
    id: 'scan_meter',
    name: 'Scan compteur',
    description: 'Lit les valeurs d\'un compteur depuis une photo',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '📷',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 500,
    supportsImages: true,
    systemPrompt: `Tu es un expert en lecture de compteurs. Analyse l'image et retourne UNIQUEMENT un JSON valide.`
  },

  test_model: {
    id: 'test_model',
    name: 'Test modèle',
    description: 'Vérifie qu\'un modèle reconnaît bien un compteur',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '🧪',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 500,
    supportsImages: true
  },

  create_model: {
    id: 'create_model',
    name: 'Création modèle',
    description: 'Analyse une photo pour créer un nouveau modèle de compteur',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '🔍',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 1000,
    supportsImages: true
  },

  // ==========================================
  // PIÈCES / ROOMS
  // ==========================================
  analyze_room: {
    id: 'analyze_room',
    name: 'Analyse pièce',
    description: 'Analyse une photo de pièce et détecte les éléments',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '🏠',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 2000,
    supportsImages: true,
    systemPrompt: `Tu es un expert en états des lieux immobiliers. Analyse cette photo de pièce et identifie tous les éléments visibles (murs, sols, plafonds, équipements, etc.) avec leur état.`
  },

  analyze_element: {
    id: 'analyze_element',
    name: 'Analyse élément',
    description: 'Analyse un élément spécifique (radiateur, fenêtre, etc.)',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '🔎',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 1000,
    supportsImages: true
  },

  // ==========================================
  // CLÉS
  // ==========================================
  analyze_keys: {
    id: 'analyze_keys',
    name: 'Analyse clés',
    description: 'Compte et identifie les clés sur une photo',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '🔑',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 500,
    supportsImages: true,
    systemPrompt: `Compte les clés visibles sur cette photo. Retourne un JSON avec le nombre et le type de chaque clé.`
  },

  // ==========================================
  // DOCUMENTS / TEXTE
  // ==========================================
  generate_amendment: {
    id: 'generate_amendment',
    name: 'Génération avenant',
    description: 'Génère le texte d\'un avenant au bail',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '📝',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 2000,
    supportsImages: false,
    systemPrompt: `Tu es un expert juridique en droit immobilier belge. Rédige un avenant au bail clair et professionnel.`
  },

  extract_lease: {
    id: 'extract_lease',
    name: 'Extraction bail',
    description: 'Extrait les informations d\'un bail PDF',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '📄',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 2000,
    supportsImages: true
  },

  generate_report: {
    id: 'generate_report',
    name: 'Génération rapport',
    description: 'Génère un rapport d\'état des lieux',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '📋',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 4000,
    supportsImages: false
  },

  // ==========================================
  // AUDIO / VOIX
  // ==========================================
  transcribe_voice: {
    id: 'transcribe_voice',
    name: 'Transcription vocale',
    description: 'Convertit un audio en texte (Whisper)',
    provider: 'openai',
    model: 'whisper-1',
    icon: '🎤',
    ...OPENAI_WHISPER_PRICING,
    maxTokens: 0,
    supportsAudio: true
  },

  parse_voice_form: {
    id: 'parse_voice_form',
    name: 'Parsing vocal',
    description: 'Extrait les données structurées d\'une transcription',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '🗣️',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 1000,
    supportsImages: false,
    systemPrompt: `Analyse cette transcription vocale d'un état des lieux et extrait les informations structurées.`
  },

  // ==========================================
  // ÉNERGIE
  // ==========================================
  fill_energy_form: {
    id: 'fill_energy_form',
    name: 'Formulaire énergie',
    description: 'Remplit automatiquement un formulaire énergie',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '⚡',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 1500,
    supportsImages: false
  },

  // ==========================================
  // NFC / eID
  // ==========================================
  parse_eid: {
    id: 'parse_eid',
    name: 'Lecture eID',
    description: 'Parse les données d\'une carte d\'identité',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    icon: '💳',
    ...ANTHROPIC_SONNET_PRICING,
    maxTokens: 500,
    supportsImages: true
  }
}

// ============================================
// HELPERS
// ============================================

export function getFunction(functionId: string): ApiFunctionConfig | null {
  return API_FUNCTIONS[functionId] || null
}

export function getAllFunctions(): ApiFunctionConfig[] {
  return Object.values(API_FUNCTIONS)
}

export function getFunctionsByProvider(provider: AIProvider): ApiFunctionConfig[] {
  return Object.values(API_FUNCTIONS).filter(f => f.provider === provider)
}

export function calculateCost(
  functionId: string,
  inputTokens: number,
  outputTokens: number,
  imageCount: number = 0,
  audioMinutes: number = 0
): number {
  const func = getFunction(functionId)
  if (!func) return 0

  let cost = 0
  cost += (inputTokens / 1_000_000) * func.inputCostPer1M
  cost += (outputTokens / 1_000_000) * func.outputCostPer1M
  
  if (func.imageCost && imageCount > 0) {
    cost += imageCount * func.imageCost
  }
  
  if (func.audioCostPerMinute && audioMinutes > 0) {
    cost += audioMinutes * func.audioCostPerMinute
  }

  return cost
}

// ============================================
// TYPES POUR L'API
// ============================================
export interface AIRequest {
  functionId: string
  prompt?: string
  systemPrompt?: string
  images?: string[] // base64
  audio?: string // base64
  audioFormat?: string
  metadata?: {
    inspectionId?: string
    userId?: string
    roomId?: string
    counterId?: string
    [key: string]: any
  }
}

export interface AIResponse {
  success: boolean
  functionId: string
  result?: any
  rawText?: string
  error?: string
  usage: {
    inputTokens: number
    outputTokens: number
    imageCount: number
    audioMinutes: number
    costUsd: number
  }
  timing: {
    totalMs: number
  }
}
