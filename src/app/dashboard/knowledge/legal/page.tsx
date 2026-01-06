'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Scale, 
  RefreshCw, 
  Search,
  Upload,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit2,
  ExternalLink
} from 'lucide-react';

interface LegalDocument {
  id: string;
  title: string;
  document_type: string;
  region_id: string;
  source_file_name: string;
  official_url: string;
  publication_date: string;
  effective_date: string;
  summary: string;
  is_active: boolean;
  created_at: string;
}

interface LegalRule {
  id: string;
  document_id: string;
  category: string;
  element_type: string;
  rule_text: string;
  tenant_responsibility: string;
  landlord_responsibility: string;
  source_reference: string;
  keywords: string[];
}

const REGIONS = [
  { id: 'wallonia', name: 'Wallonie', flag: '🐓' },
  { id: 'brussels', name: 'Bruxelles', flag: '🏛️' },
  { id: 'flanders', name: 'Flandre', flag: '🦁' },
];

const DOC_TYPES = [
  { id: 'repartition', name: 'Répartitions Locatives', icon: '📋' },
  { id: 'loi', name: 'Articles de Loi', icon: '⚖️' },
  { id: 'decret', name: 'Décrets', icon: '📜' },
  { id: 'clause', name: 'Clauses Types', icon: '📝' },
  { id: 'jurisprudence', name: 'Jurisprudence', icon: '🏛️' },
];

export default function LegalPage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [rules, setRules] = useState<LegalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    
    const { data: docsData } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (docsData) setDocuments(docsData as LegalDocument[]);
    
    const { data: rulesData } = await supabase
      .from('legal_rules')
      .select('*')
      .eq('is_active', true)
      .order('category, element_type');
    if (rulesData) setRules(rulesData as LegalRule[]);
    
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDocuments = documents.filter(doc => {
    if (filterRegion !== 'all' && doc.region_id !== filterRegion) return false;
    if (filterType !== 'all' && doc.document_type !== filterType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(query) ||
        doc.summary?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getRegionInfo = (regionId: string) => {
    return REGIONS.find(r => r.id === regionId) || { name: regionId, flag: '🇧🇪' };
  };

  const getDocTypeInfo = (typeId: string) => {
    return DOC_TYPES.find(t => t.id === typeId) || { name: typeId, icon: '📄' };
  };

  const toggleDoc = (docId: string) => {
    const newExpanded = new Set(expandedDocs);
    if (newExpanded.has(docId)) {
      newExpanded.delete(docId);
    } else {
      newExpanded.add(docId);
    }
    setExpandedDocs(newExpanded);
  };

  const getDocRules = (docId: string) => {
    return rules.filter(r => r.document_id === docId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cadre Juridique</h1>
          <p className="text-sm text-gray-500 mt-1">
            {documents.length} document(s) • {rules.length} règle(s) extraite(s)
          </p>
        </div>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors"
        >
          <Upload className="w-5 h-5" />
          Importer un document
        </button>
      </div>

      {/* Stats by Region */}
      <div className="grid grid-cols-4 gap-4">
        {REGIONS.map(region => {
          const regionDocs = documents.filter(d => d.region_id === region.id);
          const regionRules = rules.filter(r => 
            regionDocs.some(d => d.id === r.document_id)
          );
          return (
            <div key={region.id} className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{regionDocs.length}</div>
              <div className="text-sm text-gray-500">{region.flag} {region.name}</div>
              <div className="text-xs text-gray-400 mt-1">{regionRules.length} règles</div>
            </div>
          );
        })}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{DOC_TYPES.length}</div>
          <div className="text-sm text-gray-500">📚 Types de documents</div>
        </div>
      </div>

      {/* Documents Browser */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Documents juridiques</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">Toutes régions</option>
                {REGIONS.map(r => (
                  <option key={r.id} value={r.id}>{r.flag} {r.name}</option>
                ))}
              </select>
              
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">Tous types</option>
                {DOC_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucun document juridique importé</p>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-xl hover:bg-teal-600 text-sm"
            >
              Importer un document
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredDocuments.map(doc => {
              const region = getRegionInfo(doc.region_id);
              const docType = getDocTypeInfo(doc.document_type);
              const docRules = getDocRules(doc.id);
              const isExpanded = expandedDocs.has(doc.id);
              
              return (
                <div key={doc.id}>
                  <button
                    onClick={() => toggleDoc(doc.id)}
                    className="w-full px-4 py-4 flex items-start justify-between hover:bg-gray-50 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-2xl">{docType.icon}</div>
                      <div>
                        <div className="font-medium text-gray-900">{doc.title}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-500">{region.flag} {region.name}</span>
                          <span className="text-sm text-gray-400">•</span>
                          <span className="text-sm text-gray-500">{docRules.length} règles</span>
                          {doc.publication_date && (
                            <>
                              <span className="text-sm text-gray-400">•</span>
                              <span className="text-sm text-gray-500">
                                {new Date(doc.publication_date).toLocaleDateString('fr-BE')}
                              </span>
                            </>
                          )}
                        </div>
                        {doc.summary && (
                          <p className="text-sm text-gray-500 mt-2 line-clamp-2">{doc.summary}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.official_url && (
                        <a 
                          href={doc.official_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>
                  
                  {isExpanded && docRules.length > 0 && (
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Règles extraites</h4>
                      <div className="space-y-3">
                        {docRules.map(rule => (
                          <div key={rule.id} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                                    {rule.category}
                                  </span>
                                  <span className="text-xs text-gray-400">{rule.element_type}</span>
                                </div>
                                <p className="text-sm text-gray-800">{rule.rule_text}</p>
                                {(rule.tenant_responsibility || rule.landlord_responsibility) && (
                                  <div className="flex gap-4 mt-2 text-xs">
                                    {rule.tenant_responsibility && (
                                      <span className="text-orange-600">
                                        🏠 Locataire: {rule.tenant_responsibility}
                                      </span>
                                    )}
                                    {rule.landlord_responsibility && (
                                      <span className="text-blue-600">
                                        🏢 Bailleur: {rule.landlord_responsibility}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {rule.source_reference && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Réf: {rule.source_reference}
                                  </p>
                                )}
                              </div>
                              <button className="p-1 hover:bg-gray-100 rounded">
                                <Edit2 className="w-3 h-3 text-gray-400" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
