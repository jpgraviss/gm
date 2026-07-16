import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { fetchGmailMessages, GmailFetchError } from '@/lib/gmail-fetch'

export const POST = withErrorHandler('gmail/messages POST', async (req) => {
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
