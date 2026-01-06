// src/components/ImpersonationBanner.tsx
// Yellow banner shown when admin is impersonating a user

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getImpersonationSession, endImpersonation, ImpersonationSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { X, Eye, ArrowLeft } from 'lucide-react'

export default function ImpersonationBanner() {
  const router = useRouter()
  const [session, setSession] = useState<ImpersonationSession | null>(null)

  useEffect(() => {
    const impersonation = getImpersonationSession()
    if (impersonation.isImpersonating) {
      setSession(impersonation)
    }
  }, [])

  const handleEndImpersonation = async () => {
    await endImpersonation()
    setSession(null)
    router.push('/dashboard/users')
  }

  if (!session?.isImpersonating) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-400 text-amber-900 py-2 px-4 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">
            Vous êtes connecté en tant que{' '}
            <strong>{session.targetUser?.full_name || session.targetUser?.email}</strong>
            {session.targetUser?.role && (
              <span className="ml-2 px-2 py-0.5 bg-amber-500/30 rounded text-xs uppercase">
                {session.targetUser.role}
              </span>
            )}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-75 mr-2">
            Admin: {session.adminEmail}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEndImpersonation}
            className="h-7 px-3 bg-amber-500/30 hover:bg-amber-500/50 text-amber-900"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Retour admin
          </Button>
        </div>
      </div>
    </div>
  )
}
