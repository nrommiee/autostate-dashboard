'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import {
  MeterType,
  MeterSubType,
  DisplayType,
  FieldType,
  PhotoAngle,
  LightingCondition,
  METER_TYPE_LABELS,
  METER_TYPE_ICONS,
  SUB_TYPE_LABELS,
  FIELD_TYPE_LABELS,
  PHOTO_ANGLE_LABELS,
  LIGHTING_LABELS,
  ZONE_COLORS,
} from '@/types/meters';

// ============================================================================
// Types locaux
// ============================================================================

interface MeterModelFormData {
  name: string;
  manufacturer: string;
  model_reference: string;
  meter_type: MeterType;
  sub_type: MeterSubType;
  unit: string;
  ai_description: string;
  display_type: DisplayType;
  primary_color: string;
}

interface UploadedPhoto {
  id: string;
  file: File;
  preview: string;
  angle_type: PhotoAngle;
  lighting_condition: LightingCondition;
  is_primary: boolean;
}

interface DrawingZone {
  id: string;
  field_type: FieldType;
  custom_label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  expected_format: string;
  decimal_places: number;
  note: string;
  color: string;
}

type Step = 'info' | 'photos' | 'zones' | 'description';

// ============================================================================
// Composants UI
// ============================================================================

function StepIndicator({ currentStep, steps }: { currentStep: Step; steps: { id: Step; label: string }[] }) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${index <= currentIndex ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
            {index + 1}
          </div>
          <span className={`ml-2 text-sm hidden sm:inline ${index <= currentIndex ? 'text-gray-900' : 'text-gray-400'}`}>
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <div className={`w-8 sm:w-12 h-0.5 mx-2 ${index < currentIndex ? 'bg-teal-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function FormField({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string; }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

// ============================================================================
// Step 1: Informations générales
// ============================================================================

function StepInfo({ formData, setFormData, onNext }: { formData: MeterModelFormData; setFormData: (data: MeterModelFormData) => void; onNext: () => void; }) {
  const canProceed = formData.name.trim() && formData.meter_type;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Informations générales</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Nom commercial" required>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="ex: Landis+Gyr E350" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </FormField>

          <FormField label="Fabricant">
            <input type="text" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} placeholder="ex: Landis+Gyr" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </FormField>

          <FormField label="Modèle technique">
            <input type="text" value={formData.model_reference} onChange={(e) => setFormData({ ...formData, model_reference: e.target.value })} placeholder="ex: ZMD120AR" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </FormField>

          <FormField label="Unité par défaut">
            <input type="text" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} placeholder="ex: kWh" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </FormField>
        </div>

        <div className="mt-6">
          <FormField label="Type d'énergie" required>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              {(Object.entries(METER_TYPE_LABELS) as [MeterType, string][]).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFormData({ ...formData, meter_type: value })}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${formData.meter_type === value ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-xl">{METER_TYPE_ICONS[value]}</span>
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </FormField>
        </div>

        {formData.meter_type === 'electricity' && (
          <div className="mt-6">
            <FormField label="Sous-type">
              <select value={formData.sub_type || ''} onChange={(e) => setFormData({ ...formData, sub_type: (e.target.value || null) as MeterSubType })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                <option value="">Simple (un seul index)</option>
                {Object.entries(SUB_TYPE_LABELS).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
              </select>
            </FormField>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Type d'affichage">
            <select value={formData.display_type || ''} onChange={(e) => setFormData({ ...formData, display_type: (e.target.value || null) as DisplayType })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent">
              <option value="">Non spécifié</option>
              <option value="digital_lcd">Digital LCD</option>
              <option value="mechanical_rolls">Rouleaux mécaniques</option>
              <option value="dials">Cadrans</option>
              <option value="other">Autre</option>
            </select>
          </FormField>

          <FormField label="Couleur dominante">
            <input type="text" value={formData.primary_color} onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })} placeholder="ex: gris, beige, noir" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
          </FormField>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onNext} disabled={!canProceed} className="px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
          Suivant →
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2: Photos de référence
// ============================================================================

function StepPhotos({ photos, setPhotos, onNext, onBack }: { photos: UploadedPhoto[]; setPhotos: (photos: UploadedPhoto[]) => void; onNext: () => void; onBack: () => void; }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos: UploadedPhoto[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      preview: URL.createObjectURL(file),
      angle_type: 'frontal' as PhotoAngle,
      lighting_condition: 'normal' as LightingCondition,
      is_primary: photos.length === 0 && index === 0
    }));
    setPhotos([...photos, ...newPhotos]);
  };

  const updatePhoto = (id: string, updates: Partial<UploadedPhoto>) => {
    setPhotos(photos.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const setPrimaryPhoto = (id: string) => {
    setPhotos(photos.map(p => ({ ...p, is_primary: p.id === id })));
  };

  const removePhoto = (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (photo) URL.revokeObjectURL(photo.preview);
    const remaining = photos.filter(p => p.id !== id);
    if (photo?.is_primary && remaining.length > 0) remaining[0].is_primary = true;
    setPhotos(remaining);
  };

  const anglesCovered = new Set(photos.map(p => p.angle_type)).size;
  const lightingCovered = new Set(photos.map(p => p.lighting_condition)).size;
  const hasPrimary = photos.some(p => p.is_primary);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Photos de référence</h2>
            <p className="text-sm text-gray-500 mt-1">Minimum 5 photos, idéal 8-10 pour un matching optimal</p>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors">
            + Ajouter des photos
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-2">Couverture angles</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 transition-all" style={{ width: `${(anglesCovered / 5) * 100}%` }} />
              </div>
              <span className="text-sm font-medium">{anglesCovered}/5</span>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-sm text-gray-600 mb-2">Couverture éclairage</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 transition-all" style={{ width: `${(lightingCovered / 4) * 100}%` }} />
              </div>
              <span className="text-sm font-medium">{lightingCovered}/4</span>
            </div>
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-teal-400 transition-colors" onClick={() => fileInputRef.current?.click()}>
            <div className="text-4xl mb-4">📷</div>
            <p className="text-gray-600">Glissez des photos ici ou cliquez pour sélectionner</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map(photo => (
              <div key={photo.id} className={`relative rounded-xl border-2 overflow-hidden ${photo.is_primary ? 'border-teal-500 ring-2 ring-teal-200' : 'border-gray-200'}`}>
                <div className="aspect-square relative">
                  <Image src={photo.preview} alt="Photo de référence" fill className="object-cover" />
                  {photo.is_primary && <div className="absolute top-2 left-2 px-2 py-1 bg-teal-500 text-white text-xs rounded-full">★ Principale</div>}
                  <button type="button" onClick={() => removePhoto(photo.id)} className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">×</button>
                </div>
                <div className="p-3 bg-white space-y-2">
                  <select value={photo.angle_type} onChange={(e) => updatePhoto(photo.id, { angle_type: e.target.value as PhotoAngle })} className="w-full text-sm px-2 py-1 border border-gray-200 rounded-xl">
                    {Object.entries(PHOTO_ANGLE_LABELS).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                  </select>
                  <select value={photo.lighting_condition} onChange={(e) => updatePhoto(photo.id, { lighting_condition: e.target.value as LightingCondition })} className="w-full text-sm px-2 py-1 border border-gray-200 rounded-xl">
                    {Object.entries(LIGHTING_LABELS).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                  </select>
                  {!photo.is_primary && <button type="button" onClick={() => setPrimaryPhoto(photo.id)} className="w-full text-xs px-2 py-1 text-teal-600 hover:bg-teal-50 rounded-xl">Définir comme principale</button>}
                </div>
              </div>
            ))}
            <div className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-teal-400 transition-colors" onClick={() => fileInputRef.current?.click()}>
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">+</div>
                <div className="text-sm text-gray-500">Ajouter</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">← Retour</button>
        <button type="button" onClick={onNext} disabled={photos.length < 1 || !hasPrimary} className="px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">Suivant →</button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 3: Zones d'extraction
// ============================================================================

function StepZones({ primaryPhoto, zones, setZones, onNext, onBack, onAISuggest }: { primaryPhoto: UploadedPhoto | undefined; zones: DrawingZone[]; setZones: (zones: DrawingZone[]) => void; onNext: () => void; onBack: () => void; onAISuggest: () => void; }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentZone, setCurrentZone] = useState<Partial<DrawingZone> | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [addingZoneType, setAddingZoneType] = useState<FieldType | null>(null);

  const getRelativePosition = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!addingZoneType) return;
    const pos = getRelativePosition(e);
    setIsDrawing(true);
    setDrawStart(pos);
    setCurrentZone({ x: pos.x, y: pos.y, width: 0, height: 0, field_type: addingZoneType, color: ZONE_COLORS[addingZoneType] });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart || !currentZone) return;
    const pos = getRelativePosition(e);
    setCurrentZone({ ...currentZone, x: Math.min(drawStart.x, pos.x), y: Math.min(drawStart.y, pos.y), width: Math.abs(pos.x - drawStart.x), height: Math.abs(pos.y - drawStart.y) });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentZone && currentZone.width && currentZone.height && currentZone.width > 2 && currentZone.height > 2) {
      const newZone: DrawingZone = { id: `zone-${Date.now()}`, field_type: currentZone.field_type!, custom_label: '', x: currentZone.x!, y: currentZone.y!, width: currentZone.width, height: currentZone.height, expected_format: '', decimal_places: 0, note: '', color: currentZone.color! };
      setZones([...zones, newZone]);
      setSelectedZoneId(newZone.id);
    }
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentZone(null);
    setAddingZoneType(null);
  };

  const updateZone = (id: string, updates: Partial<DrawingZone>) => { setZones(zones.map(z => z.id === id ? { ...z, ...updates } : z)); };
  const removeZone = (id: string) => { setZones(zones.filter(z => z.id !== id)); if (selectedZoneId === id) setSelectedZoneId(null); };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Zones d'extraction</h2>
            <p className="text-sm text-gray-500 mt-1">Dessinez les zones sur la photo principale</p>
          </div>
          <button type="button" onClick={onAISuggest} className="px-4 py-2 border border-teal-500 text-teal-600 rounded-xl hover:bg-teal-50 transition-colors flex items-center gap-2">
            <span>🤖</span><span>Suggestion IA</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Ajouter :</span>
              {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).slice(0, 6).map(([type, label]) => (
                <button key={type} type="button" onClick={() => setAddingZoneType(type)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${addingZoneType === type ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 hover:border-gray-400'}`}
                  style={{ borderColor: addingZoneType === type ? ZONE_COLORS[type] : undefined }}>
                  {label}
                </button>
              ))}
            </div>

            {primaryPhoto ? (
              <div ref={canvasRef} className={`relative rounded-xl overflow-hidden border-2 ${addingZoneType ? 'border-teal-400 cursor-crosshair' : 'border-gray-200'}`}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                <Image src={primaryPhoto.preview} alt="Photo principale" width={800} height={600} className="w-full h-auto" draggable={false} />
                {zones.map(zone => (
                  <div key={zone.id} className={`absolute border-2 cursor-pointer ${selectedZoneId === zone.id ? 'ring-2 ring-offset-2' : ''}`}
                    style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, borderColor: zone.color, backgroundColor: `${zone.color}20` }}
                    onClick={(e) => { e.stopPropagation(); setSelectedZoneId(zone.id); }}>
                    <span className="absolute -top-6 left-0 px-2 py-0.5 text-xs text-white rounded" style={{ backgroundColor: zone.color }}>{FIELD_TYPE_LABELS[zone.field_type]}</span>
                  </div>
                ))}
                {currentZone && currentZone.width && currentZone.height && (
                  <div className="absolute border-2 border-dashed" style={{ left: `${currentZone.x}%`, top: `${currentZone.y}%`, width: `${currentZone.width}%`, height: `${currentZone.height}%`, borderColor: currentZone.color, backgroundColor: `${currentZone.color}20` }} />
                )}
                {addingZoneType && <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white text-sm p-3 rounded-xl">Dessinez un rectangle pour "{FIELD_TYPE_LABELS[addingZoneType]}"</div>}
              </div>
            ) : (
              <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center"><p className="text-gray-500">Aucune photo principale</p></div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Zones ({zones.length})</h3>
            {zones.length === 0 ? (
              <p className="text-sm text-gray-500">Cliquez sur un type puis dessinez sur la photo.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {zones.map(zone => (
                  <div key={zone.id} className={`p-3 rounded-xl border-2 cursor-pointer ${selectedZoneId === zone.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`} onClick={() => setSelectedZoneId(zone.id)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                        <span className="font-medium text-sm">{FIELD_TYPE_LABELS[zone.field_type]}</span>
                      </div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }} className="text-red-500 hover:text-red-700 text-sm">🗑️</button>
                    </div>
                    {selectedZoneId === zone.id && (
                      <div className="space-y-2 mt-2 pt-2 border-t border-gray-200">
                        <input type="text" value={zone.expected_format} onChange={(e) => updateZone(zone.id, { expected_format: e.target.value })} placeholder="Format attendu" className="w-full px-2 py-1 text-sm border border-gray-200 rounded-xl" />
                        {zone.field_type.startsWith('reading') && (
                          <input type="number" min="0" max="5" value={zone.decimal_places} onChange={(e) => updateZone(zone.id, { decimal_places: parseInt(e.target.value) || 0 })} placeholder="Décimales" className="w-full px-2 py-1 text-sm border border-gray-200 rounded-xl" />
                        )}
                        <input type="text" value={zone.note} onChange={(e) => updateZone(zone.id, { note: e.target.value })} placeholder="Note..." className="w-full px-2 py-1 text-sm border border-gray-200 rounded-xl" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">← Retour</button>
        <button type="button" onClick={onNext} disabled={zones.length === 0} className="px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">Suivant →</button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 4: Description IA
// ============================================================================

function StepDescription({ formData, setFormData, zones, onBack, onSave, saving }: { formData: MeterModelFormData; setFormData: (data: MeterModelFormData) => void; zones: DrawingZone[]; onBack: () => void; onSave: () => void; saving: boolean; }) {
  const generateDescription = () => {
    const lines: string[] = [];
    lines.push(`Compteur ${METER_TYPE_LABELS[formData.meter_type].toLowerCase()} ${formData.name}.`);
    if (formData.manufacturer) lines.push(`Fabricant: ${formData.manufacturer}.`);
    if (formData.display_type) {
      const dt: Record<string, string> = { digital_lcd: 'Écran LCD digital', mechanical_rolls: 'Rouleaux mécaniques', dials: 'Cadrans', other: 'Affichage spécial' };
      lines.push(`${dt[formData.display_type]}.`);
    }
    if (zones.length > 0) {
      lines.push('', 'Zones de lecture:');
      zones.forEach(z => {
        let d = `- ${FIELD_TYPE_LABELS[z.field_type]}`;
        if (z.expected_format) d += ` (${z.expected_format})`;
        if (z.decimal_places > 0) d += ` avec ${z.decimal_places} décimale${z.decimal_places > 1 ? 's' : ''}`;
        if (z.note) d += `. ${z.note}`;
        lines.push(d);
      });
    }
    setFormData({ ...formData, ai_description: lines.join('\n') });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Description pour l'IA</h2>
            <p className="text-sm text-gray-500 mt-1">Ce texte aide l'IA à mieux extraire les données</p>
          </div>
          <button type="button" onClick={generateDescription} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2">
            <span>🔄</span><span>Régénérer</span>
          </button>
        </div>

        <textarea value={formData.ai_description} onChange={(e) => setFormData({ ...formData, ai_description: e.target.value })} rows={10} placeholder="Description du compteur..." className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono text-sm" />
        <p className="text-xs text-gray-500 mt-2">💡 Décrivez l'emplacement exact des données, caractéristiques visuelles, et pièges potentiels.</p>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="font-medium text-gray-900 mb-4">Récapitulatif</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2"><span className="text-green-500">✓</span>Informations générales</li>
          <li className="flex items-center gap-2"><span className="text-green-500">✓</span>Photos de référence</li>
          <li className="flex items-center gap-2"><span className={zones.length > 0 ? 'text-green-500' : 'text-yellow-500'}>{zones.length > 0 ? '✓' : '⚠'}</span>{zones.length} zone{zones.length > 1 ? 's' : ''}</li>
          <li className="flex items-center gap-2"><span className={formData.ai_description ? 'text-green-500' : 'text-yellow-500'}>{formData.ai_description ? '✓' : '⚠'}</span>Description IA</li>
        </ul>
      </div>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">← Retour</button>
        <button type="button" onClick={onSave} disabled={saving} className="px-6 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:bg-gray-400 transition-colors flex items-center gap-2">
          {saving ? (<><span className="animate-spin">⏳</span><span>Enregistrement...</span></>) : (<><span>💾</span><span>Enregistrer</span></>)}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Page principale
// ============================================================================

export default function CreateMeterPage() {
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<MeterModelFormData>({
    name: '', manufacturer: '', model_reference: '', meter_type: 'electricity', sub_type: null, unit: 'kWh', ai_description: '', display_type: null, primary_color: ''
  });
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [zones, setZones] = useState<DrawingZone[]>([]);

  const steps: { id: Step; label: string }[] = [
    { id: 'info', label: 'Informations' }, { id: 'photos', label: 'Photos' }, { id: 'zones', label: 'Zones' }, { id: 'description', label: 'Description' }
  ];

  const primaryPhoto = photos.find(p => p.is_primary);
  const handleAISuggest = async () => { alert('Fonctionnalité à venir : l\'IA analysera la photo et proposera des zones automatiquement.'); };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const { data: model, error: modelError } = await supabase.from('meter_models').insert({
        name: formData.name, manufacturer: formData.manufacturer || null, model_reference: formData.model_reference || null,
        meter_type: formData.meter_type, sub_type: formData.sub_type, unit: formData.unit, ai_description: formData.ai_description || null,
        display_type: formData.display_type, primary_color: formData.primary_color || null, is_active: true
      }).select().single();

      if (modelError) throw modelError;

      for (const photo of photos) {
        const fileName = `${model.id}/${photo.id}-${photo.file.name}`;
        const { error: uploadError } = await supabase.storage.from('meter-photos').upload(fileName, photo.file);
        if (uploadError) { console.error('Upload error:', uploadError); continue; }

        const { data: urlData } = supabase.storage.from('meter-photos').getPublicUrl(fileName);
        await supabase.from('meter_model_photos').insert({
          model_id: model.id, photo_url: urlData.publicUrl, angle_type: photo.angle_type, lighting_condition: photo.lighting_condition, is_primary: photo.is_primary
        });
      }

      for (let i = 0; i < zones.length; i++) {
        const zone = zones[i];
        await supabase.from('meter_extraction_zones').insert({
          model_id: model.id, field_type: zone.field_type, custom_label: zone.custom_label || null,
          position_x: zone.x, position_y: zone.y, position_width: zone.width, position_height: zone.height,
          expected_format: zone.expected_format || null, decimal_places: zone.decimal_places, note: zone.note || null,
          display_color: zone.color, sort_order: i
        });
      }

      router.push(`/dashboard/meters/${model.id}`);
    } catch (err) {
      console.error('Save error:', err);
      setError('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <Link href="/dashboard/meters" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">← Retour aux modèles</Link>
        <h1 className="text-2xl font-bold text-gray-900">Nouveau modèle de compteur</h1>
      </div>

      <StepIndicator currentStep={currentStep} steps={steps} />

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{error}</div>}

      {currentStep === 'info' && <StepInfo formData={formData} setFormData={setFormData} onNext={() => setCurrentStep('photos')} />}
      {currentStep === 'photos' && <StepPhotos photos={photos} setPhotos={setPhotos} onNext={() => setCurrentStep('zones')} onBack={() => setCurrentStep('info')} />}
      {currentStep === 'zones' && <StepZones primaryPhoto={primaryPhoto} zones={zones} setZones={setZones} onNext={() => setCurrentStep('description')} onBack={() => setCurrentStep('photos')} onAISuggest={handleAISuggest} />}
      {currentStep === 'description' && <StepDescription formData={formData} setFormData={setFormData} zones={zones} onBack={() => setCurrentStep('zones')} onSave={handleSave} saving={saving} />}
    </div>
  );
}
