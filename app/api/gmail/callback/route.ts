import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { encrypt } from '@/lib/encryption'
import { getAuthUser } from '@/lib/rbac'
import { verifyOAuthState } from '@/lib/oauth-state'
import { exchangeGmailCode } from '@/lib/gmail-oauth'

/**
 * GET /api/gmail/callback — completes the server-side Gmail OAuth flow.
 *
 * Stores the refresh token that the old browser flow could never obtain, so
 * the inbox poller and sequence reply-detection keep working past the first
 * hour instead of silently going dark (AUDIT #23, #37).
 */
export const GET = withErrorHandler('gmail/callback GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const origin = req.nextUrl.origin
  // Back to the Integrations tab of Settings, which is where the Connect
  // Gmail button lives — not /settings/email-auth, which is the SPF/DKIM
  // page and has no Gmail UI to report a result into.
  const back = (msg: string, ok = false) =>
    NextResponse.redirect(
      `${origin}/settings?tab=integrations&${ok ? 'gmail' : 'gmail_error'}=${encodeURIComponent(msg)}`,
    )

  if (error) {
    return back(error === 'access_denied'
      ? 'Gmail access was denied. Approve all requested permissions to connect.'
      : error)
  }
  if (!code || !state) {
    return back('Missing authorization code. Please try connecting again.')
  }

  // Same defense as the calendar flow (#194): proves this callback continues
  // a flow this server started in this browser. Identity comes from the
  // session below, never from the URL.
  const { valid, clearCookie } = verifyOAuthState(req, 'gmail', state)
  if (!valid) {
    return clearCookie(back('Invalid or expired connection attempt. Please try connecting again.'))
  }

  const user = await getAuthUser(req)
  if (!user) {
    return clearCookie(back('Your session expired during the connection. Please sign in and try again.'))
  }

  try {
    const tokens = await exchangeGmailCode(code)

    // No refresh token means the whole point of this flow was missed —
    // usually a stale grant where Google skipped re-consent. Say so plainly
    // rather than storing a token that will die in an hour and look like a
    // successful connection.
    if (!tokens.refresh_token) {
      return clearCookie(back(
        'Google did not return a refresh token. Remove GravHub at myaccount.google.com/permissions, then connect again.',
      ))
    }

    const db = createServiceClient()
    const { error: updateErr } = await db
      .from('team_members')
      .update({
        gmail_access_token: encrypt(tokens.access_token),
        gmail_refresh_token: encrypt(tokens.refresh_token),
        gmail_token_expires_at: new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString(),
        gmail_email: user.email,
      })
      // Keyed on the caller's own verified team_members id — never on
      // anything carried in the OAuth state, per #194.
      .eq('id', user.userId)

    if (updateErr) {
      console.error('[gmail/callback] failed to store tokens:', updateErr.message)
      return clearCookie(back('Connected to Google, but saving the connection failed. Please try again.'))
    }

    return clearCookie(back('Gmail connected', true))
  } catch (err) {
    console.error('[gmail/callback] token exchange failed:', err instanceof Error ? err.message : err)
    return clearCookie(back('Could not complete the Gmail connection. Please try again.'))
  }
})
