'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Separator } from '@/components/ui/separator'
import { BorderBeam } from '@/components/ui/border-beam'

import AutoStateLogo from '@/components/login/logo'
import LoginForm from '@/components/login/login-form'
import QRCodeSection from '@/components/login/qr-code-section'
import AuthBackgroundShape from '@/assets/svg/auth-background-shape'

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

  return (
    <div className='min-h-screen lg:grid lg:grid-cols-2'>
      {/* Left Side - Branding */}
      <div className='hidden lg:flex bg-gradient-to-br from-teal-600 to-teal-700 relative overflow-hidden'>
        <div className='relative z-10 flex flex-col items-center justify-center w-full px-12'>
          {/* Dashboard Preview Card */}
          <div className='relative rounded-2xl p-1 bg-white/10 backdrop-blur-sm'>
            <div className='bg-white rounded-xl overflow-hidden shadow-2xl'>
              <img
                src='/dashboard-preview.png'
                alt='AutoState Dashboard'
                className='w-full max-w-md object-cover'
                onError={(e) => {
                  // Fallback si l'image n'existe pas
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.parentElement!.innerHTML = `
                    <div class="w-96 h-64 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-8 text-center">
                      <div class="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center mb-4">
                        <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                        </svg>
                      </div>
                      <h3 class="text-lg font-semibold text-gray-800">AutoState Dashboard</h3>
                      <p class="text-sm text-gray-500 mt-1">Gérez vos états des lieux</p>
                    </div>
                  `
                }}
              />
            </div>
            <BorderBeam duration={8} borderWidth={2} size={100} />
          </div>

          {/* Tagline */}
          <div className='mt-12 text-center text-white'>
            <h2 className='text-2xl font-bold mb-2'>États des lieux simplifiés</h2>
            <p className='text-teal-100 max-w-sm'>
              Gérez vos inspections immobilières avec l'IA et gagnez du temps sur chaque mission.
            </p>
          </div>

          {/* Stats */}
          <div className='mt-8 flex gap-8'>
            <div className='text-center'>
              <div className='text-3xl font-bold text-white'>500+</div>
              <div className='text-sm text-teal-200'>Missions</div>
            </div>
            <div className='text-center'>
              <div className='text-3xl font-bold text-white'>50+</div>
              <div className='text-sm text-teal-200'>Utilisateurs</div>
            </div>
            <div className='text-center'>
              <div className='text-3xl font-bold text-white'>98%</div>
              <div className='text-sm text-teal-200'>Satisfaction</div>
            </div>
          </div>
        </div>

        {/* Background Shape */}
        <div className='absolute inset-0 opacity-30'>
          <AuthBackgroundShape className='absolute -right-32 -bottom-32 w-[800px] h-[800px]' />
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className='flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 py-12 lg:bg-white'>
        <div className='w-full max-w-sm'>
          {/* Logo */}
          <div className='mb-8'>
            <AutoStateLogo />
          </div>

          {/* Header */}
          <div className='mb-8'>
            <h1 className='text-2xl font-semibold text-gray-900'>
              Bienvenue
            </h1>
            <p className='mt-1 text-gray-500'>
              Connectez-vous à votre compte administrateur
            </p>
          </div>

          {/* Login Form */}
          <LoginForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            error={error}
            loading={loading}
            onSubmit={handleLogin}
          />

          {/* Divider */}
          <div className='my-8 flex items-center gap-4'>
            <Separator className='flex-1' />
            <span className='text-sm text-gray-400'>ou</span>
            <Separator className='flex-1' />
          </div>

          {/* QR Code Section */}
          <QRCodeSection
            qrToken={qrToken}
            qrStatus={qrStatus}
            timeLeft={timeLeft}
            onRegenerate={generateQRToken}
          />
        </div>

        {/* Footer */}
        <div className='mt-12 text-center text-xs text-gray-400'>
          © 2024 AutoState. Tous droits réservés.
        </div>
      </div>
    </div>
  )
}
