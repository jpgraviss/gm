import { NextRequest, NextResponse } from 'next/server'
import { getMetaAdsSummary, getMetaCampaigns } from '@/lib/meta-ads'

/**
 * GET /api/integrations/meta/report?adAccountId=act_1234567890&days=28
 * Returns a summary card + per-campaign rows for a given Meta ad account.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const adAccountId = searchParams.get('adAccountId')
  const days = parseInt(searchParams.get('days') ?? '28', 10)

  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId param required' }, { status: 400 })
  }

  try {
    const [summary, campaigns] = await Promise.all([
      getMetaAdsSummary(adAccountId, days),
      getMetaCampaigns(adAccountId, days),
    ])

    return NextResponse.json({ summary, campaigns, days })
  } catch (err) {
    console.error('[meta/report]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Meta Ads report failed' },
      { status: 500 },
    )
  }
}
