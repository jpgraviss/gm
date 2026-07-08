import { NextRequest, NextResponse } from 'next/server'
import { disconnectMeta } from '@/lib/meta-ads'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * POST /api/integrations/meta/disconnect
 * Leadership-only. Clears stored Meta tokens.
 */
export const POST = withErrorHandler('integrations/meta/disconnect POST', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  await disconnectMeta()
  logAudit({
    userName: 'system',
    action: 'meta_ads_disconnected',
    module: 'integrations',
    type: 'warning',
    metadata: {},
  })
  return NextResponse.json({ disconnected: true })
})
