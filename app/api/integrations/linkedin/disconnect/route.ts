import { NextResponse } from 'next/server'
import { removeConnection } from '@/lib/social-connections'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

/** POST /api/integrations/linkedin/disconnect — Leadership-only, matching its google-marketing/meta siblings */
export const POST = withErrorHandler('integrations/linkedin/disconnect POST', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)

  await removeConnection('linkedin')
  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'linkedin_disconnected', module: 'integrations', type: 'action' })
  return NextResponse.json({ ok: true })
})
