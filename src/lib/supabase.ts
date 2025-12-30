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
}

export interface Inspection {
  id: string
  user_id: string
  address: string
  type: string
  status: string
  sync_status: string
  created_at: string
  updated_at: string
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
