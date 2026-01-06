// src/app/page.tsx
// Login page with role-based redirect

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentUser, getRedirectPath } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const user = await getCurrentUser()
      
      if (user) {
        // Redirect based on role
        const redirectPath = getRedirectPath(user.role)
        router.push(redirectPath)
      } else {
        setCheckingSession(false)
      }
    }
    
    checkSession()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      if (data.user) {
        // Get user profile to check role
        const user = await getCurrentUser()
        
        if (user) {
          const redirectPath = getRedirectPath(user.role)
          router.push(redirectPath)
        } else {
          // Fallback to portal if no profile
          router.push('/portal')
        }
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message === 'Invalid login credentials' 
        ? 'Email ou mot de passe incorrect' 
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-3xl">📐</span>
          </div>
          <h1 className="text-2xl font-bold">AutoState</h1>
          <p className="text-muted-foreground text-sm mt-1">Connectez-vous à votre compte</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-teal-600 hover:bg-teal-700"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connexion...
              </>
            ) : (
              'Se connecter'
            )}
          </Button>
        </form>

        {/* Demo accounts info (for testing) */}
        <div className="mt-8 pt-6 border-t">
          <p className="text-xs text-center text-muted-foreground mb-3">Comptes de démonstration</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between p-2 bg-slate-50 rounded">
              <span>Admin:</span>
              <span className="font-mono">nrommiee@icloud.com</span>
            </div>
            <div className="flex justify-between p-2 bg-blue-50 rounded">
              <span>Propriétaire:</span>
              <span className="font-mono">demo-owner@autostate.be</span>
            </div>
            <div className="flex justify-between p-2 bg-green-50 rounded">
              <span>Locataire:</span>
              <span className="font-mono">demo-tenant@autostate.be</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
