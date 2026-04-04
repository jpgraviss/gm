import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'

interface GmailThread {
  id: string
  messages: { id: string; labelIds?: string[] }[]
}

async function fetchGmailThread(accessToken: string, threadId: string): Promise<GmailThread | null> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=minimal`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) return null
  return res.json()
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // Fetch all active enrollments that have message_ids (sent emails with thread references)
  const { data: enrollments, error: fetchErr } = await db
    .from('sequence_enrollments')
    .select('id, sequence_id, contact_email, contact_name, contact_id, company, message_ids, assigned_rep_id, current_step')
    .eq('status', 'active')
    .not('message_ids', 'is', null)

  if (fetchErr) {
    console.error('[reply-check]', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!enrollments?.length) {
    return NextResponse.json({ checked: 0, replies: 0 })
  }

  // Group enrollments by assigned rep to batch Gmail lookups
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byRep = new Map<string, any[]>()
  for (const enrollment of enrollments) {
    const repId = enrollment.assigned_rep_id ?? '_unassigned'
    if (!byRep.has(repId)) byRep.set(repId, [])
    byRep.get(repId)!.push(enrollment)
  }

  // Pre-fetch Gmail tokens for each rep
  const repTokens = new Map<string, string>()
  const repIds = Array.from(byRep.keys()).filter((id) => id !== '_unassigned')

  if (repIds.length) {
    const { data: reps } = await db
      .from('team_members')
      .select('id, gmail_access_token, gmail_token_expires_at')
      .in('id', repIds)

    for (const rep of reps ?? []) {
      if (!rep.gmail_access_token) continue
      // Check token expiry with 5-minute buffer
      if (rep.gmail_token_expires_at) {
        const expiresAt = new Date(rep.gmail_token_expires_at)
        if (expiresAt < new Date(Date.now() + 5 * 60 * 1000)) continue
      }
      repTokens.set(rep.id, rep.gmail_access_token)
    }
  }

  let checked = 0
  let replies = 0

  for (const [repId, repEnrollments] of Array.from(byRep.entries())) {
    const accessToken = repTokens.get(repId)
    if (!accessToken) continue

    for (const enrollment of repEnrollments) {
      // message_ids is expected to be an array of Gmail message/thread IDs
      const messageIds: string[] = Array.isArray(enrollment.message_ids)
        ? enrollment.message_ids
        : []

      if (!messageIds.length) continue
      checked++

      // Use the first message ID as the thread ID
      const threadId = messageIds[0]

      try {
        const thread = await fetchGmailThread(accessToken, threadId)
        if (!thread || !thread.messages) continue

        // If thread has more messages than we sent, there is a reply
        if (thread.messages.length > messageIds.length) {
          replies++

          // Update enrollment: unenroll due to reply
          await db
            .from('sequence_enrollments')
            .update({ status: 'unenrolled', unenroll_reason: 'replied' })
            .eq('id', enrollment.id)

          // Insert replied activity
          await db.from('sequence_activities').insert({
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sequence_id: enrollment.sequence_id,
            enrollment_id: enrollment.id,
            contact_email: enrollment.contact_email,
            step_index: enrollment.current_step ?? 0,
            event_type: 'replied',
            metadata: { thread_id: threadId, thread_message_count: thread.messages.length },
            created_at: new Date().toISOString(),
          })

          // Update sequence reply_rate and active_count
          const { data: seq } = await db
            .from('sequences')
            .select('reply_rate, enrolled_count, active_count, name')
            .eq('id', enrollment.sequence_id)
            .single()

          if (seq) {
            // Recalculate reply rate from actual activity data
            const { data: replyActivities } = await db
              .from('sequence_activities')
              .select('contact_email')
              .eq('sequence_id', enrollment.sequence_id)
              .eq('event_type', 'replied')

            const uniqueRepliers = new Set((replyActivities ?? []).map(a => a.contact_email)).size
            const replyRate = seq.enrolled_count > 0
              ? Math.min(100, Math.round((uniqueRepliers / seq.enrolled_count) * 10000) / 100)
              : 0

            await db
              .from('sequences')
              .update({
                reply_rate: replyRate,
                active_count: Math.max(0, (seq.active_count ?? 1) - 1),
              })
              .eq('id', enrollment.sequence_id)
          }

          // Reset contact in_sequence flag
          if (enrollment.contact_id) {
            await db.from('crm_contacts').update({
              in_sequence: false,
              current_sequence_id: null,
              last_sequence_id: enrollment.sequence_id,
              last_sequence_date: new Date().toISOString(),
            }).eq('id', enrollment.contact_id)
          }

          // Fire automation event
          fireAutomations('sequence_reply', {
            sequenceId: enrollment.sequence_id,
            sequenceName: seq?.name ?? '',
            contactEmail: enrollment.contact_email,
            contactName: enrollment.contact_name,
            contactId: enrollment.contact_id,
            company: enrollment.company,
          })
        }
      } catch (err) {
        console.warn(`[reply-check] Failed to check thread ${threadId}:`, err)
      }
    }
  }

  return NextResponse.json({ checked, replies })
}
