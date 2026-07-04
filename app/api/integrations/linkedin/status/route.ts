import { NextResponse } from 'next/server'
import { listConnectionStatuses } from '@/lib/social-connections'

/** GET /api/integrations/linkedin/status */
export async function GET() {
  const statuses = await listConnectionStatuses()
  const li = statuses.find((s) => s.platform === 'linkedin')
  return NextResponse.json(li ?? { platform: 'linkedin', connected: false, accountLabel: null, connectedAt: null })
}
