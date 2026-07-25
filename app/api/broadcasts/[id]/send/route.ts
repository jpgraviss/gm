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

  const { data: broadcast } = await db
    .from('broadcasts')
    .select('*')
    .eq('id', id)
    .single()

  if (!broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
  if (broadcast.status === 'sent' || broadcast.status === 'sending') {
    return NextResponse.json({ error: `Broadcast is already ${broadcast.status}` }, { status: 400 })
  }

  // Mark as sending
  await db.from('broadcasts').update({ status: 'sending', sent_at: new Date().toISOString() }).eq('id', id)

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
