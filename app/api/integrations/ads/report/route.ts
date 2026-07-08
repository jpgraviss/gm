import { NextRequest, NextResponse } from 'next/server'
import { getAdsSummary, getAdsCampaigns } from '@/lib/google-ads'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * GET /api/integrations/ads/report?customerId=1234567890&days=28
 * Returns a summary card + per-campaign rows for a given Google Ads customer.
 */
export const GET = withErrorHandler('ads/report GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')
  const days = parseInt(searchParams.get('days') ?? '28', 10)

  if (!customerId) {
    return NextResponse.json({ error: 'customerId param required' }, { status: 400 })
  }

  const [summary, campaigns] = await Promise.all([
    getAdsSummary(customerId, days),
    getAdsCampaigns(customerId, days),
  ])

  return NextResponse.json({ summary, campaigns, days })
})
