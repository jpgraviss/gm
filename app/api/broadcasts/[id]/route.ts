import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBroadcast(row: any) {
  return {
    id:              row.id,
    name:            row.name,
    subject:         row.subject,
    fromName:        row.from_name,
    fromEmail:       row.from_email,
    replyTo:         row.reply_to ?? undefined,
    htmlBody:        row.html_body ?? '',
    contentBlocks:   row.content_blocks ?? undefined,
    plainBody:       row.plain_body ?? undefined,
    previewText:     row.preview_text ?? undefined,
    audienceFilter:  row.audience_filter ?? {},
    audienceCount:   row.audience_count ?? 0,
    status:          row.status,
    scheduledAt:     row.scheduled_at ?? undefined,
    sentAt:          row.sent_at ?? undefined,
    totalSent:       row.total_sent ?? 0,
    totalDelivered:  row.total_delivered ?? 0,
    totalOpened:     row.total_opened ?? 0,
    totalClicked:    row.total_clicked ?? 0,
    totalBounced:    row.total_bounced ?? 0,
    totalUnsubscribed: row.total_unsubscribed ?? 0,
    abTestEnabled:   row.ab_test_enabled ?? false,
    variantBSubject: row.variant_b_subject ?? undefined,
    abSplitPct:      row.ab_split_pct ?? 50,
    abWinner:        row.ab_winner ?? undefined,
    variantAOpens:   row.variant_a_opens ?? 0,
    variantBOpens:   row.variant_b_opens ?? 0,
    variantASent:    row.variant_a_sent ?? 0,
    variantBSent:    row.variant_b_sent ?? 0,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  }
}

export const GET = withErrorHandler('broadcasts/[id] GET', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { data } = await db.from('broadcasts').select('*').eq('id', id).single()
  if (!data) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
  return NextResponse.json(mapBroadcast(data))
})

export const PATCH = withErrorHandler('broadcasts/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  // AUDIT #422 — this previously required 'Leadership' unconditionally,
  // matching DELETE/POST-send. But POST (create) only requires 'Team
  // Member', and Sidebar.tsx gates the Broadcasts nav item by *unit*
  // (Sales/Delivery/Leadership), not role — so a Sales/Delivery staffer
  // with role Team Member is expected, by the nav's own design, to be able
  // to open Broadcasts and use it day to day. With PATCH pinned to
  // Leadership, that user could create a draft but every Save/Preview
  // Audience/Schedule Send call 403'd. Lowered the baseline to match POST.
  // The one thing that guard was actually protecting against — a
  // non-Leadership user marking a broadcast status: 'sent' directly via a
  // raw PATCH, bypassing sendBroadcastNow entirely and showing "Sent" with
  // nothing ever emailed — is preserved below as a targeted elevated check
  // on that specific transition, rather than gating the whole endpoint.
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()

  if (body.status === 'sent' || body.status === 'sending') {
    const deniedElevated = await requireRole(req, 'Leadership')
    if (deniedElevated) return deniedElevated
  }

  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined)           update.name = body.name
  if (body.subject !== undefined)        update.subject = body.subject
  if (body.fromName !== undefined)       update.from_name = body.fromName
  if (body.fromEmail !== undefined)      update.from_email = body.fromEmail
  if (body.replyTo !== undefined)        update.reply_to = body.replyTo
  if (body.htmlBody !== undefined)       update.html_body = body.htmlBody
  if (body.contentBlocks !== undefined)  update.content_blocks = body.contentBlocks
  if (body.plainBody !== undefined)      update.plain_body = body.plainBody
  if (body.previewText !== undefined)    update.preview_text = body.previewText
  if (body.audienceFilter !== undefined) update.audience_filter = body.audienceFilter
  if (body.status !== undefined)         update.status = body.status
  if (body.scheduledAt !== undefined)    update.scheduled_at = body.scheduledAt
  if (body.abTestEnabled !== undefined) update.ab_test_enabled = body.abTestEnabled
  if (body.variantBSubject !== undefined) update.variant_b_subject = body.variantBSubject
  if (body.abSplitPct !== undefined)    update.ab_split_pct = body.abSplitPct

  const { data, error } = await db.from('broadcasts').update(update).eq('id', id).select().single()
  if (error || !data) {
    throw new Error(error?.message || 'Failed to update broadcast')
  }
  return NextResponse.json(mapBroadcast(data))
})

export const DELETE = withErrorHandler('broadcasts/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('broadcasts').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'deleted_broadcast', module: 'email_marketing', type: 'warning', metadata: { broadcastId: id } })
  return NextResponse.json({ deleted: id })
})
