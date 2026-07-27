import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { fetchGmailMessages, GmailFetchError } from '@/lib/gmail-fetch'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase'

export const POST = withErrorHandler('gmail/messages POST', async (req) => {
  // AUDIT #254 — relied solely on proxy.ts's outer gate (presence of an
  // Authorization header, not cryptographic verification) rather than its
  // own identity check, unlike sibling Gmail routes (gmail/send verifies
  // via getAuthenticatedEmail, gmail/token uses verifyOwnership).
  const callerEmail = await getAuthenticatedEmail(req)
  if (!callerEmail) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  // AUDIT #284 — getAuthenticatedEmail() only verifies the caller HOLDS a
  // valid session, not that team_members.status is still 'active'
  // (suspending someone doesn't revoke an existing session) — matches the
  // check gmail/token's verifyOwnership() already does.
  const db = createServiceClient()
  const { data: member } = await db.from('team_members').select('status').eq('email', callerEmail).maybeSingle()
  if (member && member.status !== 'active') {
    return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
  }

  const { accessToken, maxResults = 30, pageToken, query = '' } = await req.json()

  if (!accessToken) {
    return NextResponse.json({ error: 'accessToken is required' }, { status: 400 })
  }

  try {
    const { messages, nextPageToken } = await fetchGmailMessages(accessToken, { maxResults, pageToken, query })
    return NextResponse.json({ messages, nextPageToken })
  } catch (err) {
    const status = err instanceof GmailFetchError ? err.status : 502
    return NextResponse.json({ error: 'Gmail API error' }, { status })
  }
})
