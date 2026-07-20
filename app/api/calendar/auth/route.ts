import { NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/google-calendar'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser } from '@/lib/rbac'
import { issueOAuthStateWithPayload } from '@/lib/oauth-state'

// POST /api/calendar/auth
// Body: { slug }
// Returns: { url } — redirect the browser to this URL
export const POST = withErrorHandler('calendar/auth POST', async (req) => {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { slug } = await req.json()
  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  const clientId    = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !redirectUri) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI must be set in environment variables')
  }

  // AUDIT.md #194 — `state` previously carried userEmail/userName as a
  // plain, unsigned, attacker-decodable-and-forgeable payload with nothing
  // binding it to this specific flow. Anyone could build their own Google
  // consent URL with a crafted `state` targeting a victim's email, consent
  // with their OWN Google account, and get the callback to upsert the
  // attacker's tokens into the victim's calendar_settings row — full
  // account takeover with zero GravHub access required. Now `state` only
  // carries the non-sensitive `slug`, bound via `issueOAuthStateWithPayload`
  // to a short-lived httpOnly cookie the callback verifies came from this
  // same browser/flow — and the callback re-derives userEmail/userName from
  // the caller's own verified session rather than trusting anything in the
  // round-tripped state at all, matching how #101 already hardened this
  // route to source identity from the session, not client input.
  const { state, setCookie } = issueOAuthStateWithPayload('calendar', { slug })
  const url = getGoogleAuthUrl(state)

  return setCookie(NextResponse.json({ url }))
})
