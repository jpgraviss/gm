import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { listConnectionStatuses, saveConnection, removeConnection } from '@/lib/social-connections'
import type { SocialPlatform } from '@/lib/social-media'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'

const VALID: SocialPlatform[] = ['facebook', 'instagram', 'linkedin', 'google_business']

/** GET /api/social/connections — current status for every platform. */
export const GET = withErrorHandler('social/connections GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const statuses = await listConnectionStatuses()
  return NextResponse.json(statuses)
})

/** POST /api/social/connections — save a selected publish target. This is a
 *  single workspace-wide connection (not per-caller), so — matching the
 *  DELETE below and the OAuth disconnect routes (AUDIT #85) — only
 *  Leadership can silently redirect where every future social post
 *  publishes. Previously had zero auth at all. */
export const POST = withErrorHandler('social/connections POST', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  let body: { platform?: string; externalId?: string; accountLabel?: string; token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const platform = body.platform as SocialPlatform
  if (!platform || !VALID.includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }
  if (!body.externalId || !body.accountLabel) {
    return NextResponse.json({ error: 'externalId and accountLabel are required' }, { status: 400 })
  }

  await saveConnection({
    platform,
    externalId: body.externalId,
    accountLabel: body.accountLabel,
    token: body.token,
  })
  logAudit({ userName: 'admin', action: 'connected_social_account', module: 'social_media', type: 'action', metadata: { platform, account: body.accountLabel } })
  return NextResponse.json({ ok: true })
})

/** DELETE /api/social/connections?platform=facebook — disconnect a platform. */
export const DELETE = withErrorHandler('social/connections DELETE', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const platform = new URL(req.url).searchParams.get('platform') as SocialPlatform | null
  if (!platform || !VALID.includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }
  await removeConnection(platform)
  logAudit({ userName: 'admin', action: 'disconnected_social_account', module: 'social_media', type: 'action', metadata: { platform } })
  return NextResponse.json({ ok: true })
})
