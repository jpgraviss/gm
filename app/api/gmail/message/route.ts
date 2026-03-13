import { NextRequest, NextResponse } from 'next/server'

function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

function extractBody(payload: GmailPayload): string {
  if (!payload) return ''

  // Plain text preferred, then html
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    // Strip basic HTML tags
    return decodeBase64Url(payload.body.data)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Multipart — recurse into parts
  if (payload.parts) {
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
    if (textPart?.body?.data) return decodeBase64Url(textPart.body.data)

    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) {
      return decodeBase64Url(htmlPart.body.data)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Nested multipart
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }

  return ''
}

interface GmailPayload {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPayload[]
  headers?: { name: string; value: string }[]
}

export async function POST(req: NextRequest) {
  try {
    const { accessToken, id } = await req.json()

    if (!accessToken || !id) {
      return NextResponse.json({ error: 'accessToken and id are required' }, { status: 400 })
    }

    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!msgRes.ok) {
      const err = await msgRes.json()
      console.error('[gmail/message POST]', err)
      return NextResponse.json({ error: 'Gmail API error' }, { status: msgRes.status })
    }

    const msg = await msgRes.json() as {
      id: string
      threadId: string
      snippet: string
      labelIds?: string[]
      payload?: GmailPayload
      internalDate?: string
    }

    const headers: Record<string, string> = {}
    for (const h of msg.payload?.headers ?? []) {
      headers[h.name.toLowerCase()] = h.value
    }

    const body = extractBody(msg.payload ?? {})

    return NextResponse.json({
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet ?? '',
      labelIds: msg.labelIds ?? [],
      from: headers['from'] ?? '',
      to: headers['to'] ?? '',
      subject: headers['subject'] ?? '(no subject)',
      date: headers['date'] ?? '',
      internalDate: msg.internalDate ?? '',
      body,
    })
  } catch (err) {
    console.error('[gmail/message]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
