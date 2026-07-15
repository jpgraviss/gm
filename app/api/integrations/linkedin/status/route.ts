import { NextResponse } from 'next/server'
import { listConnectionStatuses } from '@/lib/social-connections'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

/** GET /api/integrations/linkedin/status */
export const GET = withErrorHandler('integrations/linkedin/status GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const statuses = await listConnectionStatuses()
  const li = statuses.find((s) => s.platform === 'linkedin')
  return NextResponse.json(li ?? { platform: 'linkedin', connected: false, accountLabel: null, connectedAt: null })
})
