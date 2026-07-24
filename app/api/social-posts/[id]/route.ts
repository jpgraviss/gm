import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { requirePortalClient, isStaffCaller } from '@/lib/portal-auth'
import { logAudit } from '@/lib/audit'
import { mapPost } from '@/lib/social-media'

// company_name can be null on older/malformed rows — requirePortalClient
// requires a real string, and a null company has no legitimate portal
// client to scope against, so treat it as staff-only.
async function requirePostAccess(req: NextRequest, companyName: string | null) {
  if (!companyName) return await requireRole(req, 'Team Member')
  return await requirePortalClient(req, companyName)
}

// Fields the real portal approval UI ever sends (app/client/page.tsx
// handleApprovePost/handleRejectPost). Everything else — content,
// platforms, scheduling, media — is staff-only: requirePortalClient only
// validates the post CURRENTLY belongs to the caller's company, not which
// fields they may set it to.
const PORTAL_CLIENT_EDITABLE_FIELDS = new Set(['approvalStatus', 'rejectionReason'])

export const GET = withErrorHandler('social-posts/[id] GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()
  const { data } = await db.from('social_posts').select('*').eq('id', id).single()
  if (!data) return NextResponse.json({ error: 'Social post not found' }, { status: 404 })

  const denied = await requirePostAccess(req, data.company_name)
  if (denied) return denied

  return NextResponse.json(mapPost(data))
})

export const PATCH = withErrorHandler('social-posts/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const { data: current, error: fetchErr } = await db
    .from('social_posts')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Social post not found' }, { status: 404 })
  }

  const denied = await requirePostAccess(req, current.company_name)
  if (denied) return denied

  if (!(await isStaffCaller(req))) {
    const disallowed = Object.keys(body).filter(k => !PORTAL_CLIENT_EDITABLE_FIELDS.has(k))
    if (disallowed.length > 0) {
      return NextResponse.json({ error: `Not permitted to update: ${disallowed.join(', ')}` }, { status: 403 })
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.content !== undefined)         update.content = body.content
  if (body.platforms !== undefined)        update.platforms = body.platforms
  if (body.scheduledAt !== undefined)      update.scheduled_at = body.scheduledAt
  if (body.hashtags !== undefined)         update.hashtags = body.hashtags
  if (body.linkUrl !== undefined)          update.link_url = body.linkUrl
  if (body.mediaUrls !== undefined)        update.media_urls = body.mediaUrls
  if (body.status !== undefined)           update.status = body.status
  if (body.approvalStatus !== undefined)   update.approval_status = body.approvalStatus
  if (body.approvedBy !== undefined)       update.approved_by = body.approvedBy
  if (body.rejectionReason !== undefined)  update.rejection_reason = body.rejectionReason

  // Auto-set approved_at when approval status changes to 'approved'
  if (body.approvalStatus === 'approved') {
    update.approved_at = new Date().toISOString()
  }

  // Auto-transition draft/pending_approval posts to 'scheduled' once a
  // future scheduled_at is in effect and the post doesn't need further
  // approval — 'draft' never goes through client approval (self-approve
  // it here), while 'pending_approval' only qualifies once approved.
  // Without this, status: 'scheduled' was never written by any code path
  // and the cron job's `.eq('status', 'scheduled')` query could never
  // match a row. publishSocialPost also requires approval_status ===
  // 'approved' regardless of status, so both must land together for the
  // cron job to actually publish the row once scheduled_at arrives.
  const nextScheduledAt = (update.scheduled_at !== undefined ? update.scheduled_at : current.scheduled_at) as string | null
  const nextStatus = (update.status !== undefined ? update.status : current.status) as string
  const nextApprovalStatus = (update.approval_status !== undefined ? update.approval_status : current.approval_status) as string
  const isFutureScheduled = !!nextScheduledAt && new Date(nextScheduledAt) > new Date()

  if (isFutureScheduled && nextStatus === 'draft') {
    update.status = 'scheduled'
    update.approval_status = 'approved'
    if (update.approved_at === undefined) update.approved_at = new Date().toISOString()
  } else if (isFutureScheduled && nextStatus === 'pending_approval' && nextApprovalStatus === 'approved') {
    update.status = 'scheduled'
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await db.from('social_posts').update(update).eq('id', id).select().single()
  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Social post not found' }, { status: 404 })
    }
    throw new Error(error?.message || 'Failed to update social post')
  }
  return NextResponse.json(mapPost(data))
})

export const DELETE = withErrorHandler('social-posts/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('social_posts').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete social post')
  }
  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action: 'deleted_social_post',
    module: 'social_media',
    type: 'warning',
    metadata: { postId: id },
  })
  return NextResponse.json({ deleted: id })
})
