// src/lib/auth.ts
// Authentication helpers with role management

import { supabase } from './supabase'

export type UserRole = 'admin' | 'owner' | 'tenant' | 'agent'

export interface AuthUser {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_super_admin: boolean
  avatar_url: string | null
}

export interface ImpersonationSession {
  isImpersonating: boolean
  adminId: string | null
  adminEmail: string | null
  targetUser: AuthUser | null
  logId: string | null
}

// Get current user with role
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return null
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_super_admin, avatar_url')
    .eq('id', session.user.id)
    .single()
  
  if (!profile) return null
  
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: (profile.role || 'owner') as UserRole,
    is_super_admin: profile.is_super_admin || false,
    avatar_url: profile.avatar_url
  }
}

// Check if user is admin
export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin' || user?.is_super_admin === true
}

// Get redirect path based on role
export function getRedirectPath(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/dashboard'
    case 'owner':
    case 'tenant':
    case 'agent':
      return '/portal'
    default:
      return '/portal'
  }
}

// Impersonation functions
export async function startImpersonation(targetUserId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('start_impersonation', {
      p_target_user_id: targetUserId,
      p_reason: reason || 'Support client'
    })
    
    if (error) throw error
    
    // Store impersonation info in localStorage
    const currentUser = await getCurrentUser()
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single()
    
    if (currentUser && targetProfile) {
      localStorage.setItem('impersonation', JSON.stringify({
        isImpersonating: true,
        adminId: currentUser.id,
        adminEmail: currentUser.email,
        targetUser: targetProfile,
        logId: data
      }))
    }
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function endImpersonation(): Promise<void> {
  try {
    await supabase.rpc('end_impersonation')
  } catch (error) {
    console.error('Error ending impersonation:', error)
  }
  
  localStorage.removeItem('impersonation')
}

export function getImpersonationSession(): ImpersonationSession {
  if (typeof window === 'undefined') {
    return { isImpersonating: false, adminId: null, adminEmail: null, targetUser: null, logId: null }
  }
  
  const stored = localStorage.getItem('impersonation')
  if (!stored) {
    return { isImpersonating: false, adminId: null, adminEmail: null, targetUser: null, logId: null }
  }
  
  try {
    return JSON.parse(stored)
  } catch {
    return { isImpersonating: false, adminId: null, adminEmail: null, targetUser: null, logId: null }
  }
}

// Role labels for UI
export const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bgColor: string }> = {
  admin: { label: 'Administrateur', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  owner: { label: 'Propriétaire', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  tenant: { label: 'Locataire', color: 'text-green-700', bgColor: 'bg-green-100' },
  agent: { label: 'Agent', color: 'text-orange-700', bgColor: 'bg-orange-100' },
}
