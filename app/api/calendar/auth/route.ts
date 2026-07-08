import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/google-calendar'
import { withErrorHandler } from '@/lib/api-handler'

// POST /api/calendar/auth
// Body: { userEmail, userName, slug }
// Returns: { url } — redirect the browser to this URL
export const POST = withErrorHandler('calendar/auth POST', async (req) => {
  const { userEmail, userName, slug } = await req.json()
  if (!userEmail || !slug) {
    return NextResponse.json({ error: 'userEmail and slug are required' }, { status: 400 })
  }

  const clientId    = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !redirectUri) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI must be set in environment variables')
  }

  // Encode user info in the state param so the callback knows who to link the token to
  const state = Buffer.from(JSON.stringify({ userEmail, userName, slug })).toString('base64url')
  const url   = getGoogleAuthUrl(state)

  return NextResponse.json({ url })
})
