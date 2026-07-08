import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/google-calendar'
import { createServiceClient } from '@/lib/supabase'
import { encrypt } from '@/lib/encryption'
import { withErrorHandler } from '@/lib/api-handler'

// GET /api/calendar/callback?code=...&state=...
// Handles the Google OAuth redirect, stores tokens, redirects to settings page
export const GET = withErrorHandler('calendar/callback GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin = req.nextUrl.origin

  if (error) {
    const messages: Record<string, string> = {
      access_denied: 'Calendar access was denied. Please approve all permissions when prompted.',
      invalid_scope: 'Invalid calendar permissions requested. Contact support.',
    }
    const msg = messages[error] || error
    return NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent(msg)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent('Missing authorization code. Please try connecting again.')}`)
  }

  try {
    const { userEmail, userName, slug } = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf-8'),
    )

    let tokens
    try {
      tokens = await exchangeCodeForTokens(code)
    } catch (tokenErr) {
      console.error('[calendar/callback] token exchange failed:', tokenErr)
      return NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent('Token exchange failed. Check that GOOGLE_CLIENT_SECRET is correct and the redirect URI matches Google Cloud Console.')}`)
    }

    if (!tokens.refresh_token) {
      console.error('[calendar/callback] no refresh_token returned - user may need to revoke and reconnect')
      return NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent('No refresh token received. Go to myaccount.google.com/permissions, remove GravHub, then reconnect.')}`)
    }

    const db = createServiceClient()

    const { error: dbError } = await db.from('calendar_settings').upsert({
      user_email:           userEmail,
      user_name:            userName,
      slug,
      google_refresh_token: encrypt(tokens.refresh_token),
      google_access_token:  encrypt(tokens.access_token),
      google_token_expiry:  new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: 'user_email' })

    if (dbError) {
      console.error('[calendar/callback] db upsert failed:', dbError)
      return NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent('Failed to save calendar tokens. Database error - please try again.')}`)
    }

    return NextResponse.redirect(`${origin}/settings/calendar?connected=true`)
  } catch (err) {
    console.error('[calendar/callback] unhandled error:', err)
    return NextResponse.redirect(
      `${origin}/settings/calendar?error=${encodeURIComponent('Connection failed. Check server logs for details.')}`,
    )
  }
})
