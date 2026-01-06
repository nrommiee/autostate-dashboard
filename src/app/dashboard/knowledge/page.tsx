'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  FileText, 
  Upload, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Eye
} from 'lucide-react';

// Types
interface LegalDocument {
  id: string;
  region: 'wallonia' | 'brussels' | 'flanders';
  title: string;
  official_title?: string;
  source: string;
  publication_date?: string;
  official_url?: string;
  pdf_storage_path?: string;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  extraction_error?: string;
  rules_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LegalRule {
  id: string;
  document_id: string;
  region: string;
  category: string;
  item: string;
  landlord_responsibility: string;
  tenant_responsibility: string;
  notes?: string;
  keywords: string[];
  late_reporting_impact: boolean;
  sort_order: number;
  is_active: boolean;
}

interface RulesVersion {
  version: number;
  updated_at: string;
}

const REGIONS = [
  { id: 'wallonia', name: 'Wallonie', flag: '🐓' },
  { id: 'brussels', name: 'Bruxelles', flag: '🏛️' },
  { id: 'flanders', name: 'Flandre', flag: '🦁' },
];

const CATEGORIES = [
  { id: 'gardens', name: 'Jardins & Extérieurs', icon: '🌳' },
  { id: 'heating', name: 'Chauffage', icon: '🔥' },
  { id: 'plumbing', name: 'Plomberie', icon: '🚿' },
  { id: 'sanitary', name: 'Sanitaires', icon: '🚽' },
  { id: 'electricity', name: 'Électricité', icon: '⚡' },
  { id: 'woodwork', name: 'Menuiseries', icon: '🚪' },
  { id: 'coatings', name: 'Revêtements', icon: '🎨' },
  { id: 'exteriors', name: 'Extérieurs', icon: '🏠' },
  { id: 'security', name: 'Sécurité', icon: '🔒' },
  { id: 'appliances', name: 'Électroménagers', icon: '🧊' },
  { id: 'elevator', name: 'Ascenseurs', icon: '🛗' },
  { id: 'cleaning', name: 'Nettoyage', icon: '✨' },
  { id: 'misc', name: 'Divers', icon: '📦' },
];

export default function LegalKnowledgePage() {
  // State
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [rules, setRules] = useState<LegalRule[]>([]);
  const [version, setVersion] = useState<RulesVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    region: 'wallonia' as 'wallonia' | 'brussels' | 'flanders',
    title: '',
    source: '',
    official_url: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    
    // Load version
    const { data: versionData } = await supabase
      .rpc('get_legal_version')
      .single();
    if (versionData) setVersion(versionData);
    
    // Load documents
    const { data: docsData } = await supabase
      .from('legal_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (docsData) setDocuments(docsData);
    
    // Load rules
    const { data: rulesData } = await supabase
      .from('legal_repair_rules')
      .select('*')
      .order('region, category, sort_order');
    if (rulesData) setRules(rulesData);
    
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Upload PDF
  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.title || !uploadForm.source) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setUploading(true);
    try {
      // 1. Upload file to storage
      const fileName = `${uploadForm.region}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('legal-docs')
        .upload(fileName, selectedFile);
      if (uploadError) throw uploadError;
      // 2. Create document record
      const { data: doc, error: docError } = await supabase
        .from('legal_documents')
        .insert({
          region: uploadForm.region,
          title: uploadForm.title,
          source: uploadForm.source,
          official_url: uploadForm.official_url || null,
          pdf_storage_path: fileName,
          extraction_status: 'pending',
        })
        .select()
        .single();
      if (docError) throw docError;
      // Reset form
      setShowUploadForm(false);
      setUploadForm({ region: 'wallonia', title: '', source: '', official_url: '' });
      setSelectedFile(null);
      
      // Reload data
      await loadData();
      
      // Auto-start extraction
      if (doc) {
        await handleExtract(doc.id);
      }
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Erreur: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  // Extract PDF
  const handleExtract = async (documentId: string) => {
    setExtracting(documentId);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/extract-legal-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ document_id: documentId }),
        }
      );
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Extraction failed');
      }
      alert(`✅ Extraction réussie: ${result.rules_count} règles extraites`);
      await loadData();
    } catch (error: unknown) {
      console.error('Extraction error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Erreur d'extraction: ${message}`);
      await loadData();
    } finally {
      setExtracting(null);
    }
  };

  // Delete document
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Supprimer ce document et toutes ses règles ?')) return;
    try {
      const doc = documents.find(d => d.id === documentId);
      
      // Delete from storage
      if (doc?.pdf_storage_path) {
        await supabase.storage.from('legal-docs').remove([doc.pdf_storage_path]);
      }
      
      // Delete document (rules will cascade)
      await supabase.from('legal_documents').delete().eq('id', documentId);
      
      await loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Erreur: ${message}`);
    }
  };

  // Filter rules
  const filteredRules = rules.filter(rule => {
    if (filterRegion !== 'all' && rule.region !== filterRegion) return false;
    if (filterCategory !== 'all' && rule.category !== filterCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        rule.item.toLowerCase().includes(query) ||
        rule.landlord_responsibility.toLowerCase().includes(query) ||
        rule.tenant_responsibility.toLowerCase().includes(query) ||
        rule.keywords.some(k => k.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Group rules by category
  const rulesByCategory = filteredRules.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = [];
    acc[rule.category].push(rule);
    return acc;
  }, {} as Record<string, LegalRule[]>);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getRegionFlag = (region: string) => {
    return REGIONS.find(r => r.id === region)?.flag || '🇧🇪';
  };

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId) || { name: categoryId, icon: '📄' };
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
          <h1 className="text-2xl font-bold text-gray-900">Base juridique</h1>
          <p className="text-sm text-gray-500 mt-1">
            Version {version?.version || 1} • Dernière MAJ: {version?.updated_at ? new Date(version.updated_at).toLocaleDateString('fr-BE') : '-'}
          </p>
        </div>
        <button
          onClick={() => setShowUploadForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Ajouter un document
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{documents.length}</div>
          <div className="text-sm text-gray-500">Documents</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{rules.length}</div>
          <div className="text-sm text-gray-500">Règles totales</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">
            {rules.filter(r => r.region === 'wallonia').length}
          </div>
          <div className="text-sm text-gray-500">🐓 Wallonie</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">
            {rules.filter(r => r.region === 'brussels').length}
          </div>
          <div className="text-sm text-gray-500">🏛️ Bruxelles</div>
        </div>
      </div>

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-xl font-bold mb-4">Ajouter un document juridique</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Région *</label>
                <select
                  value={uploadForm.region}
                  onChange={(e) => setUploadForm({ ...uploadForm, region: e.target.value as 'wallonia' | 'brussels' | 'flanders' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {REGIONS.map(r => (
                    <option key={r.id} value={r.id}>{r.flag} {r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="Ex: Répartition des réparations Wallonie 2017"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source *</label>
                <input
                  type="text"
                  value={uploadForm.source}
                  onChange={(e) => setUploadForm({ ...uploadForm, source: e.target.value })}
                  placeholder="Ex: Moniteur Belge, SNPC, ..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL officielle</label>
                <input
                  type="url"
                  value={uploadForm.official_url}
                  onChange={(e) => setUploadForm({ ...uploadForm, official_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fichier PDF *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2 text-teal-600">
                        <FileText className="w-5 h-5" />
                        {selectedFile.name}
                      </div>
                    ) : (
                      <div className="text-gray-500">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        Cliquez pour sélectionner un PDF
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowUploadForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Upload...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Uploader & Extraire
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Documents sources</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {documents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucun document. Ajoutez votre premier PDF juridique.
            </div>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{getRegionFlag(doc.region)}</div>
                  <div>
                    <div className="font-medium text-gray-900">{doc.title}</div>
                    <div className="text-sm text-gray-500">
                      {doc.source} • {doc.rules_count} règles
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusIcon(doc.extraction_status)}
                  
                  {doc.extraction_status === 'failed' && doc.extraction_error && (
                    <div className="text-xs text-red-500 max-w-xs truncate" title={doc.extraction_error}>
                      {doc.extraction_error}
                    </div>
                  )}
                  
                  {(doc.extraction_status === 'pending' || doc.extraction_status === 'failed') && (
                    <button
                      onClick={() => handleExtract(doc.id)}
                      disabled={extracting === doc.id}
                      className="px-3 py-1 text-sm bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 disabled:opacity-50"
                    >
                      {extracting === doc.id ? 'Extraction...' : 'Extraire'}
                    </button>
                  )}
                  
                  <button
                    onClick={() => setSelectedDocument(selectedDocument === doc.id ? null : doc.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="p-2 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rules Browser */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Règles de réparation</h2>
            <div className="flex items-center gap-3">
              {/* Search */}
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
              
              {/* Region filter */}
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
              
              {/* Category filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">Toutes catégories</option>
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {Object.keys(rulesByCategory).length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucune règle trouvée
            </div>
          ) : (
            Object.entries(rulesByCategory).map(([categoryId, categoryRules]) => {
              const category = getCategoryInfo(categoryId);
              const isExpanded = expandedRules.has(categoryId);
              
              return (
                <div key={categoryId}>
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedRules);
                      if (isExpanded) {
                        newExpanded.delete(categoryId);
                      } else {
                        newExpanded.add(categoryId);
                      }
                      setExpandedRules(newExpanded);
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{category.icon}</span>
                      <span className="font-medium text-gray-900">{category.name}</span>
                      <span className="text-sm text-gray-500">({categoryRules.length})</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="bg-gray-50 px-4 py-2 space-y-3">
                      {categoryRules.map(rule => (
                        <div key={rule.id} className="bg-white rounded-xl p-4 border border-gray-200">
                          <div className="flex items-start justify-between mb-2">
                            <div className="font-medium text-gray-900 flex items-center gap-2">
                              {getRegionFlag(rule.region)} {rule.item}
                              {rule.late_reporting_impact && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Délai important
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-xs font-medium text-blue-600 mb-1">Propriétaire</div>
                              <div className="text-gray-700">{rule.landlord_responsibility || '-'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-orange-600 mb-1">Locataire</div>
                              <div className="text-gray-700">{rule.tenant_responsibility || '-'}</div>
                            </div>
                          </div>
                          
                          {rule.notes && (
                            <div className="mt-2 text-xs text-gray-500 italic">
                              💡 {rule.notes}
                            </div>
                          )}
                          
                          {rule.keywords.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {rule.keywords.map((kw, i) => (
                                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
