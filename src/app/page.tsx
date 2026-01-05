'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

import { ChevronLeftIcon, EyeIcon, EyeOffIcon, Smartphone, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

import { BorderBeam } from '@/components/ui/border-beam'
import Logo from '@/components/shadcn-studio/logo'
import AuthFullBackgroundShape from '@/assets/svg/auth-full-background-shape'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  
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
    <div className='h-dvh lg:grid lg:grid-cols-6'>
      {/* Dashboard Preview */}
      <div className='max-lg:hidden lg:col-span-3 xl:col-span-4'>
        <div className='bg-muted relative z-1 flex h-full items-center justify-center px-6'>
          <div className='outline-border relative shrink rounded-[20px] p-2.5 outline-2 -outline-offset-[2px]'>
            <img
              src='https://cdn.shadcnstudio.com/ss-assets/blocks/marketing/auth/image-1.png'
              className='max-h-111 w-full rounded-lg object-contain dark:hidden'
              alt='Dashboards'
            />
            <img
              src='https://cdn.shadcnstudio.com/ss-assets/blocks/marketing/auth/image-1-dark.png'
              className='hidden max-h-111 w-full rounded-lg object-contain dark:inline-block'
              alt='Dashboards'
            />

            <BorderBeam duration={8} borderWidth={2} size={100} />
          </div>

          <div className='absolute -z-1'>
            <AuthFullBackgroundShape />
          </div>
        </div>
      </div>

      {/* Login Form */}
      <div className='flex h-full flex-col items-center justify-center py-10 sm:px-5 lg:col-span-3 xl:col-span-2'>
        <div className='w-full max-w-md px-6'>
          <a href='#' className='text-muted-foreground group mb-12 flex items-center gap-2 sm:mb-16 lg:mb-24'>
            <ChevronLeftIcon className='transition-transform duration-200 group-hover:-translate-x-0.5' />
            <p>Back to the website</p>
          </a>

          <div className='flex flex-col gap-6'>
            <Logo className='gap-3' />

            <div>
              <h2 className='mb-1.5 text-2xl font-semibold'>Sign in to AutoState</h2>
              <p className='text-muted-foreground'>Manage your property inspections.</p>
            </div>

            {/* SUPPRIMÉ: Magic Link */}
            {/* SUPPRIMÉ: Login as User / Login as Admin */}

            {/* Form - CODE EXACT DU TEMPLATE */}
            <form className='space-y-4' onSubmit={handleLogin}>
              {/* Email */}
              <div className='space-y-1'>
                <Label className='leading-5' htmlFor='userEmail'>
                  Email address*
                </Label>
                <Input 
                  type='email' 
                  id='userEmail' 
                  placeholder='Enter your email address'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className='w-full space-y-1'>
                <Label className='leading-5' htmlFor='password'>
                  Password*
                </Label>
                <div className='relative'>
                  <Input 
                    id='password' 
                    type={isVisible ? 'text' : 'password'} 
                    placeholder='••••••••••••••••' 
                    className='pr-9'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => setIsVisible(prevState => !prevState)}
                    className='text-muted-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 rounded-l-none hover:bg-transparent'
                  >
                    {isVisible ? <EyeOffIcon /> : <EyeIcon />}
                    <span className='sr-only'>{isVisible ? 'Hide password' : 'Show password'}</span>
                  </Button>
                </div>
              </div>

              {/* Remember Me and Forgot Password */}
              <div className='flex items-center justify-between gap-y-2'>
                <div className='flex items-center gap-3'>
                  <Checkbox id='rememberMe' className='size-6' />
                  <Label htmlFor='rememberMe'> Remember Me</Label>
                </div>

                <a href='/forgot-password' className='hover:underline'>
                  Forgot Password?
                </a>
              </div>

              {/* Error */}
              {error && (
                <div className='text-sm text-red-600 bg-red-50 p-3 rounded-md'>
                  {error}
                </div>
              )}

              <Button className='w-full' type='submit' disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in to AutoState'}
              </Button>
            </form>

            <div className='space-y-4'>
              {/* SUPPRIMÉ: New on our platform? Create an account */}

              <div className='flex items-center gap-4'>
                <Separator className='flex-1' />
                <p>or</p>
                <Separator className='flex-1' />
              </div>

              {/* QR CODE - REMPLACE "Sign in with google" */}
              <div className='text-center space-y-3'>
                <div className='flex items-center justify-center gap-2 text-muted-foreground'>
                  <Smartphone className='w-5 h-5' />
                  <span className='font-medium'>Sign in with app</span>
                </div>
                <p className='text-sm text-muted-foreground'>
                  Scan this QR code from the AutoState app
                </p>

                {/* QR Code */}
                <div className='flex justify-center'>
                  {qrStatus === 'loading' && (
                    <div className='w-44 h-44 flex items-center justify-center bg-muted rounded-lg'>
                      <RefreshCw className='w-8 h-8 text-muted-foreground animate-spin' />
                    </div>
                  )}

                  {qrStatus === 'ready' && qrToken && (
                    <div className='p-3 bg-white rounded-lg shadow-sm border'>
                      <QRCodeSVG
                        value={qrValue}
                        size={160}
                        level='M'
                        includeMargin={false}
                        fgColor='#0d9488'
                      />
                    </div>
                  )}

                  {qrStatus === 'approved' && (
                    <div className='w-44 h-44 flex flex-col items-center justify-center bg-green-50 rounded-lg border border-green-200'>
                      <svg className='w-14 h-14 text-green-500 mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                      </svg>
                      <span className='text-green-600 font-medium'>Connecting...</span>
                    </div>
                  )}

                  {qrStatus === 'expired' && (
                    <div className='w-44 h-44 flex flex-col items-center justify-center bg-muted rounded-lg'>
                      <svg className='w-10 h-10 text-muted-foreground mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
                      </svg>
                      <span className='text-muted-foreground text-sm mb-2'>Code expired</span>
                      <button
                        onClick={generateQRToken}
                        className='text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1'
                      >
                        <RefreshCw className='w-4 h-4' />
                        Regenerate
                      </button>
                    </div>
                  )}

                  {qrStatus === 'error' && (
                    <div className='w-44 h-44 flex flex-col items-center justify-center bg-red-50 rounded-lg'>
                      <svg className='w-10 h-10 text-red-400 mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
                      </svg>
                      <span className='text-red-500 text-sm mb-2'>Error</span>
                      <button
                        onClick={generateQRToken}
                        className='text-primary hover:text-primary/80 text-sm font-medium flex items-center gap-1'
                      >
                        <RefreshCw className='w-4 h-4' />
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                {/* Timer */}
                {qrStatus === 'ready' && timeLeft > 0 && (
                  <p className='text-xs text-muted-foreground'>
                    Expires in {formatTime(timeLeft)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
