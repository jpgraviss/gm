import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase'
import { resolveGmailSettings } from '@/lib/gmail-settings'
import { extractEmailAddress } from '@/lib/gmail-fetch'
import { sendPushNotification } from '@/lib/push-notifications'

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
  const { data: member } = await db
    .from('team_members')
    .select('id, name, status, gmail_email, gmail_settings')
    .eq('email', callerEmail)
    .maybeSingle()
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

    // ── AUDIT.md #407 — autoLogInbound / notifyOnReply enforcement. Opening
    // a message here (full headers + threadId available) is the real
    // "inbound" checkpoint for the native Gmail-connected inbox — there's no
    // background sync/webhook for it (app/inbox/page.tsx always fetches
    // live from the Gmail API on demand, never mirrors into Postgres), so
    // this fires once per message the user actually opens, not the instant
    // it arrives. Best-effort throughout: a failure here must never turn a
    // successful message-detail fetch into an error response.
    if (member) {
      const selfEmail = (member.gmail_email ?? callerEmail).toLowerCase()
      const senderEmail = extractEmailAddress(headers['from'] ?? '')
      if (senderEmail && senderEmail !== selfEmail) {
        const gmailSettings = resolveGmailSettings(member.gmail_settings)
        try {
          if (gmailSettings.autoLogInbound || gmailSettings.notifyOnReply) {
            const { data: contact } = await db
              .from('crm_contacts')
              .select('id, company_id, full_name')
              .contains('emails', [senderEmail])
              .maybeSingle()

            if (gmailSettings.autoLogInbound && contact?.id) {
              const { error: logErr } = await db.from('crm_activities').insert({
                id: `gmail_${msg.id}`,
                type: 'email',
                title: `Email: ${headers['subject'] ?? '(no subject)'}`,
                company_id: contact.company_id,
                contact_id: contact.id,
                contact_name: contact.full_name ?? null,
                user_name: member.name ?? 'System',
                timestamp: new Date().toISOString(),
              })
              // 23505 = already logged (manually via the Inbox "Log as
              // Activity" button, or a previous auto-log pass) — not a
              // real failure.
              if (logErr && logErr.code !== '23505') {
                console.error('[gmail/message] auto-log-inbound failed:', logErr)
              }
            }

            if (gmailSettings.notifyOnReply) {
              const { data: threadSend } = await db
                .from('tracked_emails')
                .select('id')
                .eq('team_member_id', member.id)
                .eq('thread_id', msg.threadId)
                .is('replied_at', null)
                .maybeSingle()
              if (threadSend) {
                await db.from('tracked_emails').update({ replied_at: new Date().toISOString() }).eq('id', threadSend.id)
                await sendPushNotification({
                  userId: member.id,
                  title: 'Reply received',
                  body: `${senderEmail} replied: ${headers['subject'] ?? '(no subject)'}`,
                  url: '/inbox',
                }).catch(() => {})
              }
            }
          }
        } catch (err) {
          console.error('[gmail/message] autoLogInbound/notifyOnReply enforcement failed:', err)
        }
      }
    }

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
