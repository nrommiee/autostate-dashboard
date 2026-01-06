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
