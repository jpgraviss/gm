import { NextResponse } from 'next/server'
import { getMarketingIntegrationStatuses } from '@/lib/google-marketing'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('integrations/google-marketing/status GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const statuses = await getMarketingIntegrationStatuses()
  return NextResponse.json(statuses)
})
