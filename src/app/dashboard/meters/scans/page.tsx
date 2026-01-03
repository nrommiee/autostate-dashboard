'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import {
  MeterScanWithDetails,
  AdminVerdict,
  METER_TYPE_ICONS,
  VERDICT_LABELS,
  FIELD_TYPE_LABELS,
} from '@/types/meters';

// ============================================================================
// Composants
// ============================================================================

function ScanCard({ 
  scan, 
  onVerdict,
  selected,
  onSelect 
}: { 
  scan: MeterScanWithDetails;
  onVerdict: (verdict: AdminVerdict) => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const date = new Date(scan.created_at);
  const modifications = scan.modifications || [];

  return (
    <div 
      className={`bg-white rounded-xl border-2 overflow-hidden transition-all cursor-pointer ${
        selected ? 'border-teal-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Photo miniature */}
          <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
            {scan.photo_url ? (
              <Image src={scan.photo_url} alt="Scan" width={80} height={80} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">📷</div>
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {scan.model_name ? (
                <>
                  <span className="text-lg">{scan.meter_type ? METER_TYPE_ICONS[scan.meter_type] : '📊'}</span>
                  <span className="font-medium text-gray-900 truncate">{scan.model_name}</span>
                </>
              ) : (
                <span className="text-gray-500 italic">Modèle inconnu</span>
              )}
            </div>
            
            <div className="text-sm text-gray-500 mb-2">
              {date.toLocaleDateString('fr-BE')} à {date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
              {scan.user_email && <span className="ml-2">• {scan.user_email}</span>}
            </div>

            {/* Modifications */}
            <div className="space-y-1">
              {modifications.map((mod, idx) => (
                <div key={idx} className="text-sm">
                  <span className="text-gray-600">{FIELD_TYPE_LABELS[mod.field] || mod.field}:</span>
                  <span className="ml-2 text-red-500 line-through">{mod.original}</span>
                  <span className="mx-1">→</span>
                  <span className="text-green-600 font-medium">{mod.final}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Statut */}
          <div className="flex-shrink-0">
            {scan.admin_verdict ? (
              <span className={`px-3 py-1 text-xs rounded-full ${
                scan.admin_verdict === 'operator_right' ? 'bg-yellow-100 text-yellow-800' :
                scan.admin_verdict === 'system_right' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {VERDICT_LABELS[scan.admin_verdict]}
              </span>
            ) : (
              <span className="px-3 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
                En attente
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions de verdict (si sélectionné et pas encore jugé) */}
      {selected && !scan.admin_verdict && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <p className="text-sm text-gray-600 mb-3">Quel est votre verdict ?</p>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onVerdict('operator_right'); }}
              className="flex-1 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-xl hover:bg-yellow-200 transition-colors text-sm font-medium"
            >
              👤 Opérateur a raison
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onVerdict('system_right'); }}
              className="flex-1 px-3 py-2 bg-green-100 text-green-800 rounded-xl hover:bg-green-200 transition-colors text-sm font-medium"
            >
              🤖 Système OK
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onVerdict('indeterminate'); }}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm"
            >
              ❓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScanDetailModal({ 
  scan, 
  onClose,
  onVerdict 
}: { 
  scan: MeterScanWithDetails;
  onClose: () => void;
  onVerdict: (verdict: AdminVerdict) => void;
}) {
  const modifications = scan.modifications || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Examiner le scan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Photo */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Photo du scan</h3>
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
              {scan.photo_url ? (
                <Image src={scan.photo_url} alt="Scan compteur" width={600} height={400} className="w-full h-auto" />
              ) : (
                <div className="aspect-video flex items-center justify-center text-gray-400">Pas de photo</div>
              )}
            </div>
          </div>

          {/* Détails */}
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Informations</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Modèle</dt>
                  <dd className="font-medium">{scan.model_name || 'Inconnu'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Date</dt>
                  <dd>{new Date(scan.created_at).toLocaleString('fr-BE')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Utilisateur</dt>
                  <dd>{scan.user_email || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Confiance IA</dt>
                  <dd>{scan.confidence_score ? `${Math.round(scan.confidence_score * 100)}%` : '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Flash</dt>
                  <dd>{scan.flash_used ? 'Oui ⚡' : 'Non'}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-3">Modifications ({modifications.length})</h3>
              {modifications.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucune modification</p>
              ) : (
                <div className="space-y-3">
                  {modifications.map((mod, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-xl">
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        {FIELD_TYPE_LABELS[mod.field] || mod.field}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">🤖 Valeur IA</div>
                          <div className="font-mono bg-red-50 text-red-700 px-2 py-1 rounded">{mod.original}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">👤 Valeur corrigée</div>
                          <div className="font-mono bg-green-50 text-green-700 px-2 py-1 rounded">{mod.final}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!scan.admin_verdict && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <p className="text-sm text-gray-600 mb-3 text-center">Quel est votre verdict ?</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => onVerdict('operator_right')}
                className="px-6 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-colors font-medium">
                👤 Opérateur a raison
                <div className="text-xs opacity-80">Erreur système → score ↓</div>
              </button>
              <button onClick={() => onVerdict('system_right')}
                className="px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-medium">
                🤖 Système avait raison
                <div className="text-xs opacity-80">Erreur utilisateur</div>
              </button>
              <button onClick={() => onVerdict('indeterminate')}
                className="px-6 py-3 bg-gray-400 text-white rounded-xl hover:bg-gray-500 transition-colors">
                ❓ Indéterminé
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Page principale
// ============================================================================

export default function ScansPage() {
  const searchParams = useSearchParams();
  const modelFilter = searchParams.get('model');
  
  
  const [scans, setScans] = useState<MeterScanWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [modalScan, setModalScan] = useState<MeterScanWithDetails | null>(null);

  const [statusFilter, setStatusFilter] = useState<'pending' | 'reviewed' | 'all'>('pending');
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => {
    fetchScans();
  }, [statusFilter, dateFilter, modelFilter]);

  async function fetchScans() {
    try {
      setLoading(true);

      let query = supabase
        .from('meter_scans')
        .select(`*, meter_models!left(name, meter_type)`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter === 'pending') {
        query = query.is('admin_verdict', null);
      } else if (statusFilter === 'reviewed') {
        query = query.not('admin_verdict', 'is', null);
      }

      if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('created_at', weekAgo.toISOString());
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte('created_at', monthAgo.toISOString());
      }

      if (modelFilter) {
        query = query.eq('model_id', modelFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const transformed: MeterScanWithDetails[] = (data || []).map(scan => ({
        ...scan,
        model_name: scan.meter_models?.name || null,
        meter_type: scan.meter_models?.meter_type || null,
        user_email: null
      }));

      setScans(transformed);
    } catch (err) {
      console.error('Error fetching scans:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerdict(scanId: string, verdict: AdminVerdict) {
    const { error } = await supabase
      .from('meter_scans')
      .update({ admin_verdict: verdict, admin_reviewed_at: new Date().toISOString() })
      .eq('id', scanId);

    if (!error) {
      setScans(scans.map(s => 
        s.id === scanId ? { ...s, admin_verdict: verdict, admin_reviewed_at: new Date().toISOString() } : s
      ));
      if (modalScan?.id === scanId) setModalScan(null);
    }
  }

  const pendingCount = scans.filter(s => !s.admin_verdict).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scans à Examiner</h1>
        <p className="text-gray-500 mt-1">Examinez les scans où l'utilisateur a modifié les données extraites</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
          <div className="text-sm text-orange-700">En attente</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-600">
            {scans.filter(s => s.admin_verdict === 'system_right').length}
          </div>
          <div className="text-sm text-green-700">Système OK</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {scans.filter(s => s.admin_verdict === 'operator_right').length}
          </div>
          <div className="text-sm text-yellow-700">Erreurs système</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500">
            <option value="pending">En attente d'examen</option>
            <option value="reviewed">Déjà examinés</option>
            <option value="all">Tous les scans</option>
          </select>

          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
            className="px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500">
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="all">Tout l'historique</option>
          </select>

          {modelFilter && (
            <Link href="/dashboard/meters/scans" className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm">
              × Retirer filtre modèle
            </Link>
          )}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : scans.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-gray-600">Aucun scan à examiner</p>
          <p className="text-gray-400 text-sm mt-2">Les scans avec modifications apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scans.map(scan => (
            <ScanCard
              key={scan.id}
              scan={scan}
              selected={selectedScanId === scan.id}
              onSelect={() => setSelectedScanId(selectedScanId === scan.id ? null : scan.id)}
              onVerdict={(verdict) => handleVerdict(scan.id, verdict)}
            />
          ))}
        </div>
      )}

      {/* Modal détail */}
      {modalScan && (
        <ScanDetailModal
          scan={modalScan}
          onClose={() => setModalScan(null)}
          onVerdict={(verdict) => handleVerdict(modalScan.id, verdict)}
        />
      )}
    </div>
  );
}
