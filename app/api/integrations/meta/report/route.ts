import { NextRequest, NextResponse } from 'next/server'
import { getMetaAdsSummary, getMetaCampaigns } from '@/lib/meta-ads'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

/**
 * GET /api/integrations/meta/report?adAccountId=act_1234567890&days=28
 * Returns a summary card + per-campaign rows for a given Meta ad account.
 */
export const GET = withErrorHandler('integrations/meta/report GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const adAccountId = searchParams.get('adAccountId')
  const days = parseInt(searchParams.get('days') ?? '28', 10)

  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId param required' }, { status: 400 })
  }

  const [summary, campaigns] = await Promise.all([
    getMetaAdsSummary(adAccountId, days),
    getMetaCampaigns(adAccountId, days),
  ])

  return NextResponse.json({ summary, campaigns, days })
})
