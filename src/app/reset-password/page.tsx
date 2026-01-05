'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EyeIcon, EyeOffIcon, CheckCircle, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isVisible, setIsVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    
    if (!accessToken) {
      router.push('/')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) throw error

      setSuccess(true)
      
      setTimeout(() => {
        router.push('/')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12'>
      <div className='w-full max-w-sm'>
        {/* Logo */}
        <div className='flex items-center gap-3 mb-8'>
          <div className='w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center'>
            <svg viewBox='0 0 24 24' fill='none' className='w-6 h-6 text-white' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M3 21h18' />
              <path d='M3 21V3l18 18' />
              <path d='M7 17h4' />
              <path d='M11 13v4' />
            </svg>
          </div>
          <span className='text-xl font-semibold'>AutoState</span>
        </div>

        {!success ? (
          <>
            {/* Header */}
            <div className='mb-8'>
              <h1 className='text-2xl font-semibold text-gray-900'>
                Nouveau mot de passe
              </h1>
              <p className='mt-2 text-gray-500'>
                Choisissez un nouveau mot de passe sécurisé pour votre compte.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='password'>Nouveau mot de passe</Label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                  <Input
                    id='password'
                    type={isVisible ? 'text' : 'password'}
                    placeholder='••••••••••••'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className='pl-10 pr-11'
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => setIsVisible(prev => !prev)}
                    className='absolute inset-y-0 right-0 h-full px-3 text-gray-400 hover:text-gray-600 hover:bg-transparent'
                  >
                    {isVisible ? <EyeOffIcon className='w-5 h-5' /> : <EyeIcon className='w-5 h-5' />}
                  </Button>
                </div>
                <p className='text-xs text-gray-400'>Minimum 8 caractères</p>
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='confirmPassword'>Confirmer le mot de passe</Label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                  <Input
                    id='confirmPassword'
                    type={isVisible ? 'text' : 'password'}
                    placeholder='••••••••••••'
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className='pl-10'
                  />
                </div>
              </div>

              {error && (
                <div className='text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100'>
                  {error}
                </div>
              )}

              <Button 
                type='submit' 
                className='w-full bg-teal-600 hover:bg-teal-700'
                disabled={loading}
              >
                {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
              </Button>
            </form>
          </>
        ) : (
          /* Success State */
          <div className='text-center'>
            <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6'>
              <CheckCircle className='w-8 h-8 text-green-600' />
            </div>
            <h2 className='text-xl font-semibold text-gray-900 mb-2'>
              Mot de passe mis à jour !
            </h2>
            <p className='text-gray-500'>
              Vous allez être redirigé vers la page de connexion...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
