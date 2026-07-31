import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { withErrorHandler } from '@/lib/api-handler'
import { decrypt } from '@/lib/encryption'

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

export const POST = withErrorHandler('sequences/reply-check POST', async (req: NextRequest) => {
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
    .select('id, sequence_id, contact_email, contact_name, contact_id, company, message_ids, assigned_rep_id, current_step, ab_variant')
    .eq('status', 'active')
    .not('message_ids', 'is', null)

  if (fetchErr) {
    throw new Error(fetchErr.message || 'Failed to fetch enrollments')
  }

  if (!enrollments?.length) {
    return NextResponse.json({ checked: 0, replies: 0 })
  }

  // AUDIT #610 — this route never read a sequence's thread_mode (made real,
  // working state at #434) and always treated messageIds[0] as "the"
  // Gmail thread. For an unthreaded sequence (thread_mode: false) each step
  // sends as its own standalone Gmail thread (no In-Reply-To/References),
  // so only messageIds[0]'s own 1-message thread was ever polled — replies
  // to step 2+ were never checked at all, and even a genuine reply to step
  // 1 stopped being detected once 2+ steps had sent (the length comparison
  // used the ever-growing messageIds.length as its denominator against a
  // thread that only ever contains that one step's own message + reply).
  const sequenceIds = Array.from(new Set(enrollments.map(e => e.sequence_id)))
  const { data: sequenceRows } = await db
    .from('sequences')
    .select('id, thread_mode')
    .in('id', sequenceIds)
  // Same `?? true` default execute/route.ts uses, so an enrollment/sequence
  // predating the thread_mode column keeps its existing threaded behavior.
  const threadModeBySequence = new Map((sequenceRows ?? []).map(s => [s.id, s.thread_mode ?? true]))

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
      repTokens.set(rep.id, decrypt(rep.gmail_access_token))
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

      const threadMode = threadModeBySequence.get(enrollment.sequence_id) ?? true

      try {
        let replied = false
        let matchedThreadId = messageIds[0]
        let matchedThreadMessageCount = 0

        if (threadMode) {
          // Threaded: every step's send carries In-Reply-To/References back
          // to the first message, so Gmail bundles the whole exchange
          // (every step we sent + any reply) into messageIds[0]'s thread —
          // fetching that one thread and comparing against how many we sent
          // is sufficient.
          const thread = await fetchGmailThread(accessToken, messageIds[0])
          if (!thread || !thread.messages) continue
          matchedThreadMessageCount = thread.messages.length
          replied = thread.messages.length > messageIds.length
        } else {
          // Unthreaded: each step sent as its own standalone Gmail thread
          // (no In-Reply-To/References), so a reply to ANY step lands in
          // that step's own thread, not messageIds[0]'s — check each one.
          for (const id of messageIds) {
            const thread = await fetchGmailThread(accessToken, id)
            if (!thread || !thread.messages) continue
            if (thread.messages.length > 1) {
              replied = true
              matchedThreadId = id
              matchedThreadMessageCount = thread.messages.length
              break
            }
          }
        }

        // If a thread has more messages than we sent to it, there is a reply
        if (replied) {
          // AUDIT #523 — atomic claim before any real side effect (activity
          // insert, reply-rate recompute, active_count decrement, automation
          // fire). This used to be an unconditional update, so an
          // overlapping cron tick reprocessing the same still-`active`-per-
          // its-own-stale-read enrollment before the first tick's write
          // landed could double-insert a `replied` activity, double-fire
          // `sequence_reply` (creating duplicate downstream deals/tasks),
          // and drive `active_count` negative. Only the invocation that
          // wins this conditional update (status still `active`) proceeds.
          const { data: claimedRow, error: claimErr } = await db
            .from('sequence_enrollments')
            .update({ status: 'unenrolled', unenroll_reason: 'replied' })
            .eq('id', enrollment.id)
            .eq('status', 'active')
            .select('id')
            .maybeSingle()
          if (claimErr || !claimedRow) continue

          replies++

          // Insert replied activity
          await db.from('sequence_activities').insert({
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sequence_id: enrollment.sequence_id,
            enrollment_id: enrollment.id,
            contact_email: enrollment.contact_email,
            step_index: enrollment.current_step ?? 0,
            event_type: 'replied',
            metadata: { thread_id: matchedThreadId, thread_message_count: matchedThreadMessageCount },
            created_at: new Date().toISOString(),
            variant: enrollment.ab_variant ?? null,
          })

          // Update sequence reply_rate and active_count
          const { data: seq } = await db
            .from('sequences')
            .select('enrolled_count, name')
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
              .update({ reply_rate: replyRate })
              .eq('id', enrollment.sequence_id)

            // active_count decrement via the atomic RPC (#66) — a plain
            // read-then-write here would lose a decrement whenever two
            // replies for the same sequence are processed in the same
            // reply-check batch.
            await db.rpc('adjust_sequence_counts', {
              p_sequence_id: enrollment.sequence_id,
              p_enrolled_delta: 0,
              p_active_delta: -1,
            })
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
        console.warn(`[reply-check] Failed to check thread(s) for enrollment ${enrollment.id}:`, err)
      }
    }
  }

  return NextResponse.json({ checked, replies })
})
