import { NextResponse } from 'next/server'
import { getMetaIntegrationStatus } from '@/lib/meta-ads'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * GET /api/integrations/meta/status
 * Returns { connected, accountEmail, lastSyncAt } for the settings UI.
 */
export const GET = withErrorHandler('integrations/meta/status GET', async () => {
  const status = await getMetaIntegrationStatus()
  return NextResponse.json(status)
})
