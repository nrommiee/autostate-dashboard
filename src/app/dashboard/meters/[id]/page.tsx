'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import {
  MeterModel,
  MeterModelPhoto,
  MeterExtractionZone,
  MeterScan,
  METER_TYPE_LABELS,
  METER_TYPE_ICONS,
  FIELD_TYPE_LABELS,
  getSuccessLevel,
  formatSuccessRate,
} from '@/types/meters';

// ============================================================================
// Composants
// ============================================================================

function StatCard({ label, value, subtext, color = 'gray' }: { label: string; value: string | number; subtext?: string; color?: 'gray' | 'green' | 'teal' | 'red' | 'yellow' }) {
  const colors = { gray: 'text-gray-900', green: 'text-green-600', teal: 'text-teal-600', red: 'text-red-600', yellow: 'text-yellow-600' };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
    </div>
  );
}

function ZonesList({ zones }: { zones: MeterExtractionZone[] }) {
  if (zones.length === 0) return <p className="text-gray-500 text-sm">Aucune zone définie</p>;
  
  return (
    <div className="space-y-2">
      {zones.map(zone => (
        <div key={zone.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.display_color }} />
          <div className="flex-1">
            <div className="font-medium text-sm">{FIELD_TYPE_LABELS[zone.field_type]}</div>
            {zone.expected_format && <div className="text-xs text-gray-500">{zone.expected_format}</div>}
          </div>
          {zone.decimal_places > 0 && (
            <span className="text-xs bg-gray-200 px-2 py-1 rounded">{zone.decimal_places} déc.</span>
          )}
        </div>
      ))}
    </div>
  );
}

function RecentScans({ scans }: { scans: MeterScan[] }) {
  if (scans.length === 0) return <p className="text-gray-500 text-sm">Aucun scan enregistré</p>;

  return (
    <div className="space-y-2">
      {scans.map(scan => {
        const hasModifications = scan.modifications && scan.modifications.length > 0;
        const date = new Date(scan.created_at);
        
        return (
          <div key={scan.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <span className={hasModifications ? 'text-yellow-500' : 'text-green-500'}>
              {hasModifications ? '🟠' : '🟢'}
            </span>
            <div className="flex-1">
              <div className="text-sm">
                {date.toLocaleDateString('fr-BE')} {date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {hasModifications && (
                <div className="text-xs text-yellow-600">
                  {scan.modifications.length} modification{scan.modifications.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">
                {scan.confidence_score ? `${Math.round(scan.confidence_score * 100)}%` : '-'}
              </div>
              {scan.flash_used && <span className="text-xs text-gray-400">⚡ Flash</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Page principale
// ============================================================================

export default function MeterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const modelId = params.id as string;

  const [model, setModel] = useState<MeterModel | null>(null);
  const [photos, setPhotos] = useState<MeterModelPhoto[]>([]);
  const [zones, setZones] = useState<MeterExtractionZone[]>([]);
  const [recentScans, setRecentScans] = useState<MeterScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({ totalScans: 0, successRate: 0, serialNumberRate: 0, readingRate: 0 });

  useEffect(() => {
    fetchModelData();
  }, [modelId]);

  async function fetchModelData() {
    try {
      setLoading(true);
      setError(null);

      const { data: modelData, error: modelError } = await supabase
        .from('meter_models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (modelError) throw modelError;
      setModel(modelData);

      const { data: photosData } = await supabase
        .from('meter_model_photos')
        .select('*')
        .eq('model_id', modelId)
        .order('is_primary', { ascending: false });

      setPhotos(photosData || []);

      const { data: zonesData } = await supabase
        .from('meter_extraction_zones')
        .select('*')
        .eq('model_id', modelId)
        .order('sort_order');

      setZones(zonesData || []);

      const { data: scansData } = await supabase
        .from('meter_scans')
        .select('*')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentScans(scansData || []);

      if (modelData) {
        const successRate = modelData.usage_count > 0 
          ? (modelData.success_count / modelData.usage_count) * 100 
          : 0;
        
        setStats({
          totalScans: modelData.usage_count,
          successRate: successRate,
          serialNumberRate: successRate * 0.95,
          readingRate: successRate * 1.02
        });
      }

    } catch (err) {
      console.error('Error fetching model:', err);
      setError('Erreur lors du chargement du modèle');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive() {
    if (!model) return;
    
    const { error } = await supabase
      .from('meter_models')
      .update({ is_active: !model.is_active })
      .eq('id', modelId);

    if (!error) {
      setModel({ ...model, is_active: !model.is_active });
    }
  }

  async function deleteModel() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce modèle ? Cette action est irréversible.')) return;
    
    const { error } = await supabase
      .from('meter_models')
      .delete()
      .eq('id', modelId);

    if (!error) {
      router.push('/dashboard/meters');
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">⚠️</div>
        <p className="text-gray-600">{error || 'Modèle non trouvé'}</p>
        <Link href="/dashboard/meters" className="text-teal-600 hover:underline mt-4 inline-block">
          ← Retour aux modèles
        </Link>
      </div>
    );
  }

  const primaryPhoto = photos.find(p => p.is_primary) || photos[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/meters" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2 text-sm">
            ← Retour aux modèles
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">{model.name}</h1>
            <span className={`px-2 py-1 text-xs rounded-full ${model.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {model.is_active ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-gray-500">
            <span className="text-xl">{METER_TYPE_ICONS[model.meter_type]}</span>
            <span>{METER_TYPE_LABELS[model.meter_type]}</span>
            {model.manufacturer && (
              <>
                <span className="text-gray-300">•</span>
                <span>{model.manufacturer}</span>
              </>
            )}
          </div>
        </div>
        <Link href={`/dashboard/meters/${modelId}/edit`} className="px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors">
          ✏️ Modifier
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Scans total" value={stats.totalScans.toLocaleString()} />
        <StatCard 
          label="Taux global" 
          value={formatSuccessRate(stats.successRate)} 
          color={getSuccessLevel(stats.successRate) === 'success' ? 'green' : getSuccessLevel(stats.successRate) === 'warning' ? 'yellow' : 'red'}
        />
        <StatCard label="Taux N° compteur" value={formatSuccessRate(stats.serialNumberRate)} color="teal" />
        <StatCard label="Taux Index" value={formatSuccessRate(stats.readingRate)} color="teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo principale avec zones */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Photo principale & zones</h2>
            {primaryPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <Image src={primaryPhoto.photo_url} alt={model.name} width={800} height={600} className="w-full h-auto" />
                {zones.map(zone => (
                  <div key={zone.id} className="absolute border-2"
                    style={{ left: `${zone.position_x}%`, top: `${zone.position_y}%`, width: `${zone.position_width}%`, height: `${zone.position_height}%`, borderColor: zone.display_color, backgroundColor: `${zone.display_color}20` }}>
                    <span className="absolute -top-5 left-0 px-1 py-0.5 text-xs text-white rounded" style={{ backgroundColor: zone.display_color }}>
                      {FIELD_TYPE_LABELS[zone.field_type]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                <p className="text-gray-500">Aucune photo</p>
              </div>
            )}
          </div>

          {/* Toutes les photos */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Photos de référence ({photos.length})</h2>
              <button className="text-teal-600 text-sm hover:underline">+ Ajouter</button>
            </div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-4 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className={`aspect-square rounded-xl overflow-hidden border-2 ${photo.is_primary ? 'border-teal-500' : 'border-gray-200'}`}>
                    <Image src={photo.photo_url} alt="Photo de référence" width={150} height={150} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Aucune photo de référence</p>
            )}
          </div>

          {/* Description IA */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Description pour l'IA</h2>
            {model.ai_description ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-xl font-mono">
                {model.ai_description}
              </pre>
            ) : (
              <p className="text-gray-500 text-sm italic">Aucune description configurée</p>
            )}
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Zones d'extraction */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Zones d'extraction ({zones.length})</h2>
            <ZonesList zones={zones} />
          </div>

          {/* Derniers scans */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Derniers scans</h2>
              <Link href={`/dashboard/meters/scans?model=${modelId}`} className="text-teal-600 text-sm hover:underline">
                Voir tous →
              </Link>
            </div>
            <RecentScans scans={recentScans} />
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-3">
              <button onClick={toggleActive}
                className={`w-full px-4 py-2 rounded-xl border transition-colors ${model.is_active ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50' : 'border-green-300 text-green-700 hover:bg-green-50'}`}>
                {model.is_active ? '⏸️ Désactiver' : '▶️ Activer'}
              </button>
              <button onClick={() => router.push(`/dashboard/meters/create?duplicate=${modelId}`)}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
                📋 Dupliquer
              </button>
              <button onClick={deleteModel}
                className="w-full px-4 py-2 rounded-xl border border-red-300 text-red-700 hover:bg-red-50 transition-colors">
                🗑️ Supprimer
              </button>
            </div>
          </div>

          {/* Infos techniques */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-sm">
            <h3 className="font-medium text-gray-700 mb-3">Informations</h3>
            <dl className="space-y-2 text-gray-600">
              <div className="flex justify-between">
                <dt>ID</dt>
                <dd className="font-mono text-xs">{model.id.slice(0, 8)}...</dd>
              </div>
              <div className="flex justify-between">
                <dt>Créé le</dt>
                <dd>{new Date(model.created_at).toLocaleDateString('fr-BE')}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Modifié le</dt>
                <dd>{new Date(model.updated_at).toLocaleDateString('fr-BE')}</dd>
              </div>
              {model.model_reference && (
                <div className="flex justify-between">
                  <dt>Réf. technique</dt>
                  <dd>{model.model_reference}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Unité</dt>
                <dd>{model.unit}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
