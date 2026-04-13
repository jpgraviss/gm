import { NextRequest, NextResponse } from 'next/server'
import { getGSCSearchAnalytics, getGSCSummary } from '@/lib/google-search-console'

/**
 * GET /api/integrations/gsc/report?site=https://example.com&days=28&dimension=query
 * Returns a summary card + top rows for a given dimension.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const siteUrl = searchParams.get('site')
  const days = parseInt(searchParams.get('days') ?? '28', 10)
  const dimension = (searchParams.get('dimension') ?? 'query') as 'query' | 'page' | 'country' | 'device' | 'date'

  if (!siteUrl) return NextResponse.json({ error: 'site param required' }, { status: 400 })

  try {
    const end = new Date()
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const [summary, rows] = await Promise.all([
      getGSCSummary(siteUrl, days),
      getGSCSearchAnalytics({
        siteUrl,
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions: [dimension],
        rowLimit: 50,
      }),
    ])

    return NextResponse.json({ summary, rows, dimension, days })
  } catch (err) {
    console.error('[gsc/report]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'GSC report failed' },
      { status: 500 },
    )
  }
}
