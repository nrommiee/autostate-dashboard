'use client'

import { QRCodeSVG } from 'qrcode.react'
import { Smartphone, RefreshCw } from 'lucide-react'

interface QRCodeSectionProps {
  qrToken: string | null
  qrStatus: 'idle' | 'loading' | 'ready' | 'approved' | 'expired' | 'error'
  timeLeft: number
  onRegenerate: () => void
}

const QRCodeSection = ({
  qrToken,
  qrStatus,
  timeLeft,
  onRegenerate
}: QRCodeSectionProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const qrValue = qrToken ? `autostate://auth?token=${qrToken}` : ''

  return (
    <div className='text-center space-y-4'>
      <div className='flex items-center justify-center gap-2 text-gray-700'>
        <Smartphone className='w-5 h-5' />
        <span className='font-medium'>Connexion avec l'app</span>
      </div>
      <p className='text-sm text-gray-500'>
        Scannez ce QR code depuis l'application AutoState
      </p>

      {/* QR Code Container */}
      <div className='flex justify-center'>
        {qrStatus === 'loading' && (
          <div className='w-40 h-40 flex items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200'>
            <RefreshCw className='w-8 h-8 text-gray-400 animate-spin' />
          </div>
        )}

        {qrStatus === 'ready' && qrToken && (
          <div className='p-3 bg-white rounded-xl shadow-sm border border-gray-100'>
            <QRCodeSVG
              value={qrValue}
              size={144}
              level='M'
              includeMargin={false}
              fgColor='#0d9488'
            />
          </div>
        )}

        {qrStatus === 'approved' && (
          <div className='w-40 h-40 flex flex-col items-center justify-center bg-green-50 rounded-xl border border-green-200'>
            <svg className='w-12 h-12 text-green-500 mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
            </svg>
            <span className='text-green-600 font-medium text-sm'>Connexion...</span>
          </div>
        )}

        {qrStatus === 'expired' && (
          <div className='w-40 h-40 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-gray-200'>
            <svg className='w-10 h-10 text-gray-400 mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' />
            </svg>
            <span className='text-gray-500 text-sm mb-2'>Code expiré</span>
            <button
              onClick={onRegenerate}
              className='text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1 transition-colors'
            >
              <RefreshCw className='w-4 h-4' />
              Régénérer
            </button>
          </div>
        )}

        {qrStatus === 'error' && (
          <div className='w-40 h-40 flex flex-col items-center justify-center bg-red-50 rounded-xl border border-red-100'>
            <svg className='w-10 h-10 text-red-400 mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
            </svg>
            <span className='text-red-500 text-sm mb-2'>Erreur</span>
            <button
              onClick={onRegenerate}
              className='text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1 transition-colors'
            >
              <RefreshCw className='w-4 h-4' />
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* Timer */}
      {qrStatus === 'ready' && timeLeft > 0 && (
        <p className='text-xs text-gray-400'>
          Expire dans <span className='font-medium text-gray-500'>{formatTime(timeLeft)}</span>
        </p>
      )}
    </div>
  )
}

export default QRCodeSection
