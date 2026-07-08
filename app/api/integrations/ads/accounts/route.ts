import { NextResponse } from 'next/server'
import { listAdsAccounts } from '@/lib/google-ads'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('ads/accounts GET', async () => {
  const accounts = await listAdsAccounts()
  return NextResponse.json(accounts)
})
