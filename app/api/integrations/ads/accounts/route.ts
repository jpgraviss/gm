import { NextRequest, NextResponse } from 'next/server'
import { listAdsAccounts } from '@/lib/google-ads'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('ads/accounts GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const accounts = await listAdsAccounts()
  return NextResponse.json(accounts)
})
