import { NextRequest, NextResponse } from 'next/server'
import { disconnectMeta } from '@/lib/meta-ads'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * POST /api/integrations/meta/disconnect
 * Leadership-only. Clears stored Meta tokens.
 */
export const POST = withErrorHandler('integrations/meta/disconnect POST', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)

  await disconnectMeta()
  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action: 'meta_ads_disconnected',
    module: 'integrations',
    type: 'warning',
    metadata: {},
  })
  return NextResponse.json({ disconnected: true })
})
