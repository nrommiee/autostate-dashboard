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
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
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
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-background px-6 py-12'>
      <div className='w-full max-w-sm'>
        {!success ? (
          <>
            <div className='mb-8'>
              <h1 className='text-2xl font-semibold text-foreground'>
                New password
              </h1>
              <p className='mt-2 text-muted-foreground'>
                Choose a new secure password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-1.5'>
                <Label htmlFor='password'>New password</Label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground' />
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
                    className='absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:text-foreground hover:bg-transparent'
                  >
                    {isVisible ? <EyeOffIcon className='h-5 w-5' /> : <EyeIcon className='h-5 w-5' />}
                  </Button>
                </div>
                <p className='text-xs text-muted-foreground'>Minimum 8 characters</p>
              </div>

              <div className='space-y-1.5'>
                <Label htmlFor='confirmPassword'>Confirm password</Label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground' />
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
                className='w-full'
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update password'}
              </Button>
            </form>
          </>
        ) : (
          <div className='text-center'>
            <div className='h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6'>
              <CheckCircle className='h-8 w-8 text-green-600' />
            </div>
            <h2 className='text-xl font-semibold text-foreground mb-2'>
              Password updated!
            </h2>
            <p className='text-muted-foreground'>
              You will be redirected to the login page...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
