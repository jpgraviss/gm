import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/google-calendar'
import { createServiceClient } from '@/lib/supabase'
import { encrypt } from '@/lib/encryption'

// GET /api/calendar/callback?code=...&state=...
// Handles the Google OAuth redirect, stores tokens, redirects to settings page
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin = req.nextUrl.origin

  if (error) {
    return NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings/calendar?error=missing_params`)
  }

  try {
    // Decode state
    const { userEmail, userName, slug } = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf-8'),
    )

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    const db = createServiceClient()

    // Upsert calendar_settings row
    const { error: dbError } = await db.from('calendar_settings').upsert({
      user_email:           userEmail,
      user_name:            userName,
      slug,
      google_refresh_token: encrypt(tokens.refresh_token),
      google_access_token:  encrypt(tokens.access_token),
      google_token_expiry:  new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: 'user_email' })

    if (dbError) {
      console.error('[calendar/callback GET]', dbError)
      return NextResponse.redirect(`${origin}/settings/calendar?error=connection_failed`)
    }

    return NextResponse.redirect(`${origin}/settings/calendar?connected=true`)
  } catch (err) {
    console.error('[calendar/callback GET]', err)
    return NextResponse.redirect(
      `${origin}/settings/calendar?error=connection_failed`,
    )
  }
}
