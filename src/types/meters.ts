// ============================================================================
// Types pour le système de scan compteur
// ============================================================================

// Types d'énergie
export type MeterType = 
  | 'electricity' 
  | 'gas' 
  | 'water_general' 
  | 'water_passage' 
  | 'oil_tank' 
  | 'calorimeter' 
  | 'other';

// Sous-types (principalement pour électricité)
export type MeterSubType = 
  | 'simple' 
  | 'bi_hourly' 
  | 'exclusive_night' 
  | 'production' 
  | 'tri_hourly' 
  | 'injection'
  | null;

// Type d'affichage du compteur
export type DisplayType = 
  | 'digital_lcd' 
  | 'mechanical_rolls' 
  | 'dials' 
  | 'other'
  | null;

// Types de champs extractibles
export type FieldType =
  | 'serial_number'
  | 'ean'
  | 'reading_single'
  | 'reading_day'
  | 'reading_night'
  | 'reading_exclusive_night'
  | 'reading_production'
  | 'reading_injection'
  | 'subscribed_power'
  | 'other';

// Angle de prise de vue
export type PhotoAngle = 
  | 'frontal' 
  | 'below' 
  | 'above' 
  | 'left' 
  | 'right' 
  | 'other';

// Condition d'éclairage
export type LightingCondition = 
  | 'normal' 
  | 'low' 
  | 'flash' 
  | 'backlit' 
  | 'other';

// Verdict de l'admin sur un scan
export type AdminVerdict = 
  | 'operator_right' 
  | 'system_right' 
  | 'indeterminate'
  | null;

// Statut d'un compteur non reconnu
export type UnrecognizedStatus = 
  | 'pending' 
  | 'new_model' 
  | 'linked' 
  | 'ignored';

// ============================================================================
// Interfaces principales
// ============================================================================

export interface MeterModel {
  id: string;
  name: string;
  manufacturer: string | null;
  model_reference: string | null;
  meter_type: MeterType;
  sub_type: MeterSubType;
  unit: string;
  ai_description: string | null;
  display_type: DisplayType;
  primary_color: string | null;
  is_active: boolean;
  usage_count: number;
  success_count: number;
  created_at: string;
  updated_at: string;
}

export interface MeterModelWithStats extends MeterModel {
  success_rate: number;
  photo_count: number;
  zone_count: number;
  primary_photo_url: string | null;
}

export interface MeterModelPhoto {
  id: string;
  model_id: string;
  photo_url: string;
  angle_type: PhotoAngle;
  lighting_condition: LightingCondition;
  is_primary: boolean;
  created_at: string;
}

export interface MeterExtractionZone {
  id: string;
  model_id: string;
  field_type: FieldType;
  custom_label: string | null;
  position_x: number;
  position_y: number;
  position_width: number;
  position_height: number;
  path_data: string | null;
  expected_format: string | null;
  decimal_places: number;
  note: string | null;
  display_color: string;
  sort_order: number;
  created_at: string;
}

export interface ScanModification {
  field: FieldType;
  original: string;
  final: string;
  type: 'none' | 'partial' | 'complete';
}

export interface MeterScan {
  id: string;
  model_id: string | null;
  user_id: string | null;
  inspection_id: string | null;
  photo_url: string;
  extracted_data: Record<string, string | number>;
  validated_data: Record<string, string | number>;
  modifications: ScanModification[];
  confidence_score: number | null;
  flash_used: boolean;
  scan_duration_ms: number | null;
  admin_verdict: AdminVerdict;
  admin_reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface MeterScanWithDetails extends MeterScan {
  model_name: string | null;
  meter_type: MeterType | null;
  user_email: string | null;
}

export interface UnrecognizedMeter {
  id: string;
  photo_url: string;
  user_entered_data: {
    type?: MeterType;
    serial_number?: string;
    readings?: string[];
    ean?: string;
  };
  user_id: string | null;
  property_address: string | null;
  ai_raw_response: string | null;
  ai_confidence: number | null;
  status: UnrecognizedStatus;
  linked_model_id: string | null;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface UnrecognizedMeterWithUser extends UnrecognizedMeter {
  user_email: string | null;
}

// ============================================================================
// Constantes et helpers
// ============================================================================

export const METER_TYPE_LABELS: Record<MeterType, string> = {
  electricity: 'Électricité',
  gas: 'Gaz',
  water_general: 'Eau - Général',
  water_passage: 'Eau - Passage',
  oil_tank: 'Mazout',
  calorimeter: 'Calorimètre',
  other: 'Autre'
};

export const METER_TYPE_ICONS: Record<MeterType, string> = {
  electricity: '⚡',
  gas: '🔥',
  water_general: '💧',
  water_passage: '💧',
  oil_tank: '🛢️',
  calorimeter: '🌡️',
  other: '📊'
};

export const METER_TYPE_COLORS: Record<MeterType, string> = {
  electricity: '#EAB308',
  gas: '#F97316',
  water_general: '#06B6D4',
  water_passage: '#06B6D4',
  oil_tank: '#92400E',
  calorimeter: '#EF4444',
  other: '#6B7280'
};

export const SUB_TYPE_LABELS: Record<NonNullable<MeterSubType>, string> = {
  simple: 'Simple',
  bi_hourly: 'Bi-horaire (jour/nuit)',
  exclusive_night: 'Exclusif nuit',
  production: 'Production',
  tri_hourly: 'Tri-horaire',
  injection: 'Injection'
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  serial_number: 'Numéro de compteur',
  ean: 'Code EAN',
  reading_single: 'Index unique',
  reading_day: 'Index jour',
  reading_night: 'Index nuit',
  reading_exclusive_night: 'Index exclusif nuit',
  reading_production: 'Index production',
  reading_injection: 'Index injection',
  subscribed_power: 'Puissance souscrite',
  other: 'Autre'
};

export const ZONE_COLORS: Record<FieldType, string> = {
  serial_number: '#3B82F6',
  ean: '#8B5CF6',
  reading_single: '#10B981',
  reading_day: '#F59E0B',
  reading_night: '#6366F1',
  reading_exclusive_night: '#4F46E5',
  reading_production: '#14B8A6',
  reading_injection: '#06B6D4',
  subscribed_power: '#EC4899',
  other: '#6B7280'
};

export const PHOTO_ANGLE_LABELS: Record<PhotoAngle, string> = {
  frontal: 'Frontal',
  below: 'En dessous',
  above: 'Au dessus',
  left: 'Gauche',
  right: 'Droite',
  other: 'Autre'
};

export const LIGHTING_LABELS: Record<LightingCondition, string> = {
  normal: 'Normal',
  low: 'Faible',
  flash: 'Flash',
  backlit: 'Contre-jour',
  other: 'Autre'
};

export const VERDICT_LABELS: Record<NonNullable<AdminVerdict>, string> = {
  operator_right: 'Opérateur a raison',
  system_right: 'Système avait raison',
  indeterminate: 'Indéterminé'
};

export function getSuccessLevel(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 90) return 'success';
  if (rate >= 75) return 'warning';
  return 'danger';
}

export function formatSuccessRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}
