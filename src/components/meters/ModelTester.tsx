'use client'

import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { MeterZone, MeterType, METER_TYPE_CONFIG, METER_FIELD_CONFIG } from '@/lib/supabase'
import { Keyword } from './KeywordsSelector'
import { Upload, Play, CheckCircle, XCircle, Loader2, Check, RotateCcw } from 'lucide-react'

export interface TestResult {
  id: string
  photoUrl: string
  testedAt: Date
  success: boolean
  validationType: 'auto' | 'manual'
  confidence: number
  extractedSerial?: string
  extractedReading?: string
  expectedSerial?: string
  expectedReading?: string
  aiResponse?: any
}

interface ModelTesterProps {
  modelData: {
    name: string
    manufacturer: string
    meterType: MeterType
    unit: string
    keywords: Keyword[]
    zones: MeterZone[]
    photoUrl: string | null
    description?: string
  }
  testHistory: TestResult[]
  onTestComplete: (result: TestResult) => void
  disabled?: boolean
}

export function ModelTester({
  modelData,
  testHistory,
  onTestComplete,
  disabled
}: ModelTesterProps) {
  const [testPhotoFile, setTestPhotoFile] = useState<File | null>(null)
  const [testPhotoUrl, setTestPhotoUrl] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    confidence: number
    extractedSerial?: string
    extractedReading?: string
    aiResponse?: any
  } | null>(null)
  const [manualValidation, setManualValidation] = useState<{
    serial: string
    reading: string
  }>({ serial: '', reading: '' })

  // Handle test photo upload
  const handleTestPhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Cleanup previous
    if (testPhotoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(testPhotoUrl)
    }

    const url = URL.createObjectURL(file)
    setTestPhotoFile(file)
    setTestPhotoUrl(url)
    setTestResult(null)
    setManualValidation({ serial: '', reading: '' })
  }, [testPhotoUrl])

  // Run test
  const runTest = async () => {
    if (!testPhotoFile) return

    setTesting(true)
    setTestResult(null)

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = (reader.result as string).split(',')[1]
          resolve(result)
        }
        reader.readAsDataURL(testPhotoFile)
      })

      // Call test API
      const response = await fetch('/api/test-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testPhoto: base64,
          modelData: {
            name: modelData.name,
            manufacturer: modelData.manufacturer,
            meterType: modelData.meterType,
            unit: modelData.unit,
            keywords: modelData.keywords.filter(k => k.validated).map(k => k.value),
            zones: modelData.zones,
            description: modelData.description
          }
        })
      })

      if (!response.ok) {
        throw new Error('Erreur lors du test')
      }

      const result = await response.json()
      
      setTestResult({
        success: result.success,
        confidence: result.confidence,
        extractedSerial: result.extractedSerial,
        extractedReading: result.extractedReading,
        aiResponse: result.aiResponse
      })

      // Pre-fill manual validation with extracted values
      setManualValidation({
        serial: result.extractedSerial || '',
        reading: result.extractedReading || ''
      })

      // If auto-success, record it
      if (result.success && result.confidence >= 0.8) {
        const testResultRecord: TestResult = {
          id: crypto.randomUUID(),
          photoUrl: testPhotoUrl!,
          testedAt: new Date(),
          success: true,
          validationType: 'auto',
          confidence: result.confidence,
          extractedSerial: result.extractedSerial,
          extractedReading: result.extractedReading,
          aiResponse: result.aiResponse
        }
        onTestComplete(testResultRecord)
      }

    } catch (err) {
      console.error('Test error:', err)
      setTestResult({
        success: false,
        confidence: 0,
        aiResponse: { error: 'Erreur lors du test' }
      })
    } finally {
      setTesting(false)
    }
  }

  // Manual validation
  const validateManually = () => {
    if (!testPhotoUrl) return

    const testResultRecord: TestResult = {
      id: crypto.randomUUID(),
      photoUrl: testPhotoUrl,
      testedAt: new Date(),
      success: true,
      validationType: 'manual',
      confidence: testResult?.confidence || 0,
      extractedSerial: testResult?.extractedSerial,
      extractedReading: testResult?.extractedReading,
      expectedSerial: manualValidation.serial || undefined,
      expectedReading: manualValidation.reading || undefined,
      aiResponse: testResult?.aiResponse
    }
    onTestComplete(testResultRecord)
    
    // Reset for next test
    resetTest()
  }

  // Reset test
  const resetTest = () => {
    if (testPhotoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(testPhotoUrl)
    }
    setTestPhotoFile(null)
    setTestPhotoUrl(null)
    setTestResult(null)
    setManualValidation({ serial: '', reading: '' })
  }

  // Calculate test stats
  const successCount = testHistory.filter(t => t.success).length
  const totalTests = testHistory.length
  const successRate = totalTests > 0 ? Math.round((successCount / totalTests) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Test stats */}
      {totalTests > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Taux de réussite</div>
              <div className={`text-2xl font-bold ${successRate >= 80 ? 'text-green-600' : successRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {successRate}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Tests effectués</div>
              <div className="text-lg font-semibold">
                {successCount} / {totalTests}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Test area */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Test de reconnaissance</h3>
        <p className="text-sm text-gray-500 mb-4">
          Uploadez une photo du même modèle de compteur pour tester la reconnaissance.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Upload area */}
          <div>
            {testPhotoUrl ? (
              <div className="relative">
                <img
                  src={testPhotoUrl}
                  alt="Photo de test"
                  className="w-full rounded-lg border"
                />
                <button
                  type="button"
                  onClick={resetTest}
                  className="absolute top-2 right-2 p-1.5 bg-gray-800 text-white rounded-full hover:bg-gray-700"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className={`
                flex flex-col items-center justify-center h-48 
                border-2 border-dashed border-gray-300 rounded-lg 
                cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}>
                <Upload className="h-10 w-10 text-gray-400 mb-3" />
                <span className="text-gray-600 font-medium">Photo de test</span>
                <span className="text-gray-400 text-sm mt-1">Même modèle, autre exemplaire</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleTestPhotoUpload}
                  className="hidden"
                  disabled={disabled}
                />
              </label>
            )}

            {testPhotoUrl && !testResult && (
              <Button
                type="button"
                onClick={runTest}
                disabled={testing || disabled}
                className="w-full mt-4 gap-2"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {testing ? 'Test en cours...' : 'Lancer le test'}
              </Button>
            )}
          </div>

          {/* Results */}
          <div>
            {testResult && (
              <div className="space-y-4">
                {/* Status */}
                <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`font-semibold ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {testResult.success ? 'Reconnu' : 'Non reconnu'}
                    </span>
                    <Badge variant="outline">
                      {Math.round(testResult.confidence * 100)}%
                    </Badge>
                  </div>

                  {/* Extracted data */}
                  {(testResult.extractedSerial || testResult.extractedReading) && (
                    <div className="text-sm space-y-1 mt-3">
                      {testResult.extractedSerial && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">N° compteur:</span>
                          <span className="font-mono">{testResult.extractedSerial}</span>
                        </div>
                      )}
                      {testResult.extractedReading && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Index:</span>
                          <span className="font-mono">{testResult.extractedReading}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manual validation */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Validation manuelle</div>
                  <p className="text-xs text-gray-500">
                    Si les données extraites sont correctes, validez manuellement pour confirmer le test.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">N° compteur (attendu)</Label>
                      <Input
                        value={manualValidation.serial}
                        onChange={(e) => setManualValidation(v => ({ ...v, serial: e.target.value }))}
                        placeholder="Optionnel"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Index (attendu)</Label>
                      <Input
                        value={manualValidation.reading}
                        onChange={(e) => setManualValidation(v => ({ ...v, reading: e.target.value }))}
                        placeholder="Optionnel"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={validateManually}
                    className="w-full gap-2"
                    variant="outline"
                  >
                    <Check className="h-4 w-4" />
                    Valider manuellement (100%)
                  </Button>
                </div>
              </div>
            )}

            {!testResult && !testPhotoUrl && (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Uploadez une photo pour tester la reconnaissance
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Test history */}
      {testHistory.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Historique des tests ({testHistory.length})</h3>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {testHistory.map((test, index) => (
              <div
                key={test.id}
                className={`flex items-center justify-between p-3 rounded-lg ${test.success ? 'bg-green-50' : 'bg-red-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-white ${test.success ? 'bg-green-500' : 'bg-red-500'}`}>
                    {test.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      Test #{testHistory.length - index}
                    </div>
                    <div className="text-xs text-gray-500">
                      {test.testedAt.toLocaleString('fr-FR', { 
                        day: '2-digit', 
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={test.validationType === 'auto' ? 'default' : 'outline'}>
                    {test.validationType === 'auto' ? 'Auto' : 'Manuel'}
                  </Badge>
                  <Badge variant="outline">
                    {Math.round(test.confidence * 100)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export default ModelTester
