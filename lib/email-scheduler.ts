import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

export interface ScheduleEmailOptions {
  to: string
  toName?: string
  subject: string
  html: string
  sendAt: string
  type?: 'report' | 'template' | 'broadcast' | 'notification'
  recurring?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
  metadata?: Record<string, unknown>
  createdBy?: string
}

export interface ScheduledEmail {
  id: string
  toEmail: string
  toName: string | null
  subject: string
  html: string
  sendAt: string
  sentAt: string | null
  sendingAt: string | null
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'
  type: string
  recurring: string
  metadata: Record<string, unknown>
  error: string | null
  createdBy: string | null
  createdAt: string
}

export interface ScheduledEmailFilters {
  status?: string
  type?: string
  limit?: number
  offset?: number
}

function mapRow(row: Record<string, unknown>): ScheduledEmail {
  return {
    id: row.id as string,
    toEmail: row.to_email as string,
    toName: (row.to_name as string) ?? null,
    subject: row.subject as string,
    html: row.html as string,
    sendAt: row.send_at as string,
    sentAt: (row.sent_at as string) ?? null,
    sendingAt: (row.sending_at as string) ?? null,
    status: row.status as ScheduledEmail['status'],
    type: row.type as string,
    recurring: row.recurring as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    error: (row.error as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
  }
}

export async function scheduleEmail(options: ScheduleEmailOptions): Promise<ScheduledEmail> {
  const db = createServiceClient()
  const id = crypto.randomUUID()

  const { data, error } = await db
    .from('scheduled_emails')
    .insert({
      id,
      to_email: options.to,
      to_name: options.toName ?? null,
      subject: options.subject,
      html: options.html,
      send_at: options.sendAt,
      type: options.type ?? 'notification',
      recurring: options.recurring ?? 'none',
      metadata: options.metadata ?? {},
      created_by: options.createdBy ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data)
}

export async function getScheduledEmails(filters?: ScheduledEmailFilters): Promise<ScheduledEmail[]> {
  const db = createServiceClient()
  let query = db.from('scheduled_emails').select('*').order('send_at', { ascending: true })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.type) query = query.eq('type', filters.type)
  if (filters?.limit) query = query.limit(filters.limit)
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

export async function cancelScheduledEmail(id: string): Promise<ScheduledEmail> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('scheduled_emails')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data)
}

function getNextSendAt(current: string, recurring: string): string | null {
  const date = new Date(current)
  const originalDay = date.getDate()
  switch (recurring) {
    case 'daily':
      date.setDate(date.getDate() + 1)
      return date.toISOString()
    case 'weekly':
      date.setDate(date.getDate() + 7)
      return date.toISOString()
    case 'biweekly':
      date.setDate(date.getDate() + 14)
      return date.toISOString()
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      // setMonth silently overflows for due-days 29-31 into whatever day
      // the target month lands on (Jan 31 + 1mo -> Mar 3, skipping
      // February entirely) — clamp back to the target month's last day.
      if (date.getDate() !== originalDay) date.setDate(0)
      return date.toISOString()
    case 'quarterly':
      date.setMonth(date.getMonth() + 3)
      if (date.getDate() !== originalDay) date.setDate(0)
      return date.toISOString()
    default:
      return null
  }
}

// AUDIT.md #370 — processScheduledEmails() atomically claims rows
// pending -> sending before its send loop, but nothing rescued a row left
// stuck in 'sending' if the request/serverless function was killed
// mid-loop (a real risk chained after 6+ other jobs in the same
// /api/cron invocation) — those rows were permanently excluded from
// future claims (the claim query only ever looks at status='pending')
// and invisible in the UI (STATUS_TABS has no 'stuck' state). Mirrors
// the broadcast-side stuck-'sending' recovery in app/api/cron/route.ts's
// dispatchScheduledBroadcasts, and the one-time version of this same
// rescue already applied via supabase/migrations/
// add_scheduled_emails_sending_status.sql ("Cron re-runs every 5 min;
// anything stuck > 15 min is definitely orphaned") — this makes that
// rescue a standing sweep instead of a one-off migration. There's no
// retry-count column on scheduled_emails, so (matching the migration's
// own approach) every stuck row is reset to 'pending' rather than ever
// marked 'failed' here — a row that fails again for a real, deterministic
// reason (bad address, provider error) still gets marked 'failed' by the
// normal send loop below on its next attempt, it just isn't diagnosed as
// "genuinely failed" purely from having been stuck once.
const STUCK_SENDING_THRESHOLD_MS = 15 * 60 * 1000

export async function rescueStuckSendingEmails(): Promise<{ rescued: number }> {
  const db = createServiceClient()
  const cutoff = new Date(Date.now() - STUCK_SENDING_THRESHOLD_MS).toISOString()

  // Keyed off sending_at (stamped by the claim update in
  // processScheduledEmails below, migration add_scheduled_emails_sending_at.sql),
  // not send_at — send_at is frozen at insert time and can legitimately be
  // well in the past the moment a backlogged row is claimed, which would
  // make it look instantly "stuck" if age were measured from it instead of
  // the real claim time. A row still 'sending' with sending_at older than
  // the threshold has genuinely been claimed and not resolved (sent/failed)
  // for at least that long — reset it to 'pending' so the next tick's claim
  // query (which only looks at status='pending') can pick it up again. A
  // sending_at of NULL shouldn't be possible for a freshly claimed row, but
  // is treated as stuck too (a row somehow in 'sending' pre-migration/
  // pre-stamp) rather than silently never rescued.
  const { data: rescued, error } = await db
    .from('scheduled_emails')
    .update({ status: 'pending' })
    .eq('status', 'sending')
    .or(`sending_at.lte.${cutoff},sending_at.is.null`)
    .select('id')

  if (error) throw new Error(error.message)
  return { rescued: rescued?.length ?? 0 }
}

export async function processScheduledEmails(): Promise<{ sent: number; failed: number }> {
  const db = createServiceClient()
  const now = new Date().toISOString()

  // First, atomically claim due rows by flipping status pending → sending.
  // Only rows we successfully claim are processed — prevents duplicate
  // sends when two cron ticks overlap.
  const { data: candidateIds, error: peekErr } = await db
    .from('scheduled_emails')
    .select('id')
    .eq('status', 'pending')
    .lte('send_at', now)
    .order('send_at', { ascending: true })
    .limit(100)

  if (peekErr) throw new Error(peekErr.message)
  if (!candidateIds || candidateIds.length === 0) return { sent: 0, failed: 0 }

  const ids = candidateIds.map(r => r.id as string)
  const { data: claimedRows, error: claimErr } = await db
    .from('scheduled_emails')
    .update({ status: 'sending', sending_at: now })
    .in('id', ids)
    .eq('status', 'pending')
    .select('*')

  if (claimErr) throw new Error(claimErr.message)
  const dueEmails = claimedRows ?? []
  if (dueEmails.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const row of dueEmails) {
    const result = await sendEmail({
      to: row.to_email as string,
      subject: row.subject as string,
      html: row.html as string,
    })

    if (result.success) {
      await db
        .from('scheduled_emails')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id)

      const recurring = row.recurring as string
      if (recurring && recurring !== 'none') {
        const nextSendAt = getNextSendAt(row.send_at as string, recurring)
        if (nextSendAt) {
          await db.from('scheduled_emails').insert({
            id: crypto.randomUUID(),
            to_email: row.to_email,
            to_name: row.to_name,
            subject: row.subject,
            html: row.html,
            send_at: nextSendAt,
            type: row.type,
            recurring: row.recurring,
            metadata: row.metadata,
            created_by: row.created_by,
          })
        }
      }
      sent++
    } else {
      await db
        .from('scheduled_emails')
        .update({ status: 'failed', error: result.error ?? 'Unknown error' })
        .eq('id', row.id)
      failed++
    }
  }

  return { sent, failed }
}
