import { NextResponse } from 'next/server'
import { getMetaIntegrationStatus } from '@/lib/meta-ads'

/**
 * GET /api/integrations/meta/status
 * Returns { connected, accountEmail, lastSyncAt } for the settings UI.
 */
export async function GET() {
  const status = await getMetaIntegrationStatus()
  return NextResponse.json(status)
}
