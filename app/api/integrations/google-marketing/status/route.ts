import { NextResponse } from 'next/server'
import { getMarketingIntegrationStatuses } from '@/lib/google-marketing'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('integrations/google-marketing/status GET', async () => {
  const statuses = await getMarketingIntegrationStatuses()
  return NextResponse.json(statuses)
})
