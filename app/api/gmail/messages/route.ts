import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { fetchGmailMessages, GmailFetchError } from '@/lib/gmail-fetch'
import { getAuthenticatedEmail } from '@/lib/admin-auth'

export const POST = withErrorHandler('gmail/messages POST', async (req) => {
  // AUDIT #254 — relied solely on proxy.ts's outer gate (presence of an
  // Authorization header, not cryptographic verification) rather than its
  // own identity check, unlike sibling Gmail routes (gmail/send verifies
  // via getAuthenticatedEmail, gmail/token uses verifyOwnership).
  const callerEmail = await getAuthenticatedEmail(req)
  if (!callerEmail) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
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
