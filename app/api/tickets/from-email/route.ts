import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'
import { applyRoutingRules, notifyRoutedAssignee } from '@/lib/ticket-routing'

type Db = ReturnType<typeof createServiceClient>

async function processInbox(
  db: Db,
  gmailToken: string,
  contacts: { emails: string[] | null; company_name: string | null }[],
  companies: { name: string }[],
): Promise<{ created: number; skipped: number }> {
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:unread',
    { headers: { Authorization: `Bearer ${gmailToken}` } }
  )
  if (!listRes.ok) return { created: 0, skipped: 0 }

  const listData = await listRes.json()
  const messageIds = (listData.messages ?? []).map((m: { id: string }) => m.id)
  if (messageIds.length === 0) return { created: 0, skipped: 0 }

  const { data: processed } = await db
    .from('processed_emails')
    .select('gmail_message_id')
    .in('gmail_message_id', messageIds)
  const processedIds = new Set((processed ?? []).map(p => p.gmail_message_id))

  let created = 0
  let skipped = 0

  for (const msgId of messageIds) {
    if (processedIds.has(msgId)) { skipped++; continue }

    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
      { headers: { Authorization: `Bearer ${gmailToken}` } }
    )
    if (!msgRes.ok) { skipped++; continue }
    const msg = await msgRes.json()

    const headers = msg.payload?.headers ?? []
    type GmailHeader = { name: string; value: string }
    const fromHeader = (headers as GmailHeader[]).find((h) => h.name === 'From')?.value ?? ''
    const subject = (headers as GmailHeader[]).find((h) => h.name === 'Subject')?.value ?? 'No Subject'
    const dateHeader = (headers as GmailHeader[]).find((h) => h.name === 'Date')?.value ?? ''
    // RFC 5322 Message-ID — set by the originating mail server, identical
    // across every mailbox that received a copy of the same physical
    // email (unlike Gmail's own `id`, which is assigned per-account).
    const rfcMessageId = (headers as GmailHeader[]).find((h) => h.name.toLowerCase() === 'message-id')?.value?.trim() || null

    const emailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<]+@[^\s>]+)/)
    const senderEmail = emailMatch ? emailMatch[1].toLowerCase() : ''
    const senderName = fromHeader.replace(/<[^>]+>/, '').trim().replace(/"/g, '')

    if (senderEmail.endsWith('@gravissmarketing.com')) {
      await db.from('processed_emails').insert({
        id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        gmail_message_id: msgId,
        rfc_message_id: rfcMessageId,
      })
      skipped++
      continue
    }

    // Atomic claim before creating a ticket. gmail_message_id is unique
    // per Gmail account, so this closes the same-mailbox race (two
    // overlapping polls of one account both passing the up-front
    // processedIds check and both creating a ticket for the same
    // message). rfc_message_id is unique across every account, so it also
    // closes the cross-account race (the same physical email landing in
    // two different staff members' inboxes — e.g. a shared alias
    // forwarding to multiple people — no longer creates two tickets). The
    // old code checked-then-created-then-recorded, leaving a window
    // between the check and the ticket insert where two racing calls
    // could both pass; claiming first via a unique-constrained insert
    // makes the claim itself atomic.
    const claimId = `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const { error: claimErr } = await db.from('processed_emails').insert({
      id: claimId,
      gmail_message_id: msgId,
      rfc_message_id: rfcMessageId,
    })
    if (claimErr) {
      skipped++
      continue
    }

    let matchedCompany = ''
    for (const contact of contacts ?? []) {
      if (contact.emails?.some((e: string) => e.toLowerCase() === senderEmail)) {
        matchedCompany = contact.company_name || ''
        break
      }
    }
    if (!matchedCompany) {
      const domain = senderEmail.split('@')[1]
      for (const company of companies ?? []) {
        if (company.name?.toLowerCase().includes(domain?.split('.')[0] ?? '')) {
          matchedCompany = company.name
          break
        }
      }
    }

    let body = ''
    type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] }
    function extractText(part: GmailPart): string {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8')
      }
      if (part.parts) {
        for (const p of part.parts) {
          const text = extractText(p)
          if (text) return text
        }
      }
      return ''
    }
    body = extractText(msg.payload) || subject

    // A malformed/non-standard RFC 2822 Date header makes new Date(...)
    // return Invalid Date, and .toISOString() on that throws RangeError —
    // which previously escaped this loop entirely, aborting processing of
    // every remaining unread message in the account for this poll.
    const parsedDate = dateHeader ? new Date(dateHeader) : new Date()
    const createdDate = (Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate).toISOString().split('T')[0]

    // AUDIT #518 — inbound-email tickets used to insert directly with
    // assigned_to hardcoded to '', never calling applyRoutingRules() (the
    // function the staff/portal creation path uses to auto-assign by
    // rep/service-unit and escalate Urgent/High priority to Leadership).
    // Every ticket auto-created from an unread support email landed
    // permanently unassigned with nobody notified. Mirrors POST /api/tickets
    // exactly — Medium priority and 'General' service type are what an
    // email-created ticket already implicitly used (no priority/serviceType
    // signal exists in an inbound email), so routing resolves the same way
    // a staff-created ticket with those same defaults would.
    const routing = await applyRoutingRules(db, matchedCompany || 'Unknown', 'Medium', 'General')

    const ticketId = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const { error: ticketErr } = await db.from('tickets').insert({
      id: ticketId,
      subject,
      company: matchedCompany || 'Unknown',
      // AUDIT #526 — never set, so mapTicket() always returned
      // contactName: '' for email-imported tickets. app/tickets/page.tsx
      // uses `msg.author === ticket.contactName` to decide client-styling
      // (gray) vs. staff-reply styling (green) — with contactName always
      // '', the client's own first message never matched and rendered as
      // if staff had already replied. Also fed the Contact-field display,
      // contact-name search, and the #486 reply-notification's preferred
      // (contactEmail) lookup, all of which silently degraded without this.
      contact_email: senderEmail || null,
      contact_name: senderName || senderEmail || null,
      status: 'Open',
      priority: 'Medium',
      source: 'Email',
      assigned_to: routing?.name ?? '',
      created_date: createdDate,
      tags: [],
      // Field names must match what mapTicket()/the tickets UI actually
      // read (body/timestamp/isInternal, see app/api/tickets/route.ts and
      // app/tickets/page.tsx) — this previously wrote text/date/internal,
      // so every email-created ticket rendered with a blank first message
      // and no timestamp in the staff UI.
      messages: [{
        id: `msg-${Date.now()}`,
        author: senderName || senderEmail,
        body: body.slice(0, 5000),
        timestamp: new Date().toISOString(),
        isInternal: false,
      }],
      gmail_message_id: msgId,
    })

    if (ticketErr) {
      // The processed_emails claim above already committed atomically —
      // if ticket creation itself then fails, release that claim instead
      // of leaving it permanently marked processed with no ticket ever
      // created (which would silently drop the email forever). Deleting
      // it lets the next poll re-fetch and retry this same message.
      console.error(`[tickets/from-email] ticket insert failed for ${msgId}:`, ticketErr.message)
      await db.from('processed_emails').delete().eq('id', claimId)
      skipped++
      continue
    }

    await db.from('processed_emails').update({ ticket_id: ticketId }).eq('id', claimId)
    await notifyRoutedAssignee(db, routing, subject, matchedCompany || 'Unknown')

    created++
  }

  return { created, skipped }
}

export const POST = withErrorHandler('tickets/from-email POST', async (req: NextRequest) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  if (!isCron) {
    const denied = await requireRole(req, 'Team Member')
    if (denied) return denied
  }

  const db = createServiceClient()

  // Gmail tokens are per-user on team_members — there is no shared/global
  // inbox concept. This previously queried a non-existent
  // app_settings.gmail_access_token column and failed 100% of the time,
  // silently, on every cron tick. Instead, check unread mail across every
  // team member who currently has a connected, non-expired Gmail account —
  // each connected mailbox is effectively a monitored support inbox.
  const { data: staffWithGmail } = await db
    .from('team_members')
    .select('id, email, gmail_access_token, gmail_token_expires_at')
    .not('gmail_access_token', 'is', null)

  const now = Date.now()
  const validAccounts = (staffWithGmail ?? []).filter(s => {
    if (!s.gmail_access_token) return false
    if (!s.gmail_token_expires_at) return true
    return new Date(s.gmail_token_expires_at).getTime() > now + 5 * 60 * 1000
  })

  if (validAccounts.length === 0) {
    return NextResponse.json({ error: 'No team member has a connected, unexpired Gmail account' }, { status: 400 })
  }

  const { data: contacts } = await db.from('crm_contacts').select('emails, company_name, full_name')
  const { data: companies } = await db.from('crm_companies').select('name')

  let created = 0
  let skipped = 0
  const perAccountErrors: string[] = []

  for (const account of validAccounts) {
    try {
      const result = await processInbox(db, account.gmail_access_token as string, contacts ?? [], companies ?? [])
      created += result.created
      skipped += result.skipped
    } catch (err) {
      perAccountErrors.push(`${account.email}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return NextResponse.json({ created, skipped, accountsChecked: validAccounts.length, errors: perAccountErrors })
})
