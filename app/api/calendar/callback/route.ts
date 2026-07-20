import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/google-calendar'
import { createServiceClient } from '@/lib/supabase'
import { encrypt } from '@/lib/encryption'
import { withErrorHandler } from '@/lib/api-handler'
import { verifyOAuthStateWithPayload } from '@/lib/oauth-state'
import { getAuthUser } from '@/lib/rbac'

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

  // AUDIT.md #194 — `state` used to be trusted as-is, carrying an unsigned,
  // attacker-forgeable userEmail that decided whose calendar_settings row
  // got overwritten. `verifyOAuthStateWithPayload` confirms this callback
  // is a continuation of a flow this server itself issued in this same
  // browser (the httpOnly cookie `/api/calendar/auth` set can't be forged
  // by a third party who skips straight to building their own Google
  // consent URL). Identity is re-derived from the caller's own verified
  // session below, never from the state payload — the payload only ever
  // carries the non-sensitive `slug`.
  const { valid, payload, clearCookie } = verifyOAuthStateWithPayload<{ slug?: string }>(req, 'calendar', state)
  if (!valid) {
    return clearCookie(NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent('Invalid or expired connection attempt. Please try connecting again.')}`))
  }

  const user = await getAuthUser(req)
  if (!user) {
    return clearCookie(NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent('Your session expired during the connection attempt. Please sign in and try again.')}`))
  }

  const slug = payload?.slug
  if (!slug) {
    return clearCookie(NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent('Missing calendar slug. Please try connecting again.')}`))
  }

  const userEmail = user.email
  const userName  = user.name

  try {
    let tokens
    try {
      tokens = await exchangeCodeForTokens(code)
    } catch (tokenErr) {
      console.error('[calendar/callback] token exchange failed:', tokenErr)
      return clearCookie(NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent('Token exchange failed. Check that GOOGLE_CLIENT_SECRET is correct and the redirect URI matches Google Cloud Console.')}`))
    }

    if (!tokens.refresh_token) {
      console.error('[calendar/callback] no refresh_token returned - user may need to revoke and reconnect')
      return clearCookie(NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent('No refresh token received. Go to myaccount.google.com/permissions, remove GravHub, then reconnect.')}`))
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
      return clearCookie(NextResponse.redirect(`${origin}/settings/calendar?error=${encodeURIComponent('Failed to save calendar tokens. Database error - please try again.')}`))
    }

    return clearCookie(NextResponse.redirect(`${origin}/settings/calendar?connected=true`))
  } catch (err) {
    console.error('[calendar/callback] unhandled error:', err)
    return clearCookie(NextResponse.redirect(
      `${origin}/settings/calendar?error=${encodeURIComponent('Connection failed. Check server logs for details.')}`,
    ))
  }
})
