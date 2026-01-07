import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client with service role (server-side only)
export const createAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Types
export interface Profile {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  avatar_url: string | null
  role: string
  is_super_admin: boolean
  subscription_status: string
  created_at: string
  updated_at: string
  last_sign_in_at?: string
}

// Mission data structure (from JSONB)
export interface MissionAddress {
  id: string
  fullAddress: string
  coordinate?: {
    latitude: number
    longitude: number
  }
}

export interface MissionAddressDetails {
  box: string
  city: string
  floor: string
  number: string
  street: string
  country: string
  postalCode: string
  roomNumber: string
}

export interface MissionParty {
  id: string
  role: string
  email: string
  phone: string
  city: string
  street: string
  number: string
  postalCode: string
  country: string
  isCompany: boolean
  companyName: string
  firstName: string
  lastName: string
  legalForm: string
  enterpriseNumber: string
  representativeFirstName: string
  representativeLastName: string
}

export interface RoomMeasurements {
  walls: Array<{
    id: string
    area: number
    label: string
  }>
  floorArea: number | boolean
  wallsArea: number
  ceilingArea: number | boolean
  scannedAt?: string
}

export interface DetectedObject {
  id: string
  name: string
  category: string
  material?: string
  color?: string
  condition?: string
  location?: string
  damages?: any[]
}

export interface MissionRoom {
  id: string
  name: string
  status: string
  createdAt: string
  captureMode: string
  measurements?: RoomMeasurements
  wallPhotos: any[]
  floorPhotos: any[]
  ceilingPhotos: any[]
  equipmentPhotos: any[]
  audioNotes: any[]
  detectedObjects: DetectedObject[]
  inventoryItems: any[]
  structuredElements: any[]
  transcription: string
}

export interface MissionOperatorData {
  sentToEmails: string[]
  internalNotes: string
  signatureDates: Record<string, string>
  totalTimeSpent: number
}

export interface MissionData {
  id: string
  status: string
  missionType: string
  propertyType: string
  address: MissionAddress
  addressDetails: MissionAddressDetails
  parties: MissionParty[]
  rooms: MissionRoom[]
  counters: any[]
  keys: any[]
  documents: any[]
  security: {
    region: string
    smokeDetectors: any[]
  }
  operatorData: MissionOperatorData
  additionalInfo: {
    observations: string
    generalPhotos: any[]
    cleanlinessLevel: string
  }
  sectionCompletion: {
    keys: boolean
    rooms: boolean
    counters: boolean
    security: boolean
    additionalInfo: boolean
  }
  reference: string
  dateTime: string
  endDateTime: string
  createdAt: string
  updatedAt: string
  syncStatus: string
}

export interface Mission {
  id: string
  local_id: string
  workspace_id: string
  created_by: string
  report_number: string
  status: string
  data: MissionData
  device_id: string
  last_modified_by: string
  pdf_url: string | null
  pdf_generated_at: string | null
  created_at: string
  updated_at: string
  synced_at: string
  deleted_at: string | null
}

// Computed mission stats
export interface MissionStats {
  totalRooms: number
  totalPhotos: number
  totalObjects: number
  timeSpentMinutes: number
  hasAddress: boolean
  completionPercentage: number
}

export function computeMissionStats(data: MissionData): MissionStats {
  const rooms = data.rooms || []
  
  let totalPhotos = 0
  let totalObjects = 0
  
  rooms.forEach(room => {
    totalPhotos += (room.wallPhotos?.length || 0)
    totalPhotos += (room.floorPhotos?.length || 0)
    totalPhotos += (room.ceilingPhotos?.length || 0)
    totalPhotos += (room.equipmentPhotos?.length || 0)
    totalObjects += (room.detectedObjects?.length || 0)
    totalObjects += (room.inventoryItems?.length || 0)
  })
  
  // General photos
  totalPhotos += (data.additionalInfo?.generalPhotos?.length || 0)
  
  // Completion percentage
  const sections = data.sectionCompletion || {}
  const completedSections = Object.values(sections).filter(Boolean).length
  const totalSections = Object.keys(sections).length || 1
  const completionPercentage = Math.round((completedSections / totalSections) * 100)
  
  return {
    totalRooms: rooms.length,
    totalPhotos,
    totalObjects,
    timeSpentMinutes: Math.round((data.operatorData?.totalTimeSpent || 0) / 60),
    hasAddress: !!data.address?.fullAddress,
    completionPercentage
  }
}

export interface ObjectTemplate {
  id: string
  name: string
  category: string
  default_materials: string[]
  default_properties: string[]
  is_approved: boolean
  usage_count: number
  created_at: string
}

export interface PropertySuggestion {
  id: string
  object_template_name: string
  property_name: string
  property_value: string | null
  suggested_by_user_id: string | null
  usage_count: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

// Workspace
export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
}

// ============================================
// Meter Scan Types
// ============================================

export type MeterType = 
  | 'water_general' 
  | 'water_passage' 
  | 'electricity' 
  | 'gas' 
  | 'oil_tank' 
  | 'calorimeter' 
  | 'other';

export type MeterFieldType = 
  | 'serialNumber'
  | 'ean'
  | 'readingSingle'
  | 'readingDay'
  | 'readingNight'
  | 'readingExclusiveNight'
  | 'readingProduction'
  | 'subscribedPower'
  | 'custom';

export interface MeterZone {
  id: string;
  fieldType: MeterFieldType;
  label: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  backgroundColor?: string;
  textColor?: string;
  digitCount?: number;
  hasDecimals: boolean;
  decimalDigits?: number;
  combinationFormula?: string;
}

export interface MeterModel {
  id: string;
  name: string;
  manufacturer: string;
  meter_type: MeterType;
  unit: string;
  ai_description: string;
  ai_analysis_data: Record<string, any>;
  reference_photos: string[];
  zones: MeterZone[];
  is_active: boolean;
  is_verified: boolean;
  status: 'draft' | 'active' | 'archived';
  usage_count: number;
  success_count: number;
  fail_count: number;
  total_scans: number;
  avg_confidence: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeterModelStats {
  successRate: number;
  avgConfidence: number;
  totalScans: number;
  isReliable: boolean;
}

export function computeMeterModelStats(model: MeterModel): MeterModelStats {
  const successRate = model.total_scans > 0 
    ? (model.success_count / model.total_scans) * 100 
    : 0;
  
  return {
    successRate: Math.round(successRate * 10) / 10,
    avgConfidence: Math.round(model.avg_confidence * 100),
    totalScans: model.total_scans,
    isReliable: successRate > 80 && model.total_scans > 10
  };
}

export type UnrecognizedMeterStatus = 'pending' | 'processed' | 'linked' | 'ignored';

export interface UnrecognizedMeterUserData {
  type: MeterType;
  serialNumber?: string;
  readings: string[];
  eanCode?: string;
}

export interface UnrecognizedMeterDeviceInfo {
  appVersion: string;
  deviceModel: string;
  osVersion: string;
}

export interface UnrecognizedMeter {
  id: string;
  photo_url: string;
  photo_path: string;
  ai_response: Record<string, any>;
  ai_detected_type: string | null;
  ai_confidence: number;
  ai_extracted_data: Record<string, any>;
  user_data: UnrecognizedMeterUserData | null;
  has_user_data: boolean;
  user_id: string | null;
  inspection_id: string | null;
  device_info: UnrecognizedMeterDeviceInfo;
  flash_used: boolean;
  scan_attempts: number;
  status: UnrecognizedMeterStatus;
  processed_by: string | null;
  processed_at: string | null;
  linked_model_id: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface MeterScanFieldModification {
  fieldType: MeterFieldType;
  originalValue: string;
  modifiedValue: string;
}

export interface MeterScanLog {
  id: string;
  user_id: string | null;
  inspection_id: string | null;
  was_successful: boolean;
  confidence: number | null;
  detected_type: string | null;
  model_id: string | null;
  scan_duration_ms: number | null;
  flash_used: boolean;
  lighting_condition: 'excellent' | 'good' | 'low' | 'veryLow' | null;
  fields_modified: MeterScanFieldModification[];
  had_modifications: boolean;
  device_info: UnrecognizedMeterDeviceInfo;
  created_at: string;
}

export interface MeterFieldModificationStats {
  id: string;
  model_id: string;
  field_type: string;
  total_extractions: number;
  modification_count: number;
  modification_rate: number;
  alert_threshold: number;
  alert_triggered: boolean;
  last_updated: string;
}

export interface MeterScanKPIs {
  total_scans: number;
  successful_scans: number;
  success_rate: number;
  avg_confidence: number;
  avg_scan_duration_ms: number;
  flash_usage_rate: number;
  modification_rate: number;
  unique_users: number;
}

export const METER_TYPE_CONFIG: Record<MeterType, {
  label: string;
  unit: string;
  icon: string;
  color: string;
}> = {
  water_general: {
    label: 'Eau - Général',
    unit: 'm³',
    icon: '💧',
    color: '#06B6D4'
  },
  water_passage: {
    label: 'Eau - Passage',
    unit: 'm³',
    icon: '💧',
    color: '#06B6D4'
  },
  electricity: {
    label: 'Électricité',
    unit: 'kWh',
    icon: '⚡',
    color: '#EAB308'
  },
  gas: {
    label: 'Gaz',
    unit: 'm³',
    icon: '🔥',
    color: '#F97316'
  },
  oil_tank: {
    label: 'Mazout',
    unit: 'L',
    icon: '🛢️',
    color: '#78716C'
  },
  calorimeter: {
    label: 'Calorimètre',
    unit: 'kWh',
    icon: '🌡️',
    color: '#EF4444'
  },
  other: {
    label: 'Autre',
    unit: '',
    icon: '📊',
    color: '#6B7280'
  }
};

export const METER_FIELD_CONFIG: Record<MeterFieldType, {
  label: string;
  icon: string;
  isReading: boolean;
}> = {
  serialNumber: {
    label: 'Numéro de compteur',
    icon: '🔢',
    isReading: false
  },
  ean: {
    label: 'Code EAN',
    icon: '📊',
    isReading: false
  },
  readingSingle: {
    label: 'Index unique',
    icon: '📈',
    isReading: true
  },
  readingDay: {
    label: 'Index jour / heures pleines',
    icon: '☀️',
    isReading: true
  },
  readingNight: {
    label: 'Index nuit / heures creuses',
    icon: '🌙',
    isReading: true
  },
  readingExclusiveNight: {
    label: 'Index exclusif nuit',
    icon: '🌃',
    isReading: true
  },
  readingProduction: {
    label: 'Index production',
    icon: '⬆️',
    isReading: true
  },
  subscribedPower: {
    label: 'Puissance souscrite',
    icon: '⚡',
    isReading: false
  },
  custom: {
    label: 'Champ personnalisé',
    icon: '✏️',
    isReading: false
  }
};

export interface MeterModelFormData {
  name: string;
  manufacturer: string;
  meter_type: MeterType;
  unit: string;
  zones: MeterZone[];
  reference_photos: File[];
}

export function createEmptyZone(fieldType: MeterFieldType = 'serialNumber'): MeterZone {
  return {
    id: crypto.randomUUID(),
    fieldType,
    label: METER_FIELD_CONFIG[fieldType].label,
    hasDecimals: false
  };
}

export function validateMeterModel(data: MeterModelFormData): string[] {
  const errors: string[] = [];
  
  if (!data.name.trim()) {
    errors.push('Le nom du modèle est requis');
  }
  
  if (!data.meter_type) {
    errors.push('Le type de compteur est requis');
  }
  
  if (data.zones.length === 0) {
    errors.push('Au moins une zone doit être définie');
  }
  
  const hasSerialZone = data.zones.some(z => z.fieldType === 'serialNumber');
  const hasReadingZone = data.zones.some(z => METER_FIELD_CONFIG[z.fieldType].isReading);
  
  if (!hasSerialZone && !hasReadingZone) {
    errors.push('Au moins un numéro de série ou un index est requis');
  }
  
  if (data.reference_photos.length === 0) {
    errors.push('Au moins une photo de référence est requise');
  }
  
  return errors;
}
