// src/app/api/qr-auth/route.ts

import { createAdminClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or email' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()

    // Générer un magic link pour cet utilisateur
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://autostate-dashboard.vercel.app'}/dashboard`
      }
    })

    if (error) {
      console.error('Error generating magic link:', error)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la génération du lien de connexion' },
        { status: 500 }
      )
    }

    // Retourner l'URL d'auth
    return NextResponse.json({
      success: true,
      authUrl: data.properties?.action_link
    })

  } catch (error) {
    console.error('QR Auth error:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
