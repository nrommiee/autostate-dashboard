import { NextResponse } from 'next/server'
import { getAllFunctions } from '@/lib/api-registry'

// ============================================
// GET /api/ai - Liste toutes les fonctions
// ============================================
export async function GET() {
  const functions = getAllFunctions()
  
  return NextResponse.json({
    count: functions.length,
    functions: functions.map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
      provider: f.provider,
      model: f.model,
      icon: f.icon,
      endpoint: `/api/ai/${f.id}`,
      supportsImages: f.supportsImages || false,
      supportsAudio: f.supportsAudio || false,
      pricing: {
        inputPer1MTokens: f.inputCostPer1M,
        outputPer1MTokens: f.outputCostPer1M,
        perImage: f.imageCost,
        perAudioMinute: f.audioCostPerMinute
      }
    }))
  })
}
