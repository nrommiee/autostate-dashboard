'use client'

import { useEffect, useState } from 'react'
import { createAdminClient } from '@/lib/supabase'
import { 
  UnrecognizedMeter, 
  UnrecognizedMeterStatus,
  MeterModel,
  METER_TYPE_CONFIG 
} from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import Image from 'next/image'

export default function UnrecognizedMetersPage() {
  const [meters, setMeters] = useState<UnrecognizedMeter[]>([])
  const [models, setModels] = useState<MeterModel[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<UnrecognizedMeterStatus | 'all'>('pending')
  const [selectedMeter, setSelectedMeter] = useState<UnrecognizedMeter | null>(null)
  const [actionDialog, setActionDialog] = useState<'link' | 'ignore' | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const supabase = createAdminClient()
      
      // Load unrecognized meters
      const { data: metersData, error: metersError } = await supabase
        .from('unrecognized_meters')
        .select('*')
        .order('created_at', { ascending: false })

      if (metersError) throw metersError
      setMeters(metersData || [])
      
      // Load meter models for linking
      const { data: modelsData, error: modelsError } = await supabase
        .from('meter_models')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (modelsError) throw modelsError
      setModels(modelsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredMeters = meters.filter(m => 
    statusFilter === 'all' || m.status === statusFilter
  )

  const statusCounts = meters.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  async function handleCreateModel(meter: UnrecognizedMeter) {
    // Navigate to create page with pre-filled data
    const params = new URLSearchParams({
      fromUnrecognized: meter.id,
      photo: meter.photo_url,
      type: meter.ai_detected_type || meter.user_data?.type || '',
      serialNumber: meter.user_data?.serialNumber || '',
    })
    window.location.href = `/dashboard/meters/create?${params.toString()}`
  }

  async function handleLinkToModel(meter: UnrecognizedMeter, modelId: string) {
    try {
      const supabase = createAdminClient()
      await supabase
        .from('unrecognized_meters')
        .update({
          status: 'linked',
          linked_model_id: modelId,
          processed_at: new Date().toISOString()
        })
        .eq('id', meter.id)
      
      loadData()
      setActionDialog(null)
      setSelectedMeter(null)
    } catch (error) {
      console.error('Error linking meter:', error)
    }
  }

  async function handleIgnore(meter: UnrecognizedMeter, notes: string) {
    try {
      const supabase = createAdminClient()
      await supabase
        .from('unrecognized_meters')
        .update({
          status: 'ignored',
          admin_notes: notes,
          processed_at: new Date().toISOString()
        })
        .eq('id', meter.id)
      
      loadData()
      setActionDialog(null)
      setSelectedMeter(null)
    } catch (error) {
      console.error('Error ignoring meter:', error)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compteurs non reconnus</h1>
          <p className="text-gray-500">
            {statusCounts.pending || 0} en attente de traitement
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">
            En attente
            {statusCounts.pending > 0 && (
              <Badge className="ml-2 bg-orange-100 text-orange-700">
                {statusCounts.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="processed">Traités</TabsTrigger>
          <TabsTrigger value="linked">Liés</TabsTrigger>
          <TabsTrigger value="ignored">Ignorés</TabsTrigger>
          <TabsTrigger value="all">Tous</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Info banner for pending */}
      {statusFilter === 'pending' && statusCounts.pending > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <div className="font-medium text-blue-900">
                Ces compteurs n'ont pas été reconnus par l'IA
              </div>
              <div className="text-sm text-blue-700">
                Les données encodées par l'utilisateur (quand disponibles) constituent 
                la "vérité terrain" précieuse pour créer de nouveaux modèles.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : filteredMeters.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-4">✅</div>
          <div className="font-medium text-lg">Aucun compteur en attente</div>
          <p className="text-gray-500">
            Tous les compteurs non reconnus ont été traités
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMeters.map((meter) => (
            <UnrecognizedMeterCard
              key={meter.id}
              meter={meter}
              onCreateModel={() => handleCreateModel(meter)}
              onLink={() => {
                setSelectedMeter(meter)
                setActionDialog('link')
              }}
              onIgnore={() => {
                setSelectedMeter(meter)
                setActionDialog('ignore')
              }}
            />
          ))}
        </div>
      )}

      {/* Link dialog */}
      <LinkDialog
        open={actionDialog === 'link'}
        meter={selectedMeter}
        models={models}
        onLink={(modelId) => selectedMeter && handleLinkToModel(selectedMeter, modelId)}
        onClose={() => {
          setActionDialog(null)
          setSelectedMeter(null)
        }}
      />

      {/* Ignore dialog */}
      <IgnoreDialog
        open={actionDialog === 'ignore'}
        meter={selectedMeter}
        onIgnore={(notes) => selectedMeter && handleIgnore(selectedMeter, notes)}
        onClose={() => {
          setActionDialog(null)
          setSelectedMeter(null)
        }}
      />
    </div>
  )
}

// Card component
function UnrecognizedMeterCard({
  meter,
  onCreateModel,
  onLink,
  onIgnore
}: {
  meter: UnrecognizedMeter
  onCreateModel: () => void
  onLink: () => void
  onIgnore: () => void
}) {
  const typeConfig = meter.ai_detected_type 
    ? METER_TYPE_CONFIG[meter.ai_detected_type as keyof typeof METER_TYPE_CONFIG]
    : null

  const isPending = meter.status === 'pending'

  return (
    <Card className={`overflow-hidden ${!isPending ? 'opacity-75' : ''}`}>
      {/* Photo */}
      <div className="relative h-48 bg-gray-100">
        {meter.photo_url ? (
          <img
            src={meter.photo_url}
            alt="Compteur"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            📷 Photo non disponible
          </div>
        )}
        
        {/* AI confidence badge */}
        <Badge 
          className={`absolute top-2 right-2 ${
            meter.ai_confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
            meter.ai_confidence >= 0.3 ? 'bg-orange-100 text-orange-800' :
            'bg-red-100 text-red-800'
          }`}
        >
          IA: {Math.round(meter.ai_confidence * 100)}%
        </Badge>

        {/* Status badge */}
        {!isPending && (
          <Badge 
            className={`absolute top-2 left-2 ${
              meter.status === 'processed' ? 'bg-green-100 text-green-800' :
              meter.status === 'linked' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}
          >
            {meter.status === 'processed' ? '✓ Traité' :
             meter.status === 'linked' ? '🔗 Lié' :
             '⊘ Ignoré'}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* AI detection */}
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeConfig?.icon || '❓'}</span>
          <span className="font-medium">
            {typeConfig?.label || 'Type inconnu'}
          </span>
        </div>

        {/* User data (ground truth) */}
        {meter.has_user_data && meter.user_data && (
          <div className="p-2 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xs font-medium text-green-700 mb-1">
              ✓ Données utilisateur (vérité terrain)
            </div>
            <div className="text-sm space-y-1">
              {meter.user_data.serialNumber && (
                <div>N°: <span className="font-mono">{meter.user_data.serialNumber}</span></div>
              )}
              {meter.user_data.readings?.map((r, i) => (
                <div key={i}>Index: <span className="font-mono">{r}</span></div>
              ))}
            </div>
          </div>
        )}

        {/* AI extracted data */}
        {!meter.has_user_data && Object.keys(meter.ai_extracted_data || {}).length > 0 && (
          <div className="p-2 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-xs font-medium text-yellow-700 mb-1">
              ⚠️ Données IA (non vérifiées)
            </div>
            <div className="text-sm text-gray-600">
              {JSON.stringify(meter.ai_extracted_data).slice(0, 100)}...
            </div>
          </div>
        )}

        {/* Meta info */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>
            {new Date(meter.created_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          <div className="flex gap-2">
            {meter.flash_used && <span>⚡ Flash</span>}
            <span>{meter.scan_attempts} tentative{meter.scan_attempts > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              className="flex-1"
              onClick={onCreateModel}
            >
              + Créer modèle
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={onLink}
            >
              🔗 Lier
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={onIgnore}
            >
              ⊘
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

// Link dialog
function LinkDialog({
  open,
  meter,
  models,
  onLink,
  onClose
}: {
  open: boolean
  meter: UnrecognizedMeter | null
  models: MeterModel[]
  onLink: (modelId: string) => void
  onClose: () => void
}) {
  const [selectedModelId, setSelectedModelId] = useState<string>('')

  // Filter models by detected type if available
  const suggestedModels = meter?.ai_detected_type
    ? models.filter(m => m.meter_type === meter.ai_detected_type)
    : models

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lier à un modèle existant</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-600">
            Ce compteur sera lié au modèle sélectionné. Cela aide à améliorer 
            la reconnaissance pour les prochains scans similaires.
          </p>
          
          <Select value={selectedModelId} onValueChange={setSelectedModelId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un modèle" />
            </SelectTrigger>
            <SelectContent>
              {suggestedModels.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs text-gray-500">Suggestions</div>
                  {suggestedModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {METER_TYPE_CONFIG[model.meter_type]?.icon} {model.name}
                    </SelectItem>
                  ))}
                  {suggestedModels.length < models.length && (
                    <div className="px-2 py-1 text-xs text-gray-500 border-t mt-1 pt-1">
                      Autres
                    </div>
                  )}
                </>
              )}
              {models.filter(m => !suggestedModels.includes(m)).map(model => (
                <SelectItem key={model.id} value={model.id}>
                  {METER_TYPE_CONFIG[model.meter_type]?.icon} {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button 
            onClick={() => onLink(selectedModelId)}
            disabled={!selectedModelId}
          >
            Lier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Ignore dialog
function IgnoreDialog({
  open,
  meter,
  onIgnore,
  onClose
}: {
  open: boolean
  meter: UnrecognizedMeter | null
  onIgnore: (notes: string) => void
  onClose: () => void
}) {
  const [notes, setNotes] = useState('')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ignorer ce compteur</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-600">
            Ce compteur sera marqué comme ignoré. Utilisez cette option pour les 
            photos inexploitables ou non pertinentes.
          </p>
          
          <Textarea
            placeholder="Raison (optionnel)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button 
            variant="destructive"
            onClick={() => onIgnore(notes)}
          >
            Ignorer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
