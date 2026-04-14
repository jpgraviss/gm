import { NextRequest, NextResponse } from 'next/server'
import {
  getGA4Report,
  getGA4TopPages,
  getGA4TrafficSources,
} from '@/lib/google-analytics'

/**
 * GET /api/integrations/ga4/report?propertyId=123456789&days=28
 * Returns a summary card + top pages + traffic sources for a GA4 property.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('propertyId')
  const days = parseInt(searchParams.get('days') ?? '28', 10)

  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId param required' }, { status: 400 })
  }

  try {
    const [summary, topPages, sources] = await Promise.all([
      getGA4Report(propertyId, days),
      getGA4TopPages(propertyId, days),
      getGA4TrafficSources(propertyId, days),
    ])

    return NextResponse.json({ summary, topPages, sources, days })
  } catch (err) {
    console.error('[ga4/report]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'GA4 report failed' },
      { status: 500 },
    )
  }
}
