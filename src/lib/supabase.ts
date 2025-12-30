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
