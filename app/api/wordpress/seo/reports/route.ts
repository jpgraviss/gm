import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { withErrorHandler } from '@/lib/api-handler'
import { generateWordPressSeoReport } from '@/lib/wordpress-seo-report'

export const POST = withErrorHandler('wordpress/seo/reports POST', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const body = await req.json()
  const siteUrl = body.siteUrl as string | undefined

  const db = createServiceClient()

  if (siteUrl) {
    return NextResponse.json(await generateWordPressSeoReport(db, siteUrl))
  }

  const { data: sites } = await db
    .from('wordpress_site_health')
    .select('site_url, company_name')
    .order('company_name')

  if (!sites || sites.length === 0) {
    return NextResponse.json({ reports: [], summary: { totalSites: 0 } })
  }

  const reports = await Promise.all(
    sites.map((s: { site_url: string }) => generateWordPressSeoReport(db, s.site_url))
  )

  const allScores = reports.flatMap(r => r.scoreDistribution ? [r.averageScore] : []).filter(Boolean)
  const overallAvg = allScores.length > 0
    ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length)
    : 0

  return NextResponse.json({
    reports,
    summary: {
      totalSites: sites.length,
      overallAverageScore: overallAvg,
      generatedAt: new Date().toISOString(),
    },
  })
})

export const GET = withErrorHandler('wordpress/seo/reports GET', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const siteUrl = req.nextUrl.searchParams.get('site')

  const db = createServiceClient()

  if (siteUrl) {
    const report = await generateWordPressSeoReport(db, siteUrl)
    return NextResponse.json(report)
  }

  const { data: sites } = await db
    .from('wordpress_site_health')
    .select('site_url, company_name')
    .order('company_name')

  if (!sites || sites.length === 0) {
    return NextResponse.json([])
  }

  const reports = await Promise.all(
    sites.map((s: { site_url: string }) => generateWordPressSeoReport(db, s.site_url))
  )

  return NextResponse.json(reports)
})
