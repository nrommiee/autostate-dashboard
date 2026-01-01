'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Upload, Save, FileText, X, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Shortcodes disponibles dans l'app iOS
const SHORTCODES = [
  { value: '', label: '-- Non mappé --', category: '' },
  // Ancien usager
  { value: 'ancien.nom', label: 'Nom', category: 'Ancien usager' },
  { value: 'ancien.prenom', label: 'Prénom', category: 'Ancien usager' },
  { value: 'ancien.societe', label: 'Société', category: 'Ancien usager' },
  { value: 'ancien.rue', label: 'Rue', category: 'Ancien usager' },
  { value: 'ancien.numero', label: 'Numéro', category: 'Ancien usager' },
  { value: 'ancien.boite', label: 'Boîte', category: 'Ancien usager' },
  { value: 'ancien.cp', label: 'Code postal', category: 'Ancien usager' },
  { value: 'ancien.localite', label: 'Localité', category: 'Ancien usager' },
  { value: 'ancien.tel', label: 'Téléphone', category: 'Ancien usager' },
  { value: 'ancien.email', label: 'Email', category: 'Ancien usager' },
  // Nouvel usager
  { value: 'nouveau.nom', label: 'Nom', category: 'Nouvel usager' },
  { value: 'nouveau.prenom', label: 'Prénom', category: 'Nouvel usager' },
  { value: 'nouveau.societe', label: 'Société', category: 'Nouvel usager' },
  { value: 'nouveau.rue', label: 'Rue', category: 'Nouvel usager' },
  { value: 'nouveau.numero', label: 'Numéro', category: 'Nouvel usager' },
  { value: 'nouveau.boite', label: 'Boîte', category: 'Nouvel usager' },
  { value: 'nouveau.cp', label: 'Code postal', category: 'Nouvel usager' },
  { value: 'nouveau.localite', label: 'Localité', category: 'Nouvel usager' },
  { value: 'nouveau.tel', label: 'Téléphone', category: 'Nouvel usager' },
  { value: 'nouveau.email', label: 'Email', category: 'Nouvel usager' },
  { value: 'nouveau.naissance', label: 'Date de naissance', category: 'Nouvel usager' },
  { value: 'nouveau.iban', label: 'IBAN', category: 'Nouvel usager' },
  // Bien
  { value: 'bien.rue', label: 'Rue', category: 'Bien' },
  { value: 'bien.numero', label: 'Numéro', category: 'Bien' },
  { value: 'bien.boite', label: 'Boîte', category: 'Bien' },
  { value: 'bien.cp', label: 'Code postal', category: 'Bien' },
  { value: 'bien.localite', label: 'Localité', category: 'Bien' },
  // Compteur
  { value: 'compteur.numero', label: 'N° compteur', category: 'Compteur' },
  { value: 'compteur.index', label: 'Index', category: 'Compteur' },
  { value: 'compteur.date', label: 'Date relevé', category: 'Compteur' },
  // Date
  { value: 'date_signature', label: 'Date signature', category: 'Date' },
];

interface PDFField {
  name: string;
  type: string;
}

export default function EnergyFormEditorPage() {
  const router = useRouter();
  const params = useParams();
  const isEditing = params?.id && params.id !== 'new';
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfFields, setPdfFields] = useState<PDFField[]>([]);
  const [extractingFields, setExtractingFields] = useState(false);
  
  // Form state
  const [providerCode, setProviderCode] = useState('');
  const [providerName, setProviderName] = useState('');
  const [energyType, setEnergyType] = useState('water');
  const [formType, setFormType] = useState('changement_usager');
  const [formName, setFormName] = useState('');
  const [region, setRegion] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfStoragePath, setPdfStoragePath] = useState('');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(1);
  const [isActive, setIsActive] = useState(true);

  const supabase = createClientComponentClient();

  // Load existing template if editing
  useEffect(() => {
    if (isEditing) {
      loadTemplate();
    }
  }, [isEditing]);

  const loadTemplate = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('energy_form_templates')
      .select('*')
      .eq('id', params?.id)
      .single();

    if (error) {
      console.error('Error loading template:', error);
      alert('Template non trouvé');
      router.push('/dashboard/energy-forms');
    } else if (data) {
      setProviderCode(data.provider_code);
      setProviderName(data.provider_name);
      setEnergyType(data.energy_type);
      setFormType(data.form_type);
      setFormName(data.form_name);
      setRegion(data.region || '');
      setPdfStoragePath(data.pdf_storage_path);
      setFieldMapping(data.field_mapping || {});
      setVersion(data.version || 1);
      setIsActive(data.is_active);
      
      // Extract fields from existing PDF
      if (data.pdf_storage_path) {
        extractFieldsFromStorage(data.pdf_storage_path);
      }
    }
    setIsLoading(false);
  };

  const extractFieldsFromStorage = async (path: string) => {
    setExtractingFields(true);
    try {
      const { data, error } = await supabase.storage
        .from('energy-forms')
        .download(path);

      if (error) throw error;

      const arrayBuffer = await data.arrayBuffer();
      await extractPDFFields(arrayBuffer);
    } catch (error) {
      console.error('Error extracting fields:', error);
    }
    setExtractingFields(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfFile(file);
    setExtractingFields(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      await extractPDFFields(arrayBuffer);
    } catch (error) {
      console.error('Error reading PDF:', error);
      alert('Erreur lors de la lecture du PDF');
    }
    setExtractingFields(false);
  };

  const extractPDFFields = async (arrayBuffer: ArrayBuffer) => {
    // Use pdf-lib to extract form fields
    const { PDFDocument } = await import('pdf-lib');
    
    try {
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      const extractedFields: PDFField[] = fields.map(field => ({
        name: field.getName(),
        type: field.constructor.name.replace('PDF', '').replace('Field', '')
      }));

      setPdfFields(extractedFields);
      
      // Initialize mapping for new fields
      const newMapping = { ...fieldMapping };
      extractedFields.forEach(field => {
        if (!(field.name in newMapping)) {
          newMapping[field.name] = '';
        }
      });
      setFieldMapping(newMapping);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      alert('Erreur: Ce PDF ne contient pas de champs de formulaire AcroForm');
    }
  };

  const updateFieldMapping = (pdfFieldName: string, shortcode: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [pdfFieldName]: shortcode
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let finalPdfPath = pdfStoragePath;

      // Upload new PDF if selected
      if (pdfFile) {
        const fileName = `${providerCode}/${formType}_v${version}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('energy-forms')
          .upload(fileName, pdfFile, { upsert: true });

        if (uploadError) throw uploadError;
        finalPdfPath = fileName;
      }

      // Clean mapping (remove empty values)
      const cleanMapping: Record<string, string> = {};
      Object.entries(fieldMapping).forEach(([key, value]) => {
        if (value) cleanMapping[key] = value;
      });

      const templateData = {
        provider_code: providerCode,
        provider_name: providerName,
        energy_type: energyType,
        form_type: formType,
        form_name: formName,
        region: region || null,
        pdf_storage_path: finalPdfPath,
        field_mapping: cleanMapping,
        version,
        is_active: isActive,
        updated_at: new Date().toISOString()
      };

      if (isEditing) {
        const { error } = await supabase
          .from('energy_form_templates')
          .update(templateData)
          .eq('id', params?.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('energy_form_templates')
          .insert([templateData]);

        if (error) throw error;
      }

      router.push('/dashboard/energy-forms');
    } catch (error: any) {
      console.error('Error saving template:', error);
      alert('Erreur: ' + error.message);
    }
    setIsSaving(false);
  };

  // Group shortcodes by category
  const groupedShortcodes = SHORTCODES.reduce((acc, sc) => {
    if (!sc.category) return acc;
    if (!acc[sc.category]) acc[sc.category] = [];
    acc[sc.category].push(sc);
    return acc;
  }, {} as Record<string, typeof SHORTCODES>);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/energy-forms" className="p-2 hover:bg-gray-100 rounded">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Modifier le template' : 'Nouveau template'}
          </h1>
          <p className="text-gray-500">Configurez le formulaire et mappez les champs</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Informations générales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Code fournisseur *</label>
              <input
                type="text"
                value={providerCode}
                onChange={(e) => setProviderCode(e.target.value.toLowerCase())}
                placeholder="swde"
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nom fournisseur *</label>
              <input
                type="text"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="SWDE"
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type d'énergie *</label>
              <select
                value={energyType}
                onChange={(e) => setEnergyType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="water">💧 Eau</option>
                <option value="electricity">⚡ Électricité</option>
                <option value="gas">🔥 Gaz</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type de formulaire *</label>
              <input
                type="text"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                placeholder="changement_usager"
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nom du formulaire *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Formulaire de changement d'usager"
                required
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Région</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">Toutes les régions</option>
                <option value="wallonie">Wallonie</option>
                <option value="bruxelles">Bruxelles</option>
                <option value="flandre">Flandre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Version</label>
              <input
                type="number"
                value={version}
                onChange={(e) => setVersion(parseInt(e.target.value) || 1)}
                min={1}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm font-medium">Actif</label>
            </div>
          </div>
        </div>

        {/* PDF Upload */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Fichier PDF</h2>
          
          {pdfStoragePath && !pdfFile && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 rounded-lg">
              <FileText className="text-green-600" size={20} />
              <span className="text-green-700">{pdfStoragePath}</span>
            </div>
          )}

          <label className="block">
            <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition">
              <Upload className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-gray-600">
                {pdfFile ? pdfFile.name : 'Cliquez pour uploader un PDF avec champs AcroForm'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Le PDF doit contenir des champs de formulaire
              </p>
            </div>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Field Mapping */}
        {(pdfFields.length > 0 || Object.keys(fieldMapping).length > 0) && (
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">
              Mapping des champs
              {extractingFields && <Loader2 className="inline ml-2 animate-spin" size={16} />}
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Associez chaque champ du PDF à une donnée de l'application
            </p>

            <div className="space-y-3">
              {(pdfFields.length > 0 ? pdfFields : Object.keys(fieldMapping).map(name => ({ name, type: 'Text' }))).map((field) => (
                <div key={field.name} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <span className="font-mono text-sm">{field.name}</span>
                    <span className="text-xs text-gray-400 ml-2">({field.type})</span>
                  </div>
                  <select
                    value={fieldMapping[field.name] || ''}
                    onChange={(e) => updateFieldMapping(field.name, e.target.value)}
                    className="w-64 border rounded px-3 py-1.5 text-sm"
                  >
                    <option value="">-- Non mappé --</option>
                    {Object.entries(groupedShortcodes).map(([category, codes]) => (
                      <optgroup key={category} label={category}>
                        {codes.map(sc => (
                          <option key={sc.value} value={sc.value}>
                            {sc.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link
            href="/dashboard/energy-forms"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={isSaving || !providerCode || !providerName || !formName || (!pdfStoragePath && !pdfFile)}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {isEditing ? 'Enregistrer' : 'Créer le template'}
          </button>
        </div>
      </form>
    </div>
  );
}
