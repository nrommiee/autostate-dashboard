'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  TrendingDown, 
  RefreshCw, 
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Percent,
  Edit2,
  Plus
} from 'lucide-react';

interface DepreciationGrid {
  id: string;
  region_id: string;
  name: string;
  source: string;
  is_official: boolean;
  notes: string;
}

interface DepreciationItem {
  id: string;
  grid_id: string;
  category_id: string;
  item_name: string;
  lifespan_years: number;
  franchise_years: number;
  residual_value_percent: number;
  annual_depreciation_percent: number;
  keywords: string[];
}

interface KnowledgeCategory {
  id: string;
  name: string;
  icon: string;
}

const REGIONS = [
  { id: 'wallonia', name: 'Wallonie', flag: '🐓' },
  { id: 'brussels', name: 'Bruxelles', flag: '🏛️' },
  { id: 'flanders', name: 'Flandre', flag: '🦁' },
];

export default function DepreciationPage() {
  const [grids, setGrids] = useState<DepreciationGrid[]>([]);
  const [items, setItems] = useState<DepreciationItem[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['heating', 'coatings', 'sanitary']));

  const loadData = useCallback(async () => {
    setLoading(true);
    
    const { data: gridsData } = await supabase
      .from('depreciation_grids')
      .select('*')
      .eq('is_active', true);
    if (gridsData) setGrids(gridsData as DepreciationGrid[]);
    
    const { data: itemsData } = await supabase
      .from('depreciation_items')
      .select('*')
      .eq('is_active', true)
      .order('category_id, sort_order');
    if (itemsData) setItems(itemsData as DepreciationItem[]);
    
    const { data: categoriesData } = await supabase
      .from('knowledge_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (categoriesData) setCategories(categoriesData as KnowledgeCategory[]);
    
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredItems = items.filter(item => {
    const grid = grids.find(g => g.id === item.grid_id);
    if (filterRegion !== 'all' && grid?.region_id !== filterRegion) return false;
    if (filterCategory !== 'all' && item.category_id !== filterCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.item_name.toLowerCase().includes(query) ||
        item.keywords?.some(k => k.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const itemsByCategory = filteredItems.reduce((acc, item) => {
    const catId = item.category_id || 'uncategorized';
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(item);
    return acc;
  }, {} as Record<string, DepreciationItem[]>);

  const getRegionFlag = (regionId: string) => {
    return REGIONS.find(r => r.id === regionId)?.flag || '🇧🇪';
  };

  const getCategoryInfo = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat || { name: categoryId, icon: '📄' };
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
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
          <h1 className="text-2xl font-bold text-gray-900">Grilles de Vétusté</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} éléments • {grids.length} grille(s) active(s)
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors">
          <Plus className="w-5 h-5" />
          Ajouter
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {REGIONS.map(region => {
          const regionGrids = grids.filter(g => g.region_id === region.id);
          const regionItems = items.filter(i => 
            regionGrids.some(g => g.id === i.grid_id)
          );
          return (
            <div key={region.id} className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{regionItems.length}</div>
              <div className="text-sm text-gray-500">{region.flag} {region.name}</div>
            </div>
          );
        })}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{categories.length}</div>
          <div className="text-sm text-gray-500">📂 Catégories</div>
        </div>
      </div>

      {/* Items Browser */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Éléments et durées de vie</h2>
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
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">Toutes catégories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {Object.entries(itemsByCategory).map(([categoryId, categoryItems]) => {
            const cat = getCategoryInfo(categoryId);
            const isExpanded = expandedCategories.has(categoryId);
            
            return (
              <div key={categoryId}>
                <button
                  onClick={() => toggleCategory(categoryId)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat.icon}</span>
                    <span className="font-medium text-gray-900">{cat.name}</span>
                    <span className="text-sm text-gray-500">({categoryItems.length})</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                
                {isExpanded && (
                  <div className="bg-gray-50 px-4 py-2">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="text-left py-2 px-2">Élément</th>
                          <th className="text-center py-2 px-2 w-24">
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="w-3 h-3" />
                              Durée
                            </div>
                          </th>
                          <th className="text-center py-2 px-2 w-24">
                            <div className="flex items-center justify-center gap-1">
                              <Percent className="w-3 h-3" />
                              /An
                            </div>
                          </th>
                          <th className="text-center py-2 px-2 w-20">Région</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {categoryItems.map(item => {
                          const grid = grids.find(g => g.id === item.grid_id);
                          return (
                            <tr key={item.id} className="hover:bg-white">
                              <td className="py-2 px-2 text-sm text-gray-900">{item.item_name}</td>
                              <td className="py-2 px-2 text-sm text-center font-medium text-gray-700">
                                {item.lifespan_years} ans
                              </td>
                              <td className="py-2 px-2 text-sm text-center text-teal-600 font-medium">
                                {item.annual_depreciation_percent?.toFixed(2)}%
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className="text-lg">{getRegionFlag(grid?.region_id || '')}</span>
                              </td>
                              <td className="py-2 px-2">
                                <button className="p-1 hover:bg-gray-100 rounded">
                                  <Edit2 className="w-3 h-3 text-gray-400" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
