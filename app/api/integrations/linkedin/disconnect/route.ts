import { NextResponse } from 'next/server'
import { removeConnection } from '@/lib/social-connections'
import { logAudit } from '@/lib/audit'

/** POST /api/integrations/linkedin/disconnect */
export async function POST() {
  await removeConnection('linkedin')
  logAudit({ userName: 'system', action: 'linkedin_disconnected', module: 'integrations', type: 'action' })
  return NextResponse.json({ ok: true })
}
