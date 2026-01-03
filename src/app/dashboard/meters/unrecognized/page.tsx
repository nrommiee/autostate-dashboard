'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import {
  UnrecognizedMeterWithUser,
  MeterModelWithStats,
  METER_TYPE_LABELS,
  METER_TYPE_ICONS,
} from '@/types/meters';

// ============================================================================
// Composants
// ============================================================================

function UnrecognizedCard({ 
  meter, 
  onCreateModel,
  onLinkToModel,
  onIgnore
}: { 
  meter: UnrecognizedMeterWithUser;
  onCreateModel: () => void;
  onLinkToModel: () => void;
  onIgnore: () => void;
}) {
  const date = new Date(meter.created_at);
  const userData = meter.user_entered_data || {};

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Photo */}
          <div className="w-24 h-24 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
            {meter.photo_url ? (
              <Image src={meter.photo_url} alt="Compteur non reconnu" width={96} height={96} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">📷</div>
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {userData.type ? (
                <>
                  <span className="text-xl">{METER_TYPE_ICONS[userData.type]}</span>
                  <span className="font-medium text-gray-900">{METER_TYPE_LABELS[userData.type]}</span>
                </>
              ) : (
                <span className="text-gray-500 italic">Type non spécifié</span>
              )}
            </div>

            <div className="text-sm text-gray-500 mb-3">
              {date.toLocaleDateString('fr-BE')} à {date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
              {meter.user_email && <span className="ml-2">• {meter.user_email}</span>}
            </div>

            <div className="space-y-1 text-sm">
              {userData.serial_number && (
                <div>
                  <span className="text-gray-500">N° compteur:</span>
                  <span className="ml-2 font-mono">{userData.serial_number}</span>
                </div>
              )}
              {userData.readings && userData.readings.length > 0 && (
                <div>
                  <span className="text-gray-500">Index:</span>
                  <span className="ml-2 font-mono">{userData.readings.join(', ')}</span>
                </div>
              )}
              {userData.ean && (
                <div>
                  <span className="text-gray-500">EAN:</span>
                  <span className="ml-2 font-mono text-xs">{userData.ean}</span>
                </div>
              )}
            </div>

            {meter.ai_confidence !== null && (
              <div className="mt-2 text-xs text-gray-400">
                Confiance IA: {Math.round((meter.ai_confidence || 0) * 100)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 p-3 bg-gray-50 flex gap-2">
        <button onClick={onCreateModel}
          className="flex-1 px-3 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors text-sm font-medium">
          🆕 Créer modèle
        </button>
        <button onClick={onLinkToModel}
          className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors text-sm font-medium">
          🔗 Lier à existant
        </button>
        <button onClick={onIgnore}
          className="px-3 py-2 bg-gray-200 text-gray-600 rounded-xl hover:bg-gray-300 transition-colors text-sm">
          🗑️
        </button>
      </div>
    </div>
  );
}

function LinkToModelModal({
  meter,
  models,
  onLink,
  onClose
}: {
  meter: UnrecognizedMeterWithUser;
  models: MeterModelWithStats[];
  onLink: (modelId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.manufacturer?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Lier à un modèle existant</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-4">
          <input
            type="text"
            placeholder="Rechercher un modèle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 mb-4"
          />

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {filteredModels.map(model => (
              <div
                key={model.id}
                onClick={() => setSelectedModelId(model.id)}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedModelId === model.id 
                    ? 'border-teal-500 bg-teal-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{METER_TYPE_ICONS[model.meter_type]}</span>
                  <div>
                    <div className="font-medium">{model.name}</div>
                    {model.manufacturer && (
                      <div className="text-sm text-gray-500">{model.manufacturer}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredModels.length === 0 && (
              <p className="text-gray-500 text-center py-4">Aucun modèle trouvé</p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 p-4 bg-gray-50 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100">
            Annuler
          </button>
          <button
            onClick={() => selectedModelId && onLink(selectedModelId)}
            disabled={!selectedModelId}
            className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
            Lier la photo
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Page principale
// ============================================================================

export default function UnrecognizedMetersPage() {
  const router = useRouter();

  const [meters, setMeters] = useState<UnrecognizedMeterWithUser[]>([]);
  const [models, setModels] = useState<MeterModelWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingMeter, setLinkingMeter] = useState<UnrecognizedMeterWithUser | null>(null);

  const [statusFilter, setStatusFilter] = useState<'pending' | 'processed' | 'all'>('pending');

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  async function fetchData() {
    try {
      setLoading(true);

      let query = supabase
        .from('unrecognized_meters')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter === 'pending') {
        query = query.eq('status', 'pending');
      } else if (statusFilter === 'processed') {
        query = query.neq('status', 'pending');
      }

      const { data: metersData, error: metersError } = await query;
      if (metersError) throw metersError;

      const transformed: UnrecognizedMeterWithUser[] = (metersData || []).map(m => ({
        ...m,
        user_email: null
      }));
      setMeters(transformed);

      const { data: modelsData } = await supabase
        .from('meter_models_with_stats')
        .select('*')
        .eq('is_active', true)
        .order('name');

      setModels(modelsData || []);

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateModel(meter: UnrecognizedMeterWithUser) {
    const params = new URLSearchParams();
    if (meter.user_entered_data?.type) {
      params.set('type', meter.user_entered_data.type);
    }
    if (meter.photo_url) {
      params.set('photo', meter.photo_url);
    }
    params.set('from_unrecognized', meter.id);
    
    router.push(`/dashboard/meters/create?${params.toString()}`);
  }

  async function handleLinkToModel(meterId: string, modelId: string) {
    try {
      const meter = meters.find(m => m.id === meterId);
      if (!meter) return;

      if (meter.photo_url) {
        await supabase.from('meter_model_photos').insert({
          model_id: modelId,
          photo_url: meter.photo_url,
          angle_type: 'frontal',
          lighting_condition: 'normal',
          is_primary: false
        });
      }

      await supabase
        .from('unrecognized_meters')
        .update({ 
          status: 'linked',
          linked_model_id: modelId,
          processed_at: new Date().toISOString()
        })
        .eq('id', meterId);

      setLinkingMeter(null);
      fetchData();

    } catch (err) {
      console.error('Error linking meter:', err);
    }
  }

  async function handleIgnore(meterId: string) {
    if (!confirm('Ignorer ce compteur ? La photo sera archivée.')) return;

    await supabase
      .from('unrecognized_meters')
      .update({ 
        status: 'ignored',
        processed_at: new Date().toISOString()
      })
      .eq('id', meterId);

    fetchData();
  }

  const pendingCount = meters.filter(m => m.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compteurs Non Reconnus</h1>
        <p className="text-gray-500 mt-1">Photos de compteurs que le système n'a pas pu identifier automatiquement</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
          <div className="text-sm text-orange-700">En attente</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-600">
            {meters.filter(m => m.status === 'new_model').length}
          </div>
          <div className="text-sm text-green-700">Nouveaux modèles créés</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-600">
            {meters.filter(m => m.status === 'linked').length}
          </div>
          <div className="text-sm text-blue-700">Liés à existants</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500"
          >
            <option value="pending">En attente de traitement</option>
            <option value="processed">Déjà traités</option>
            <option value="all">Tous</option>
          </select>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : meters.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-gray-600">Aucun compteur non reconnu</p>
          <p className="text-gray-400 text-sm mt-2">Les photos de compteurs non identifiés apparaîtront ici</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meters.map(meter => (
            <UnrecognizedCard
              key={meter.id}
              meter={meter}
              onCreateModel={() => handleCreateModel(meter)}
              onLinkToModel={() => setLinkingMeter(meter)}
              onIgnore={() => handleIgnore(meter.id)}
            />
          ))}
        </div>
      )}

      {/* Modal de liaison */}
      {linkingMeter && (
        <LinkToModelModal
          meter={linkingMeter}
          models={models}
          onLink={(modelId) => handleLinkToModel(linkingMeter.id, modelId)}
          onClose={() => setLinkingMeter(null)}
        />
      )}
    </div>
  );
}
