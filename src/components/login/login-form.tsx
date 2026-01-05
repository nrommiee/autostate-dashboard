'use client'

import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginFormProps {
  email: string
  setEmail: (email: string) => void
  password: string
  setPassword: (password: string) => void
  error: string
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
}

const LoginForm = ({
  email,
  setEmail,
  password,
  setPassword,
  error,
  loading,
  onSubmit
}: LoginFormProps) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  return (
    <form className='space-y-4' onSubmit={onSubmit}>
      {/* Email */}
      <div className='space-y-1.5'>
        <Label className='text-sm font-medium' htmlFor='userEmail'>
          Adresse email
        </Label>
        <Input 
          type='email' 
          id='userEmail' 
          placeholder='votre@email.com'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className='h-11'
        />
      </div>

      {/* Password */}
      <div className='space-y-1.5'>
        <Label className='text-sm font-medium' htmlFor='password'>
          Mot de passe
        </Label>
        <div className='relative'>
          <Input 
            id='password' 
            type={isPasswordVisible ? 'text' : 'password'} 
            placeholder='••••••••••••'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className='h-11 pr-11'
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => setIsPasswordVisible(prev => !prev)}
            className='absolute inset-y-0 right-0 h-full px-3 text-gray-400 hover:text-gray-600 hover:bg-transparent'
          >
            {isPasswordVisible ? <EyeOffIcon className='w-5 h-5' /> : <EyeIcon className='w-5 h-5' />}
            <span className='sr-only'>{isPasswordVisible ? 'Masquer' : 'Afficher'}</span>
          </Button>
        </div>
      </div>

      {/* Remember Me and Forgot Password */}
      <div className='flex items-center justify-end'>
        <a 
          href='/forgot-password' 
          className='text-sm text-teal-600 hover:text-teal-700 hover:underline'
        >
          Mot de passe oublié ?
        </a>
      </div>

      {/* Error */}
      {error && (
        <div className='text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100'>
          {error}
        </div>
      )}

      {/* Submit */}
      <Button 
        className='w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-medium' 
        type='submit'
        disabled={loading}
      >
        {loading ? 'Connexion en cours...' : 'Se connecter'}
      </Button>
    </form>
  )
}

export default LoginForm
