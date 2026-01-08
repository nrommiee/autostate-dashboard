# CORRECTIONS POUR src/app/dashboard/labs/meters/page.tsx
# =========================================================

## MODIFICATION 1 : Ajouter un state (ligne ~140)
## Cherche cette ligne :
const [selectedModelId, setSelectedModelId] = useState<string | null>(null)

## Ajoute JUSTE APRÈS :
const [selectedModelStats, setSelectedModelStats] = useState<{tests: number, success: number}>({tests: 0, success: 0})


## MODIFICATION 2 : Ajouter useEffect + fonction (ligne ~185)
## Cherche ce bloc :
  useEffect(() => {
    if (testModelId) {
      loadModelExperiments(testModelId)
    }
  }, [testModelId])

## Ajoute JUSTE APRÈS :

  useEffect(() => {
    if (selectedModelId) {
      loadModelStats(selectedModelId)
    }
  }, [selectedModelId])

  async function loadModelStats(modelId: string) {
    const { data } = await supabase
      .from('labs_experiments')
      .select('status')
      .eq('meter_model_id', modelId)
    
    setSelectedModelStats({
      tests: data?.length || 0,
      success: data?.filter(e => e.status === 'validated' || e.status === 'corrected').length || 0
    })
  }


## MODIFICATION 3 : Ajouter fonction helper (n'importe où avant le return)
## Ajoute cette fonction :

  function formatImageConfig(config: ImageConfig | null): string {
    if (!config) return 'Configuration par défaut'
    const parts = []
    parts.push(config.grayscale ? 'N&B' : 'Couleur')
    if (config.contrast !== undefined && config.contrast !== 0) {
      parts.push(`C:${config.contrast > 0 ? '+' : ''}${config.contrast}%`)
    }
    if (config.sharpness !== undefined && config.sharpness !== 0) {
      parts.push(`N:${config.sharpness}%`)
    }
    return parts.join(' • ')
  }


## MODIFICATION 4 : Remplacer les stats dans le modal (ligne ~1130)
## Cherche ce bloc EXACT :
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-lg font-bold">{selectedModel.total_scans || 0}</p>
                            <p className="text-xs text-gray-500">Tests</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-lg font-bold text-green-600">{selectedModel.success_count || 0}</p>
                            <p className="text-xs text-gray-500">Réussis</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-lg font-bold text-purple-600">
                              {selectedModel.total_scans ? ((selectedModel.success_count || 0) / selectedModel.total_scans * 100).toFixed(0) : 0}%
                            </p>
                            <p className="text-xs text-gray-500">Succès</p>
                          </div>
                        </div>

## REMPLACE PAR :
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-lg font-bold">{selectedModelStats.tests}</p>
                            <p className="text-xs text-gray-500">Tests</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-lg font-bold text-green-600">{selectedModelStats.success}</p>
                            <p className="text-xs text-gray-500">Réussis</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded">
                            <p className="text-lg font-bold text-purple-600">
                              {selectedModelStats.tests > 0 ? Math.round((selectedModelStats.success / selectedModelStats.tests) * 100) : 0}%
                            </p>
                            <p className="text-xs text-gray-500">Succès</p>
                          </div>
                        </div>


## MODIFICATION 5 : Remplacer l'affichage config (ligne ~1160)
## Cherche ce bloc :
                        {selectedModel.image_config_overrides ? (
                          <p className="font-mono text-sm">
                            {selectedModel.image_config_overrides.grayscale ? 'N&B' : 'Couleur'} • 
                            C:{selectedModel.image_config_overrides.contrast > 0 ? '+' : ''}{selectedModel.image_config_overrides.contrast}% • 
                            N:{selectedModel.image_config_overrides.sharpness}%
                          </p>
                        ) : (
                          <p className="text-gray-500 text-sm">Configuration par défaut</p>
                        )}

## REMPLACE PAR :
                        <p className="font-mono text-sm">
                          {formatImageConfig(selectedModel.image_config_overrides)}
                        </p>


# FIN DES MODIFICATIONS
# =====================
# Après ces 5 modifications, commit et push.
# Le popup affichera les vraies stats depuis labs_experiments !
