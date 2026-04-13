import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * Unified inbox — aggregates conversations across every channel the user
 * touches so they have one view for all client communication.
 *
 * Sources merged here:
 *  1. Tickets (+ ticket messages)
 *  2. Sequence activities (opens/clicks/replies/bounces/sent)
 *  3. Broadcast recipients (engagement events)
 *  4. CRM activity log entries of type Email, Call, Meeting, Note
 *
 * Gmail is handled separately on the client because it streams live from
 * the Gmail API — we don't mirror Gmail messages into Postgres. The page
 * layer merges the Gmail thread list with the unified threads from here.
 *
 * Grouped by contact email (case-insensitive). Returns the most recent
 * message per contact, ordered by recency.
 */

interface UnifiedThread {
  contactEmail: string
  contactName: string
  company?: string
  lastMessage: {
    source: 'ticket' | 'sequence' | 'broadcast' | 'activity'
    title: string
    preview: string
    timestamp: string
    unread?: boolean
  }
  unreadCount: number
  totalMessages: number
  sources: string[]
}

export async function GET(req: NextRequest) {
  const db = createServiceClient()
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 200)

  // 1. Tickets
  const { data: tickets } = await db
    .from('tickets')
    .select('id, subject, contact_name, contact_email, company, status, messages, created_date, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  // 2. Sequence activities (most recent reply/bounce/click events)
  const { data: seqActivities } = await db
    .from('sequence_activities')
    .select('id, sequence_id, contact_email, event_type, metadata, created_at')
    .in('event_type', ['replied', 'clicked', 'bounced', 'sent'])
    .order('created_at', { ascending: false })
    .limit(limit)

  // 3. Broadcast recipients (engagement events)
  const { data: broadcastRecipients } = await db
    .from('broadcast_recipients')
    .select('id, broadcast_id, email, status, sent_at, opened_at, clicked_at')
    .order('sent_at', { ascending: false })
    .limit(limit)

  // 4. CRM activities flagged as communications
  const { data: crmActivities } = await db
    .from('crm_activities')
    .select('id, type, description, contact_id, company_id, timestamp, logged_by')
    .in('type', ['Email', 'Call', 'Meeting', 'Note'])
    .order('timestamp', { ascending: false })
    .limit(limit)

  // Build a contact email → thread map
  const threads = new Map<string, UnifiedThread>()

  function upsertThread(
    email: string,
    name: string,
    company: string | undefined,
    source: UnifiedThread['lastMessage']['source'],
    title: string,
    preview: string,
    timestamp: string,
    unread = false,
  ) {
    const key = email.toLowerCase()
    const existing = threads.get(key)
    if (!existing) {
      threads.set(key, {
        contactEmail: email,
        contactName: name,
        company,
        lastMessage: { source, title, preview, timestamp, unread },
        unreadCount: unread ? 1 : 0,
        totalMessages: 1,
        sources: [source],
      })
      return
    }
    existing.totalMessages++
    if (!existing.sources.includes(source)) existing.sources.push(source)
    if (unread) existing.unreadCount++
    // Keep the newest message as lastMessage
    if (new Date(timestamp) > new Date(existing.lastMessage.timestamp)) {
      existing.lastMessage = { source, title, preview, timestamp, unread }
      if (!existing.contactName && name) existing.contactName = name
      if (!existing.company && company) existing.company = company
    }
  }

  for (const t of (tickets ?? [])) {
    if (!t.contact_email) continue
    const lastMsg = Array.isArray(t.messages) && t.messages.length > 0
      ? t.messages[t.messages.length - 1]
      : null
    const preview = lastMsg?.body ?? lastMsg?.text ?? t.subject ?? ''
    upsertThread(
      t.contact_email,
      t.contact_name ?? '',
      t.company ?? undefined,
      'ticket',
      t.subject ?? 'Support ticket',
      String(preview).slice(0, 200),
      t.created_at ?? t.created_date ?? new Date().toISOString(),
      t.status === 'Open',
    )
  }

  for (const a of (seqActivities ?? [])) {
    if (!a.contact_email) continue
    const labels: Record<string, string> = {
      replied: 'Replied to sequence',
      clicked: 'Clicked sequence link',
      bounced: 'Sequence email bounced',
      sent:    'Sequence email sent',
    }
    upsertThread(
      a.contact_email,
      '',
      undefined,
      'sequence',
      labels[a.event_type] ?? 'Sequence event',
      (a.metadata as { subject?: string } | null)?.subject ?? '',
      a.created_at,
      a.event_type === 'replied',
    )
  }

  for (const r of (broadcastRecipients ?? [])) {
    if (!r.email) continue
    const timestamp = r.clicked_at ?? r.opened_at ?? r.sent_at ?? new Date().toISOString()
    const preview = r.clicked_at ? 'Clicked broadcast link' : r.opened_at ? 'Opened broadcast' : 'Broadcast sent'
    upsertThread(
      r.email,
      '',
      undefined,
      'broadcast',
      preview,
      '',
      timestamp,
      false,
    )
  }

  // CRM activities contain contact_id not email — need to resolve
  if ((crmActivities ?? []).length > 0) {
    const contactIds = Array.from(
      new Set((crmActivities ?? []).map((a) => a.contact_id).filter(Boolean)),
    ) as string[]
    const { data: contactsLookup } = await db
      .from('crm_contacts')
      .select('id, full_name, emails, company_name')
      .in('id', contactIds)
    const contactMap = new Map<string, { name: string; email: string; company: string }>()
    for (const c of (contactsLookup ?? [])) {
      contactMap.set(c.id, {
        name:    c.full_name ?? '',
        email:   c.emails?.[0] ?? '',
        company: c.company_name ?? '',
      })
    }
    for (const a of (crmActivities ?? [])) {
      const c = a.contact_id ? contactMap.get(a.contact_id) : null
      if (!c?.email) continue
      upsertThread(
        c.email,
        c.name,
        c.company || undefined,
        'activity',
        `${a.type} logged`,
        (a.description ?? '').slice(0, 200),
        a.timestamp,
        false,
      )
    }
  }

  // Sort threads by most recent message
  const result = Array.from(threads.values()).sort(
    (a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime(),
  )

  return NextResponse.json(result.slice(0, limit))
}
