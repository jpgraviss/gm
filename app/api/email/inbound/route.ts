import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { verifyResendSignature } from '@/lib/webhook-verify'

/**
 * HubSpot-style "BCC to log" capture. Each team member has a personal
 * bcc_email (team_members.bcc_email) — BCC'ing it on any outbound email logs
 * that email as an activity against the matching CRM contact and company.
 *
 * Requires Resend Inbound to be configured on a dedicated subdomain (can't
 * reuse the existing outbound sending domain, which already carries SPF/DKIM
 * and likely shares MX with real company mail) — see .env.local.example for
 * the RESEND_WEBHOOK_SECRET this route verifies against.
 *
 * NOTE: Resend's inbound webhook payload shape is asserted defensively below
 * (multiple field-name fallbacks) since it can't be verified against a live
 * payload from this environment. If nothing logs once DNS/inbound routing is
 * live, check Sentry for this route's captured exceptions/payload shape and
 * adjust the field extraction below to match what's actually delivered.
 */

interface InboundHeader {
  name: string
  value: string
}

interface InboundPayload {
  type?: string
  data?: {
    email_id?: string
    message_id?: string
    from?: string | { email?: string; name?: string }
    to?: Array<string | { email?: string; name?: string }> | string
    cc?: Array<string | { email?: string; name?: string }> | string
    subject?: string
    text?: string
    html?: string
    headers?: InboundHeader[]
  }
}

function extractEmail(value: string | { email?: string; name?: string } | undefined): string | null {
  if (!value) return null
  if (typeof value === 'object') return value.email?.toLowerCase() ?? null
  const match = value.match(/<([^>]+)>/) ?? value.match(/([^\s<]+@[^\s>]+)/)
  return match ? match[1].toLowerCase() : value.toLowerCase()
}

function extractEmailList(value: Array<string | { email?: string; name?: string }> | string | undefined): string[] {
  if (!value) return []
  const list = Array.isArray(value) ? value : value.split(',')
  return list.map(v => extractEmail(v)).filter((e): e is string => !!e)
}

function extractHeader(headers: InboundHeader[] | undefined, name: string): string | null {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? null
}

export const POST = withErrorHandler('email/inbound POST', async (req) => {
  const rawBody = await req.text()

  // This route is intentionally public (Resend has no session to authenticate
  // with) and writes directly into CRM activity records — the webhook
  // signature is the ONLY thing standing between this and an attacker who
  // knows a team member's bcc_email injecting fabricated activity content.
  // Fail closed if the secret isn't configured, same as SESSION_SIGNING_KEY.
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_WEBHOOK_SECRET must be set in production')
    }
    console.warn('[email/inbound] RESEND_WEBHOOK_SECRET not set — accepting unsigned payloads (dev only)')
  } else if (!verifyResendSignature(rawBody, req, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: InboundPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data = payload.data
  if (!data) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'No data in payload' })
  }

  const messageId = data.email_id ?? data.message_id ?? extractHeader(data.headers, 'Message-ID')
  if (!messageId) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'No message id — cannot dedupe safely' })
  }

  const db = createServiceClient()

  // Dedupe — Resend/Svix may retry delivery.
  const { data: existing } = await db
    .from('bcc_processed_emails')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Already processed' })
  }

  // Which team member's personal BCC address received this?
  const recipients = [
    ...extractEmailList(data.to),
    ...extractEmailList(data.cc),
  ]
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'No recipient addresses found in payload' })
  }

  const { data: staffRows } = await db
    .from('team_members')
    .select('id, name, email, bcc_email')
    .not('bcc_email', 'is', null)

  const matchedStaff = (staffRows ?? []).find(s => s.bcc_email && recipients.includes(s.bcc_email.toLowerCase()))
  if (!matchedStaff) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'No matching team member BCC address' })
  }

  // Who's the external party? (whichever recipient isn't the BCC address itself)
  const fromEmail = extractEmail(data.from)
  if (!fromEmail) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Could not parse sender email' })
  }

  const externalCandidates = fromEmail === matchedStaff.email?.toLowerCase()
    ? recipients.filter(r => r !== matchedStaff.bcc_email?.toLowerCase())
    : [fromEmail]
  const externalEmail = externalCandidates[0]

  let contactId: string | null = null
  let companyId: string | null = null
  let contactName: string | null = null

  if (externalEmail) {
    const { data: contact } = await db
      .from('crm_contacts')
      .select('id, full_name, company_id')
      .contains('emails', [externalEmail])
      .maybeSingle()
    if (contact) {
      contactId = contact.id
      companyId = contact.company_id
      contactName = contact.full_name
    }
  }

  const subject = data.subject ?? '(no subject)'
  const body = data.text ?? (data.html ? data.html.replace(/<[^>]+>/g, ' ').trim() : '')

  const activityId = `bcc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { error: insertErr } = await db.from('crm_activities').insert({
    id: activityId,
    type: 'email',
    title: subject,
    body: body.slice(0, 5000),
    company_id: companyId,
    contact_id: contactId,
    contact_name: contactName,
    user_name: matchedStaff.name,
    timestamp: new Date().toISOString(),
  })

  if (insertErr) {
    throw new Error(insertErr.message)
  }

  await db.from('bcc_processed_emails').insert({
    id: `bpe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message_id: messageId,
    activity_id: activityId,
  })

  return NextResponse.json({
    ok: true,
    logged: true,
    matchedContact: !!contactId,
    matchedCompany: !!companyId,
  })
})
