'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QRCodeSVG } from 'qrcode.react'
import { Smartphone, RefreshCw } from 'lucide-react'

const SUPER_ADMIN_EMAILS = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS?.split(',') || []

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  // QR Auth state
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'ready' | 'approved' | 'expired' | 'error'>('idle')
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)

  // Login classique
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!SUPER_ADMIN_EMAILS.includes(email)) {
      setError('Accès non autorisé. Seuls les super admins peuvent se connecter.')
      setLoading(false)
      return
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      router.push('/dashboard')
    }
  }

  // Générer un token QR
  const generateQRToken = useCallback(async () => {
    setQrStatus('loading')
    
    try {
      const { data, error } = await supabase.rpc('create_auth_token', {
        p_ip_address: null,
        p_user_agent: navigator.userAgent
      })

      if (error) throw error

      if (data && data.length > 0) {
        setQrToken(data[0].token)
        setExpiresAt(new Date(data[0].expires_at))
        setQrStatus('ready')
      }
    } catch (error) {
      console.error('Error generating token:', error)
      setQrStatus('error')
    }
  }, [])

  // Polling pour vérifier le statut
  useEffect(() => {
    if (!qrToken || qrStatus !== 'ready') return

    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.rpc('check_auth_token', {
          p_token: qrToken
        })

        if (error) throw error

        if (data) {
          if (data.status === 'approved') {
            setQrStatus('approved')
            clearInterval(pollInterval)
            
            // Vérifier que c'est un super admin
            if (!SUPER_ADMIN_EMAILS.includes(data.user_email)) {
              setError('Accès non autorisé. Seuls les super admins peuvent se connecter.')
              setQrStatus('error')
              return
            }
            
            // Créer la session via l'API
            const response = await fetch('/api/qr-auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: data.user_id,
                email: data.user_email
              })
            })
            
            const result = await response.json()
            
            if (result.success && result.authUrl) {
              // Rediriger vers le magic link
              window.location.href = result.authUrl
            } else {
              setError(result.error || 'Erreur de connexion')
              setQrStatus('error')
            }
          } else if (data.status === 'expired') {
            setQrStatus('expired')
            clearInterval(pollInterval)
          }
        }
      } catch (error) {
        console.error('Error polling token:', error)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [qrToken, qrStatus, router])

  // Timer countdown
  useEffect(() => {
    if (!expiresAt || qrStatus !== 'ready') return

    const updateTimer = () => {
      const now = new Date()
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
      setTimeLeft(diff)

      if (diff === 0) {
        setQrStatus('expired')
      }
    }

    updateTimer()
    const timerInterval = setInterval(updateTimer, 1000)

    return () => clearInterval(timerInterval)
  }, [expiresAt, qrStatus])

  // Générer le token au mount
  useEffect(() => {
    generateQRToken()
  }, [generateQRToken])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const qrValue = qrToken ? `autostate://auth?token=${qrToken}` : ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">📐</span>
          </div>
          <CardTitle className="text-2xl">AutoState Admin</CardTitle>
          <CardDescription>
            Connectez-vous avec votre compte super admin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Formulaire classique */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-sm text-gray-500">ou</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* QR Code Section */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-gray-700">
              <Smartphone className="w-5 h-5" />
              <span className="font-medium">Connexion avec l'app</span>
            </div>
            <p className="text-sm text-gray-500">
              Scannez ce QR code depuis l'application AutoState
            </p>

            {/* QR Code */}
            <div className="flex justify-center">
              {qrStatus === 'loading' && (
                <div className="w-44 h-44 flex items-center justify-center bg-gray-100 rounded-lg">
                  <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                </div>
              )}

              {qrStatus === 'ready' && qrToken && (
                <div className="p-3 bg-white rounded-lg shadow-sm border">
                  <QRCodeSVG
                    value={qrValue}
                    size={160}
                    level="M"
                    includeMargin={false}
                    fgColor="#0d9488"
                  />
                </div>
              )}

              {qrStatus === 'approved' && (
                <div className="w-44 h-44 flex flex-col items-center justify-center bg-green-50 rounded-lg border border-green-200">
                  <svg className="w-14 h-14 text-green-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-600 font-medium">Connexion...</span>
                </div>
              )}

              {qrStatus === 'expired' && (
                <div className="w-44 h-44 flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                  <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-500 text-sm mb-2">Code expiré</span>
                  <button
                    onClick={generateQRToken}
                    className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Régénérer
                  </button>
                </div>
              )}

              {qrStatus === 'error' && (
                <div className="w-44 h-44 flex flex-col items-center justify-center bg-red-50 rounded-lg">
                  <svg className="w-10 h-10 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-red-500 text-sm mb-2">Erreur</span>
                  <button
                    onClick={generateQRToken}
                    className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Réessayer
                  </button>
                </div>
              )}
            </div>

            {/* Timer */}
            {qrStatus === 'ready' && timeLeft > 0 && (
              <p className="text-xs text-gray-400">
                Expire dans {formatTime(timeLeft)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
