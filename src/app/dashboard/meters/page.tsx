'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { 
  MeterModelWithStats, 
  MeterType,
  METER_TYPE_LABELS, 
  METER_TYPE_ICONS,
  getSuccessLevel,
  formatSuccessRate
} from '@/types/meters';

// ============================================================================
// Composants UI
// ============================================================================

function SuccessRateBadge({ rate }: { rate: number }) {
  const level = getSuccessLevel(rate);
  const colors = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    danger: 'bg-red-100 text-red-800 border-red-200'
  };
  const dots = { success: '🟢', warning: '🟠', danger: '🔴' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium border ${colors[level]}`}>
      <span>{dots[level]}</span>
      <span>{formatSuccessRate(rate)}</span>
    </span>
  );
}

function MeterTypeIcon({ type }: { type: MeterType }) {
  return (
    <span className="text-lg" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }}>
      {METER_TYPE_ICONS[type]}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
        <span className="text-3xl">📊</span>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun modèle de compteur</h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">
        Commencez par ajouter un modèle de compteur pour améliorer la reconnaissance automatique.
      </p>
      <Link href="/dashboard/meters/create" className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors">
        <span>+</span>
        <span>Nouveau modèle</span>
      </Link>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="animate-pulse space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
            <div className="h-6 w-16 bg-gray-200 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ModelCard({ model }: { model: MeterModelWithStats }) {
  return (
    <Link href={`/dashboard/meters/${model.id}`} className="block bg-white rounded-xl border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all">
      <div className="p-4 flex items-center gap-4">
        {/* Photo miniature */}
        <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {model.primary_photo_url ? (
            <Image src={model.primary_photo_url} alt={model.name} width={64} height={64} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl opacity-50">📷</span>
          )}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{model.name}</h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <MeterTypeIcon type={model.meter_type} />
            <span>{METER_TYPE_LABELS[model.meter_type]}</span>
            {model.manufacturer && (
              <>
                <span className="text-gray-300">•</span>
                <span>{model.manufacturer}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>{model.photo_count} photo{model.photo_count > 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{model.zone_count} zone{model.zone_count > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <SuccessRateBadge rate={model.success_rate} />
          <span className="text-xs text-gray-400">
            {model.usage_count.toLocaleString()} scan{model.usage_count > 1 ? 's' : ''}
          </span>
        </div>

        {/* Chevron */}
        <div className="text-gray-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// Page principale
// ============================================================================

export default function MetersPage() {
  const [models, setModels] = useState<MeterModelWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MeterType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'success_rate' | 'usage_count' | 'created_at'>('success_rate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');


  useEffect(() => {
    fetchModels();
  }, []);

  async function fetchModels() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('meter_models_with_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setModels(data || []);
    } catch (err) {
      console.error('Error fetching models:', err);
      setError('Erreur lors du chargement des modèles');
    } finally {
      setLoading(false);
    }
  }

  // Filtrage et tri
  const filteredModels = models
    .filter(model => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = model.name.toLowerCase().includes(query);
        const matchesManufacturer = model.manufacturer?.toLowerCase().includes(query);
        if (!matchesName && !matchesManufacturer) return false;
      }
      if (typeFilter !== 'all' && model.meter_type !== typeFilter) return false;
      if (statusFilter === 'active' && !model.is_active) return false;
      if (statusFilter === 'inactive' && model.is_active) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'success_rate': comparison = a.success_rate - b.success_rate; break;
        case 'usage_count': comparison = a.usage_count - b.usage_count; break;
        case 'created_at': comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Stats globales
  const totalModels = models.length;
  const activeModels = models.filter(m => m.is_active).length;
  const totalScans = models.reduce((sum, m) => sum + m.usage_count, 0);
  const avgSuccessRate = models.length > 0 ? models.reduce((sum, m) => sum + m.success_rate, 0) / models.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modèles de Compteurs</h1>
          <p className="text-gray-500 mt-1">Gérez les modèles de compteurs pour la reconnaissance automatique</p>
        </div>
        <Link href="/dashboard/meters/create" className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium">
          <span className="text-lg">+</span>
          <span>Nouveau modèle</span>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{totalModels}</div>
          <div className="text-sm text-gray-500">Modèles total</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{activeModels}</div>
          <div className="text-sm text-gray-500">Modèles actifs</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{totalScans.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Scans total</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-teal-600">{formatSuccessRate(avgSuccessRate)}</div>
          <div className="text-sm text-gray-500">Taux moyen</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Recherche */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
          </div>

          {/* Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MeterType | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">Tous les types</option>
            {Object.entries(METER_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{METER_TYPE_ICONS[value as MeterType]} {label}</option>
            ))}
          </select>

          {/* Statut */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>

          {/* Tri */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as typeof sortBy);
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="success_rate-asc">Taux ↑ (problématiques d'abord)</option>
            <option value="success_rate-desc">Taux ↓ (meilleurs d'abord)</option>
            <option value="usage_count-desc">Plus utilisés</option>
            <option value="usage_count-asc">Moins utilisés</option>
            <option value="name-asc">Nom A-Z</option>
            <option value="name-desc">Nom Z-A</option>
            <option value="created_at-desc">Plus récents</option>
            <option value="created_at-asc">Plus anciens</option>
          </select>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>
      ) : filteredModels.length === 0 ? (
        searchQuery || typeFilter !== 'all' || statusFilter !== 'all' ? (
          <div className="text-center py-12 text-gray-500">Aucun modèle ne correspond aux filtres</div>
        ) : (
          <EmptyState />
        )
      ) : (
        <div className="space-y-3">
          {filteredModels.map(model => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}

      {/* Légende */}
      {filteredModels.length > 0 && (
        <div className="text-center text-sm text-gray-400">
          🟢 &gt;90% &nbsp;&nbsp; 🟠 75-90% &nbsp;&nbsp; 🔴 &lt;75%
          <span className="mx-4">|</span>
          {filteredModels.length} modèle{filteredModels.length > 1 ? 's' : ''} affiché{filteredModels.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
