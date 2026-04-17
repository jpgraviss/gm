import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { mapPost } from '@/lib/social-media'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { data } = await db.from('social_posts').select('*').eq('id', id).single()
  if (!data) return NextResponse.json({ error: 'Social post not found' }, { status: 404 })
  return NextResponse.json(mapPost(data))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

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

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await db.from('social_posts').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[social-posts/:id PATCH]', error)
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Social post not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(mapPost(data))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('social_posts').delete().eq('id', id)
  if (error) {
    console.error('[social-posts/:id DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logAudit({
    userName: 'system',
    action: 'deleted_social_post',
    module: 'social_media',
    type: 'warning',
    metadata: { postId: id },
  })
  return NextResponse.json({ deleted: id })
}
