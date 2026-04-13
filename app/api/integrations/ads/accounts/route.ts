import { NextResponse } from 'next/server'
import { listAdsAccounts } from '@/lib/google-ads'

export async function GET() {
  try {
    const accounts = await listAdsAccounts()
    return NextResponse.json(accounts)
  } catch (err) {
    console.error('[ads/accounts]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch Google Ads accounts' },
      { status: 500 },
    )
  }
}
