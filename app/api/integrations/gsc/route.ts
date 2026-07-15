import { NextRequest, NextResponse } from 'next/server'
import {
  getGSCSearchAnalytics,
  getGSCSummary,
  getGSCSitemaps,
  getGSCIndexCoverage,
  getGSCCoreWebVitals,
} from '@/lib/google-search-console'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('integrations/gsc GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'analytics'
  const siteUrl = searchParams.get('siteUrl')

  if (!siteUrl) {
    return NextResponse.json({ error: 'siteUrl param required' }, { status: 400 })
  }

  try {
    switch (type) {
      case 'analytics': {
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        const days = parseInt(searchParams.get('days') ?? '28', 10)
        const dimension = (searchParams.get('dimension') ?? 'query') as 'query' | 'page' | 'country' | 'device' | 'date'
        const rowLimit = parseInt(searchParams.get('rowLimit') ?? '100', 10)

        const end = endDate ?? new Date().toISOString().slice(0, 10)
        const start = startDate ?? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

        const [summary, rows] = await Promise.all([
          getGSCSummary(siteUrl, days),
          getGSCSearchAnalytics({
            siteUrl,
            startDate: start,
            endDate: end,
            dimensions: [dimension],
            rowLimit,
          }),
        ])
        return NextResponse.json({ summary, rows, dimension, days })
      }
      case 'sitemaps': {
        const sitemaps = await getGSCSitemaps(siteUrl)
        return NextResponse.json({ sitemaps })
      }
      case 'coverage': {
        const coverage = await getGSCIndexCoverage(siteUrl)
        return NextResponse.json({ coverage })
      }
      case 'vitals': {
        const vitals = await getGSCCoreWebVitals(siteUrl)
        return NextResponse.json({ vitals })
      }
      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('GSC request failed')
  }
})
