'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Plus, Upload, Trash2, Edit, FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface EnergyFormTemplate {
  id: string;
  provider_code: string;
  provider_name: string;
  energy_type: string;
  form_type: string;
  form_name: string;
  region: string | null;
  pdf_storage_path: string;
  field_mapping: Record<string, string>;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function EnergyFormsPage() {
  const [templates, setTemplates] = useState<EnergyFormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('energy_form_templates')
      .select('*')
      .order('provider_name', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
    } else {
      setTemplates(data || []);
    }
    setIsLoading(false);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return;

    const { error } = await supabase
      .from('energy_form_templates')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Erreur: ' + error.message);
    } else {
      fetchTemplates();
    }
  };

  const toggleActive = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('energy_form_templates')
      .update({ is_active: !currentState, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      alert('Erreur: ' + error.message);
    } else {
      fetchTemplates();
    }
  };

  const energyTypeLabel = (type: string) => {
    switch (type) {
      case 'water': return '💧 Eau';
      case 'electricity': return '⚡ Électricité';
      case 'gas': return '🔥 Gaz';
      default: return type;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Formulaires Énergie</h1>
          <p className="text-gray-500">Gérez les templates PDF des fournisseurs d'énergie</p>
        </div>
        <Link
          href="/dashboard/energy-forms/new"
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition"
        >
          <Plus size={20} />
          Nouveau template
        </Link>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Aucun template</h3>
          <p className="text-gray-500 mb-4">Commencez par ajouter un template de formulaire</p>
          <Link
            href="/dashboard/energy-forms/new"
            className="inline-flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700"
          >
            <Plus size={20} />
            Ajouter un template
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                    template.energy_type === 'water' ? 'bg-blue-100' :
                    template.energy_type === 'electricity' ? 'bg-yellow-100' :
                    'bg-orange-100'
                  }`}>
                    {template.energy_type === 'water' ? '💧' :
                     template.energy_type === 'electricity' ? '⚡' : '🔥'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{template.provider_name}</h3>
                    <p className="text-gray-500 text-sm">{template.form_name}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {energyTypeLabel(template.energy_type)}
                      </span>
                      {template.region && (
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {template.region}
                        </span>
                      )}
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        v{template.version}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        template.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {template.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 mr-4">
                    {Object.keys(template.field_mapping || {}).length} champs mappés
                  </span>
                  <button
                    onClick={() => toggleActive(template.id, template.is_active)}
                    className={`px-3 py-1 rounded text-sm ${
                      template.is_active
                        ? 'bg-gray-100 hover:bg-gray-200'
                        : 'bg-green-100 hover:bg-green-200 text-green-700'
                    }`}
                  >
                    {template.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <Link
                    href={`/dashboard/energy-forms/${template.id}`}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <Edit size={18} />
                  </Link>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="p-2 hover:bg-red-100 rounded text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                  <Link
                    href={`/dashboard/energy-forms/${template.id}`}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
