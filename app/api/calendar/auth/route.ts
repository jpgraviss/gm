import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/google-calendar'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser } from '@/lib/rbac'

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

  // userEmail/userName come from the caller's own verified session, never
  // the request body — previously any authenticated staff member could
  // pass an arbitrary userEmail here, complete the OAuth flow with their
  // OWN Google account, and silently redirect a victim's public booking
  // link to create events on the attacker's calendar instead, with zero
  // victim interaction required.
  const state = Buffer.from(JSON.stringify({ userEmail: user.email, userName: user.name, slug })).toString('base64url')
  const url   = getGoogleAuthUrl(state)

  return NextResponse.json({ url })
})
