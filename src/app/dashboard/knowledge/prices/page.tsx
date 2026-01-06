'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  DollarSign, 
  RefreshCw, 
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  Plus,
  Filter
} from 'lucide-react';

interface UnitPriceSource {
  id: string;
  name: string;
  organization: string;
  region_id: string;
  year: number;
  version: string;
  is_official: boolean;
  preambule: string;
}

interface UnitPrice {
  id: string;
  source_id: string;
  reference_code: string;
  category_id: string;
  subcategory: string;
  item_name: string;
  unit_id: string;
  price_low: number;
  price_high: number;
  price_median: number;
  revision_year: number;
  remarks: string;
  keywords: string[];
}

interface HourlyRate {
  id: string;
  trade: string;
  rate_low: number;
  rate_high: number;
  minimum_hours: number;
  travel_fee_low: number;
  travel_fee_high: number;
  minimum_intervention_low: number;
  minimum_intervention_high: number;
}

interface MeasurementUnit {
  id: string;
  name: string;
  symbol: string;
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

export default function PricesPage() {
  const [sources, setSources] = useState<UnitPriceSource[]>([]);
  const [prices, setPrices] = useState<UnitPrice[]>([]);
  const [hourlyRates, setHourlyRates] = useState<HourlyRate[]>([]);
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['painting', 'plumbing', 'locksmith']));
  const [showHourlyRates, setShowHourlyRates] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    
    const { data: sourcesData } = await supabase
      .from('unit_price_sources')
      .select('*')
      .eq('is_active', true);
    if (sourcesData) setSources(sourcesData as UnitPriceSource[]);
    
    const { data: pricesData } = await supabase
      .from('unit_prices')
      .select('*')
      .eq('is_active', true)
      .order('category_id, sort_order');
    if (pricesData) setPrices(pricesData as UnitPrice[]);
    
    const { data: ratesData } = await supabase
      .from('hourly_rates')
      .select('*')
      .eq('is_active', true);
    if (ratesData) setHourlyRates(ratesData as HourlyRate[]);
    
    const { data: unitsData } = await supabase
      .from('measurement_units')
      .select('*');
    if (unitsData) setUnits(unitsData as MeasurementUnit[]);
    
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

  const filteredPrices = prices.filter(price => {
    if (filterCategory !== 'all' && price.category_id !== filterCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        price.item_name.toLowerCase().includes(query) ||
        price.subcategory?.toLowerCase().includes(query) ||
        price.keywords?.some(k => k.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const pricesByCategory = filteredPrices.reduce((acc, price) => {
    const catId = price.category_id || 'uncategorized';
    if (!acc[catId]) acc[catId] = [];
    acc[catId].push(price);
    return acc;
  }, {} as Record<string, UnitPrice[]>);

  const getUnitSymbol = (unitId: string) => {
    return units.find(u => u.id === unitId)?.symbol || unitId;
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

  const formatPrice = (low: number, high: number) => {
    if (low === high) return `${low}€`;
    return `${low} - ${high}€`;
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
          <h1 className="text-2xl font-bold text-gray-900">Prix Unitaires</h1>
          <p className="text-sm text-gray-500 mt-1">
            {prices.length} prix • {hourlyRates.length} taux horaires • Source: UGEB 2024
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors">
          <Plus className="w-5 h-5" />
          Ajouter
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{prices.length}</div>
          <div className="text-sm text-gray-500">💰 Prix unitaires</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{hourlyRates.length}</div>
          <div className="text-sm text-gray-500">⏱️ Taux horaires</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{Object.keys(pricesByCategory).length}</div>
          <div className="text-sm text-gray-500">📂 Catégories</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">2024</div>
          <div className="text-sm text-gray-500">📅 Année référence</div>
        </div>
      </div>

      {/* Toggle Hourly Rates / Prices */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowHourlyRates(false)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            !showHourlyRates ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Prix Unitaires
        </button>
        <button
          onClick={() => setShowHourlyRates(true)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            showHourlyRates ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Taux Horaires
        </button>
      </div>

      {/* Hourly Rates Table */}
      {showHourlyRates && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="font-semibold text-gray-900">Taux Horaires par Métier (Bruxelles 2024)</h2>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left py-3 px-4">Métier</th>
                <th className="text-center py-3 px-4">Taux Horaire</th>
                <th className="text-center py-3 px-4">Min. Heures</th>
                <th className="text-center py-3 px-4">Déplacement</th>
                <th className="text-center py-3 px-4">Intervention Min.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hourlyRates.map(rate => (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{rate.trade}</td>
                  <td className="py-3 px-4 text-center text-teal-600 font-medium">
                    {formatPrice(rate.rate_low, rate.rate_high)}/H
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600">
                    {rate.minimum_hours ? `${rate.minimum_hours}H` : '-'}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600">
                    {rate.travel_fee_low ? formatPrice(rate.travel_fee_low, rate.travel_fee_high) : '-'}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600">
                    {rate.minimum_intervention_low 
                      ? formatPrice(rate.minimum_intervention_low, rate.minimum_intervention_high) 
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unit Prices Browser */}
      {!showHourlyRates && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Tarifs par prestation</h2>
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
            {Object.entries(pricesByCategory).map(([categoryId, categoryPrices]) => {
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
                      <span className="text-sm text-gray-500">({categoryPrices.length})</span>
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
                            <th className="text-left py-2 px-2">Prestation</th>
                            <th className="text-left py-2 px-2 w-32">Sous-catégorie</th>
                            <th className="text-center py-2 px-2 w-20">Unité</th>
                            <th className="text-right py-2 px-2 w-32">Prix</th>
                            <th className="text-left py-2 px-2 w-48">Remarques</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {categoryPrices.map(price => (
                            <tr key={price.id} className="hover:bg-white">
                              <td className="py-2 px-2 text-sm text-gray-900">{price.item_name}</td>
                              <td className="py-2 px-2 text-sm text-gray-500">{price.subcategory || '-'}</td>
                              <td className="py-2 px-2 text-sm text-center text-gray-600">
                                {getUnitSymbol(price.unit_id)}
                              </td>
                              <td className="py-2 px-2 text-sm text-right font-medium text-teal-600">
                                {formatPrice(price.price_low, price.price_high)}
                              </td>
                              <td className="py-2 px-2 text-xs text-gray-500 truncate max-w-[200px]">
                                {price.remarks || '-'}
                              </td>
                              <td className="py-2 px-2">
                                <button className="p-1 hover:bg-gray-100 rounded">
                                  <Edit2 className="w-3 h-3 text-gray-400" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
