// ============================================
// Meter Model Version Analysis - Helpers
// ============================================

export interface VersionStats {
  model_id: string
  image_config_label: string
  total_tests: number
  successful_tests: number
  success_rate: number
  avg_confidence: number
  consistency_score: number | null
  first_test_at: string
  last_test_at: string
}

export interface VersionRecommendation extends VersionStats {
  recommendation_score: number
  recommendation_level: 'insufficient_data' | 'strong' | 'moderate' | 'weak'
}

export interface SuggestionResult {
  hasEnoughData: boolean
  recommendedVersion: string | null
  recommendationScore: number | null
  recommendationLevel: 'insufficient_data' | 'strong' | 'moderate' | 'weak'
  analysis: AnalysisDetails | null
  alerts: Alert[]
  message: string
}

export interface AnalysisDetails {
  successRate: { value: number; comparison: string }
  consistency: { value: number | null; comparison: string }
  testVolume: { value: number; status: string }
}

export interface Alert {
  type: 'info' | 'warning' | 'error'
  message: string
}

// ============================================
// SCORE CALCULATION
// ============================================

/**
 * Calculate recommendation score
 * Score = (success_rate * 0.80) + (consistency * 0.20)
 */
export function calculateScore(successRate: number, consistency: number | null): number {
  const consistencyValue = consistency ?? 50 // Default to 50 if no data
  return Math.round((successRate * 0.80) + (consistencyValue * 0.20) * 10) / 10
}

/**
 * Get recommendation level from score
 */
export function getRecommendationLevel(
  score: number, 
  totalTests: number
): 'insufficient_data' | 'strong' | 'moderate' | 'weak' {
  if (totalTests < 3) return 'insufficient_data'
  if (score >= 95) return 'strong'
  if (score >= 85) return 'moderate'
  return 'weak'
}

// ============================================
// SUGGESTION MESSAGES (Fixed rules, no API)
// ============================================

interface MessageConfig {
  pattern: string
  message: string
  condition: (versions: VersionRecommendation[], best: VersionRecommendation) => boolean
}

const SUGGESTION_MESSAGES: MessageConfig[] = [
  {
    pattern: 'insufficient_tests',
    message: 'Pas assez de tests pour faire une suggestion (minimum 3)',
    condition: (versions) => versions.every(v => v.total_tests < 3)
  },
  {
    pattern: 'single_version',
    message: 'Testez d\'autres traitements pour comparer',
    condition: (versions) => versions.length === 1
  },
  {
    pattern: 'all_failing',
    message: 'Aucun traitement optimal. Vérifiez le prompt ou les photos de référence.',
    condition: (versions) => versions.every(v => v.success_rate < 50)
  },
  {
    pattern: 'close_results',
    message: 'Versions équivalentes. Choix basé sur la consistance.',
    condition: (versions, best) => {
      const second = versions.filter(v => v.image_config_label !== best.image_config_label)[0]
      return second && Math.abs(best.success_rate - second.success_rate) < 5
    }
  },
  {
    pattern: 'couleur_wins',
    message: 'Le traitement Couleur conserve l\'information des chiffres colorés (décimales)',
    condition: (_, best) => best.image_config_label?.toLowerCase().includes('couleur')
  },
  {
    pattern: 'nb_wins',
    message: 'Le N&B améliore le contraste et simplifie la lecture',
    condition: (_, best) => 
      best.image_config_label?.toLowerCase().includes('n&b') || 
      best.image_config_label?.toLowerCase().includes('gris')
  },
  {
    pattern: 'contrast_wins',
    message: 'Le contraste augmenté compense les variations d\'éclairage',
    condition: (_, best) => best.image_config_label?.toLowerCase().includes('contraste')
  },
  {
    pattern: 'default',
    message: 'Ce traitement offre les meilleurs résultats pour ce modèle',
    condition: () => true
  }
]

/**
 * Get suggestion message based on patterns
 */
function getSuggestionMessage(versions: VersionRecommendation[], best: VersionRecommendation | null): string {
  if (!best) return 'Aucune donnée disponible'
  
  for (const config of SUGGESTION_MESSAGES) {
    if (config.condition(versions, best)) {
      return config.message
    }
  }
  
  return SUGGESTION_MESSAGES[SUGGESTION_MESSAGES.length - 1].message
}

// ============================================
// ALERTS
// ============================================

interface AlertConfig {
  type: 'info' | 'warning' | 'error'
  message: string
  condition: (
    versions: VersionRecommendation[], 
    best: VersionRecommendation, 
    activeVersion: string | null
  ) => boolean
}

const ALERT_CONFIGS: AlertConfig[] = [
  {
    type: 'warning',
    message: 'La version active n\'est pas la plus performante',
    condition: (_, best, activeVersion) => 
      activeVersion !== null && best.image_config_label !== activeVersion
  },
  {
    type: 'info',
    message: 'Une autre version montre une meilleure consistance',
    condition: (versions, best) => {
      const moreConsistent = versions.find(v => 
        v.image_config_label !== best.image_config_label &&
        v.consistency_score !== null &&
        best.consistency_score !== null &&
        v.consistency_score > best.consistency_score * 1.5 &&
        v.total_tests >= 3
      )
      return !!moreConsistent
    }
  },
  {
    type: 'info',
    message: 'Seulement quelques tests. Résultat à confirmer.',
    condition: (_, best) => best.total_tests >= 3 && best.total_tests < 5
  }
]

/**
 * Get alerts based on current state
 */
function getAlerts(
  versions: VersionRecommendation[], 
  best: VersionRecommendation, 
  activeVersion: string | null
): Alert[] {
  return ALERT_CONFIGS
    .filter(config => config.condition(versions, best, activeVersion))
    .map(config => ({ type: config.type, message: config.message }))
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Analyze versions and generate suggestion
 */
export function analyzeVersions(
  versions: VersionRecommendation[],
  activeVersion: string | null = null
): SuggestionResult {
  // Filter versions with enough data
  const validVersions = versions.filter(v => v.total_tests >= 3)
  
  // Not enough data
  if (validVersions.length === 0) {
    const totalTests = versions.reduce((sum, v) => sum + v.total_tests, 0)
    return {
      hasEnoughData: false,
      recommendedVersion: null,
      recommendationScore: null,
      recommendationLevel: 'insufficient_data',
      analysis: null,
      alerts: [],
      message: totalTests === 0 
        ? 'Aucun test réalisé'
        : `Pas assez de tests pour faire une suggestion (${totalTests} test${totalTests > 1 ? 's' : ''}, minimum 3 par version)`
    }
  }

  // Sort by score descending
  const sorted = [...validVersions].sort((a, b) => b.recommendation_score - a.recommendation_score)
  const best = sorted[0]
  const others = sorted.slice(1)

  // Build comparison strings
  const successComparison = others.length > 0
    ? `${best.image_config_label}: ${best.success_rate}% vs ${others.map(v => `${v.image_config_label}: ${v.success_rate}%`).join(' vs ')}`
    : `${best.success_rate}%`

  const consistencyComparison = best.consistency_score !== null
    ? others.length > 0 && others.some(v => v.consistency_score !== null)
      ? `Écart-type: ${100 - best.consistency_score}% (${others.filter(v => v.consistency_score !== null).map(v => `${v.image_config_label}: ${100 - (v.consistency_score || 0)}%`).join(', ')})`
      : `Écart-type: ${100 - best.consistency_score}%`
    : 'Non calculable (moins de 3 tests)'

  return {
    hasEnoughData: true,
    recommendedVersion: best.image_config_label,
    recommendationScore: best.recommendation_score,
    recommendationLevel: best.recommendation_level,
    analysis: {
      successRate: {
        value: best.success_rate,
        comparison: successComparison
      },
      consistency: {
        value: best.consistency_score,
        comparison: consistencyComparison
      },
      testVolume: {
        value: best.total_tests,
        status: best.total_tests >= 10 ? 'Statistiquement significatif' : 
                best.total_tests >= 5 ? 'Données suffisantes' : 'À confirmer'
      }
    },
    alerts: getAlerts(validVersions, best, activeVersion),
    message: getSuggestionMessage(validVersions, best)
  }
}

// ============================================
// UI HELPERS
// ============================================

export function getRecommendationBadgeColor(level: string): string {
  switch (level) {
    case 'strong': return 'bg-green-100 text-green-700 border-green-200'
    case 'moderate': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'weak': return 'bg-red-100 text-red-700 border-red-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

export function getRecommendationIcon(level: string): string {
  switch (level) {
    case 'strong': return '🟢'
    case 'moderate': return '🟡'
    case 'weak': return '🔴'
    default: return '⚪'
  }
}

export function getRecommendationLabel(level: string): string {
  switch (level) {
    case 'strong': return 'Recommandation forte'
    case 'moderate': return 'Recommandation modérée'
    case 'weak': return 'Recommandation faible'
    default: return 'Données insuffisantes'
  }
}
