import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ImageConfig {
  grayscale: boolean
  contrast: number
  brightness: number
  sharpness: number
  auto_crop: boolean
  max_dimension: number
  jpeg_quality: number
}

// Default prompt template
const DEFAULT_PROMPT = `Tu es un expert en lecture de compteurs. Analyse cette image de compteur et extrais les informations suivantes de manière précise.

INSTRUCTIONS:
1. Identifie le type de compteur (gaz, électricité, eau, etc.)
2. Lis le numéro de série/matricule du compteur
3. Lis l'index de consommation actuel
4. Indique ton niveau de confiance pour chaque lecture

FORMAT DE RÉPONSE (JSON strict, sans markdown):
{
  "meter_type": "gas|electricity|water|other",
  "serial_number": "string ou null si illisible",
  "reading": {
    "value": "string avec le nombre exact lu",
    "integer_part": "partie entière",
    "decimal_part": "partie décimale ou null",
    "unit": "m³|kWh|L"
  },
  "confidence": {
    "serial": 0.0-1.0,
    "reading": 0.0-1.0,
    "overall": 0.0-1.0
  },
  "notes": "observations éventuelles"
}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { image_base64, model_id, image_config } = body

    if (!image_base64) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 })
    }

    // Get model info if provided
    let meterModel = null
    let recognitionVersion = null
    let promptToUse = DEFAULT_PROMPT

    if (model_id) {
      const { data: model } = await supabase
        .from('meter_models')
        .select('*, recognition_versions(*)')
        .eq('id', model_id)
        .single()

      if (model) {
        meterModel = model
        recognitionVersion = model.recognition_versions

        // Use version's prompt if available
        if (recognitionVersion?.prompt_template) {
          promptToUse = recognitionVersion.prompt_template
        }

        // Add model-specific context to prompt
        promptToUse += `\n\nCONTEXTE DU MODÈLE:
- Nom: ${model.name}
- Fabricant: ${model.manufacturer || 'Non spécifié'}
- Type: ${model.meter_type}
- Unité attendue: ${model.unit || 'm³'}`
      }
    }

    // Call Claude Vision
    const startTime = Date.now()
    
    const message = await anthropic.messages.create({
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
                data: image_base64
              }
            },
            {
              type: 'text',
              text: promptToUse
            }
          ]
        }
      ]
    })

    const processingTime = Date.now() - startTime

    // Parse response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    
    let extractedData = null
    let success = false

    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0])
        success = !!(extractedData.reading?.value || extractedData.serial_number)
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      extractedData = { raw_text: responseText, parse_error: true }
    }

    // Store experiment in database
    const experimentData = {
      experiment_type: 'meter_recognition',
      meter_model_id: model_id || null,
      recognition_version_id: recognitionVersion?.id || null,
      original_photo_url: `data:image/jpeg;base64,${image_base64.substring(0, 100)}...`, // Truncated for storage
      image_config_used: image_config || {},
      raw_ai_response: { text: responseText },
      extracted_data: extractedData,
      confidence: extractedData?.confidence?.overall || 0,
      tokens_input: message.usage.input_tokens,
      tokens_output: message.usage.output_tokens,
      processing_time_ms: processingTime,
      ai_model_used: 'claude-sonnet-4-20250514',
      status: 'pending'
    }

    const { data: experiment, error: insertError } = await supabase
      .from('labs_experiments')
      .insert(experimentData)
      .select()
      .single()

    if (insertError) {
      console.error('Error storing experiment:', insertError)
    }

    return NextResponse.json({
      success,
      extracted_data: extractedData,
      tokens_input: message.usage.input_tokens,
      tokens_output: message.usage.output_tokens,
      processing_time_ms: processingTime,
      raw_response: responseText,
      experiment_id: experiment?.id || null
    })

  } catch (error: any) {
    console.error('Labs test error:', error)
    return NextResponse.json(
      { error: error.message || 'Test failed' },
      { status: 500 }
    )
  }
}
