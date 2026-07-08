import { NextRequest, NextResponse } from 'next/server'
import {
  getGA4Report,
  getGA4TopPages,
  getGA4TrafficSources,
} from '@/lib/google-analytics'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * GET /api/integrations/ga4/report?propertyId=123456789&days=28
 * Returns a summary card + top pages + traffic sources for a GA4 property.
 */
export const GET = withErrorHandler('integrations/ga4/report GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('propertyId')
  const days = parseInt(searchParams.get('days') ?? '28', 10)

  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId param required' }, { status: 400 })
  }

  const [summary, topPages, sources] = await Promise.all([
    getGA4Report(propertyId, days),
    getGA4TopPages(propertyId, days),
    getGA4TrafficSources(propertyId, days),
  ])

  return NextResponse.json({ summary, topPages, sources, days })
})
