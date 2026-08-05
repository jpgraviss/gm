import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { issueOAuthState } from '@/lib/oauth-state'
import { getGmailAuthUrl, isGmailOAuthConfigured } from '@/lib/gmail-oauth'

/**
 * GET /api/gmail/auth — starts the server-side Gmail OAuth flow (AUDIT #23).
 *
 * Replaces the in-browser Google Identity Services token client, which could
 * never return a refresh token, so every Gmail connection died after ~1 hour.
 *
 * The signed state cookie is the same CSRF defense AUDIT #194 added to the
 * calendar flow: the callback must be able to prove it's a continuation of a
 * flow this server issued in this same browser, and identity is re-derived
 * there from the caller's own session — never from anything in the URL.
 */
export const GET = withErrorHandler('gmail/auth GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  if (!isGmailOAuthConfigured()) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured on this server — GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set.' },
      { status: 400 },
    )
  }

  const { state, setCookie } = issueOAuthState('gmail')
  return setCookie(NextResponse.json({ url: getGmailAuthUrl(state) }))
})
