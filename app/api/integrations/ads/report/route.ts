import { NextRequest, NextResponse } from 'next/server'
import { getAdsSummary, getAdsCampaigns } from '@/lib/google-ads'

/**
 * GET /api/integrations/ads/report?customerId=1234567890&days=28
 * Returns a summary card + per-campaign rows for a given Google Ads customer.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')
  const days = parseInt(searchParams.get('days') ?? '28', 10)

  if (!customerId) {
    return NextResponse.json({ error: 'customerId param required' }, { status: 400 })
  }

  try {
    const [summary, campaigns] = await Promise.all([
      getAdsSummary(customerId, days),
      getAdsCampaigns(customerId, days),
    ])

    return NextResponse.json({ summary, campaigns, days })
  } catch (err) {
    console.error('[ads/report]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Google Ads report failed' },
      { status: 500 },
    )
  }
}
