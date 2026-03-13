import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { accessToken, maxResults = 30, pageToken, query = '' } = await req.json()

    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken is required' }, { status: 400 })
    }

    const params = new URLSearchParams({ maxResults: String(maxResults) })
    if (pageToken) params.set('pageToken', pageToken)
    if (query) params.set('q', query)

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!listRes.ok) {
      const err = await listRes.json()
      console.error('[gmail/messages POST]', err)
      return NextResponse.json({ error: 'Gmail API error' }, { status: listRes.status })
    }

    const listData = await listRes.json() as { messages?: { id: string; threadId: string }[]; nextPageToken?: string }
    const messageIds = listData.messages ?? []

    // Fetch metadata for each message in parallel (capped at 20)
    const batch = messageIds.slice(0, 20)
    const details = await Promise.all(
      batch.map(async ({ id }) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!msgRes.ok) return null
        const msg = await msgRes.json() as {
          id: string
          threadId: string
          snippet: string
          labelIds?: string[]
          payload?: { headers?: { name: string; value: string }[] }
          internalDate?: string
        }

        const headers: Record<string, string> = {}
        for (const h of msg.payload?.headers ?? []) {
          headers[h.name.toLowerCase()] = h.value
        }

        return {
          id: msg.id,
          threadId: msg.threadId,
          snippet: msg.snippet ?? '',
          labelIds: msg.labelIds ?? [],
          from: headers['from'] ?? '',
          to: headers['to'] ?? '',
          subject: headers['subject'] ?? '(no subject)',
          date: headers['date'] ?? '',
          internalDate: msg.internalDate ?? '',
        }
      })
    )

    return NextResponse.json({
      messages: details.filter(Boolean),
      nextPageToken: listData.nextPageToken ?? null,
    })
  } catch (err) {
    console.error('[gmail/messages]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
