import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { issueOAuthState } from '@/lib/oauth-state'
import { getGmailAuthUrl } from '@/lib/gmail-oauth'
import { assertGoogleOAuthConfigured } from '@/lib/google-oauth-config'

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

  // AUDIT #784 — also checks NEXT_PUBLIC_APP_URL, without which this flow
  // silently asked Google to return to localhost and failed on Google's own
  // screen with nothing logged here.
  assertGoogleOAuthConfigured()

  const { state, setCookie } = issueOAuthState('gmail')
  return setCookie(NextResponse.json({ url: getGmailAuthUrl(state) }))
})
