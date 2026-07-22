import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase'

function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractBody(payload: GmailPayload): { text: string; html: string } {
  if (!payload) return { text: '', html: '' }

  // Plain text only
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return { text: decodeBase64Url(payload.body.data), html: '' }
  }
  // HTML only
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    const rawHtml = decodeBase64Url(payload.body.data)
    return { text: stripHtml(rawHtml), html: rawHtml }
  }

  // Multipart — prefer returning both text and html when available
  if (payload.parts) {
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')

    const text = textPart?.body?.data ? decodeBase64Url(textPart.body.data) : ''
    const html = htmlPart?.body?.data ? decodeBase64Url(htmlPart.body.data) : ''

    if (text || html) {
      return {
        text: text || stripHtml(html),
        html,
      }
    }

    // Nested multipart
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested.text || nested.html) return nested
    }
  }

  return { text: '', html: '' }
}

interface GmailPayload {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPayload[]
  headers?: { name: string; value: string }[]
}

export const POST = withErrorHandler('gmail/message POST', async (req) => {
  // AUDIT #254 — same identity-check gap as gmail/messages POST.
  const callerEmail = await getAuthenticatedEmail(req)
  if (!callerEmail) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  // AUDIT #284 — same suspended-status gap as gmail/messages POST.
  const db = createServiceClient()
  const { data: member } = await db.from('team_members').select('status').eq('email', callerEmail).maybeSingle()
  if (member && member.status !== 'active') {
    return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
  }

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

    const { text, html } = extractBody(msg.payload ?? {})

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
      body: text,
      bodyHtml: html || undefined,
    })
  } catch (err) {
    throw err instanceof Error ? err : new Error('Operation failed')
  }
})
