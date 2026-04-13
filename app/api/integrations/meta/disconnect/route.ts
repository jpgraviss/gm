import { NextRequest, NextResponse } from 'next/server'
import { disconnectMeta } from '@/lib/meta-ads'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

/**
 * POST /api/integrations/meta/disconnect
 * Leadership-only. Clears stored Meta tokens.
 */
export async function POST(req: NextRequest) {
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
}
