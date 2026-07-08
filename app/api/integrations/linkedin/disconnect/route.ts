import { NextResponse } from 'next/server'
import { removeConnection } from '@/lib/social-connections'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

/** POST /api/integrations/linkedin/disconnect */
export const POST = withErrorHandler('integrations/linkedin/disconnect POST', async () => {
  await removeConnection('linkedin')
  logAudit({ userName: 'system', action: 'linkedin_disconnected', module: 'integrations', type: 'action' })
  return NextResponse.json({ ok: true })
})
