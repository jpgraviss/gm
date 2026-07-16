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
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
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
      return date.toISOString()
    case 'quarterly':
      date.setMonth(date.getMonth() + 3)
      return date.toISOString()
    default:
      return null
  }
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
    .update({ status: 'sending' })
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
