import { NextResponse } from 'next/server'
import { listMetaAdAccounts } from '@/lib/meta-ads'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * GET /api/integrations/meta/accounts
 * Returns the list of Meta ad accounts accessible to the connected user.
 */
export const GET = withErrorHandler('integrations/meta/accounts GET', async () => {
  const accounts = await listMetaAdAccounts()
  return NextResponse.json(accounts)
})
