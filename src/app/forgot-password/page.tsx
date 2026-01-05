'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AutoStateLogo from '@/components/login/logo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12'>
      <div className='w-full max-w-sm'>
        {/* Back Link */}
        <Link 
          href='/' 
          className='inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-8 transition-colors'
        >
          <ArrowLeft className='w-4 h-4' />
          <span>Retour à la connexion</span>
        </Link>

        {/* Logo */}
        <div className='mb-8'>
          <AutoStateLogo />
        </div>

        {!success ? (
          <>
            {/* Header */}
            <div className='mb-8'>
              <h1 className='text-2xl font-semibold text-gray-900'>
                Mot de passe oublié ?
              </h1>
              <p className='mt-2 text-gray-500'>
                Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='email'>Adresse email</Label>
                <div className='relative'>
                  <Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
                  <Input
                    id='email'
                    type='email'
                    placeholder='votre@email.com'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className='h-11 pl-10'
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
                className='w-full h-11 bg-teal-600 hover:bg-teal-700'
                disabled={loading}
              >
                {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
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
              Email envoyé !
            </h2>
            <p className='text-gray-500 mb-6'>
              Si un compte existe avec l'adresse <strong>{email}</strong>, vous recevrez un email avec les instructions pour réinitialiser votre mot de passe.
            </p>
            <Link href='/'>
              <Button variant='outline' className='w-full'>
                Retour à la connexion
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
