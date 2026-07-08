import { NextResponse } from 'next/server'
import { listConnectionStatuses } from '@/lib/social-connections'
import { withErrorHandler } from '@/lib/api-handler'

/** GET /api/integrations/linkedin/status */
export const GET = withErrorHandler('integrations/linkedin/status GET', async () => {
  const statuses = await listConnectionStatuses()
  const li = statuses.find((s) => s.platform === 'linkedin')
  return NextResponse.json(li ?? { platform: 'linkedin', connected: false, accountLabel: null, connectedAt: null })
})
