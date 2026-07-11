import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

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

    const emailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<]+@[^\s>]+)/)
    const senderEmail = emailMatch ? emailMatch[1].toLowerCase() : ''
    const senderName = fromHeader.replace(/<[^>]+>/, '').trim().replace(/"/g, '')

    if (senderEmail.endsWith('@gravissmarketing.com')) {
      await db.from('processed_emails').insert({
        id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        gmail_message_id: msgId,
      })
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

    const ticketId = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    await db.from('tickets').insert({
      id: ticketId,
      subject,
      company: matchedCompany || 'Unknown',
      status: 'Open',
      priority: 'Medium',
      source: 'Email',
      assigned_to: '',
      created_date: dateHeader ? new Date(dateHeader).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      tags: [],
      messages: [{
        id: `msg-${Date.now()}`,
        author: senderName || senderEmail,
        text: body.slice(0, 5000),
        date: new Date().toISOString(),
        internal: false,
      }],
      gmail_message_id: msgId,
    })

    await db.from('processed_emails').insert({
      id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      gmail_message_id: msgId,
      ticket_id: ticketId,
    })

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
