import { NextResponse } from 'next/server'
import { getMetaIntegrationStatus } from '@/lib/meta-ads'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

/**
 * GET /api/integrations/meta/status
 * Returns { connected, accountEmail, lastSyncAt } for the settings UI.
 */
export const GET = withErrorHandler('integrations/meta/status GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const status = await getMetaIntegrationStatus()
  return NextResponse.json(status)
})
