'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className='min-h-screen flex items-center justify-center bg-background px-6 py-12'>
      <div className='w-full max-w-sm'>
        <Link 
          href='/' 
          className='inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          <span>Back to login</span>
        </Link>

        {!success ? (
          <>
            <div className='mb-8'>
              <h1 className='text-2xl font-semibold text-foreground'>
                Forgot Password?
              </h1>
              <p className='mt-2 text-muted-foreground'>
                Enter your email address and we will send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='email'>Email address</Label>
                <div className='relative'>
                  <Mail className='absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                  <Input
                    id='email'
                    type='email'
                    placeholder='Enter your email address'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                className='w-full'
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          </>
        ) : (
          <div className='text-center'>
            <div className='h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6'>
              <CheckCircle className='h-8 w-8 text-green-600' />
            </div>
            <h2 className='text-xl font-semibold text-foreground mb-2'>
              Email sent!
            </h2>
            <p className='text-muted-foreground mb-6'>
              If an account exists with <strong>{email}</strong>, you will receive an email with instructions to reset your password.
            </p>
            <Link href='/'>
              <Button variant='outline' className='w-full'>
                Back to login
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
