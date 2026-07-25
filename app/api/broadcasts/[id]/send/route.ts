import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { sendBroadcastNow } from '@/lib/broadcasts'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

// AUDIT — this route had no declared maxDuration despite sequentially
// emailing the full matched audience in chunks of 50; a large-enough
// audience could outrun the platform's undeclared default, getting
// hard-killed mid-send with the broadcast stuck at status: 'sending'
// forever (marketing/page.tsx treats 'sending' as already-sent for
// re-send purposes, so there's no way to retry from the UI either).
// Declaring this doesn't fix the "stuck forever" recovery gap for an
// audience that genuinely exceeds even this budget — that needs a real
// resume/retry mechanism, tracked as a separate, larger follow-up — but
// it meaningfully raises the audience size that can complete cleanly.
export const maxDuration = 300

/**
 * Send a broadcast to its audience. Paginated through the matched contacts,
 * individual email sends (not Resend Broadcasts API — we want per-contact
 * merge fields + suppression checks).
 */
export const POST = withErrorHandler('broadcasts/[id]/send POST', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { id } = await params
  const db = createServiceClient()

  const { data: existing } = await db
    .from('broadcasts')
    .select('status')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
  if (existing.status === 'sent' || existing.status === 'sending') {
    return NextResponse.json({ error: `Broadcast is already ${existing.status}` }, { status: 400 })
  }

  // Atomically claim the broadcast (only proceeding if the update actually
  // returned a row) instead of a read-then-write "mark as sending" — the
  // cron dispatcher (dispatchScheduledBroadcasts in app/api/cron/route.ts)
  // can independently pick up the same scheduled broadcast at the same
  // moment a staff member clicks "Send Now"; without this guard both paths
  // would call sendBroadcastNow and email the full audience twice.
  const { data: broadcast } = await db
    .from('broadcasts')
    .update({ status: 'sending', sent_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['draft', 'scheduled'])
    .select('*')
    .maybeSingle()

  if (!broadcast) {
    return NextResponse.json({ error: 'Broadcast is already being sent' }, { status: 409 })
  }

  const { sent, skipped, failed, total } = await sendBroadcastNow(db, broadcast)

  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action: 'broadcast_sent',
    module: 'email_marketing',
    type: 'warning',
    metadata: { broadcastId: id, sent, skipped, failed, total },
  })

  return NextResponse.json({ sent, skipped, failed, total })
})
