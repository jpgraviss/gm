import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

interface ScoreRow {
  score: number
  issues: Array<{ type: string; message: string; severity: string }>
  page_path: string
  page_title: string | null
}

interface HealthRow {
  company_name: string
  site_url: string
  wp_version: string | null
  php_version: string | null
  plugins: Array<{ name: string; version: string; update_available?: boolean }>
  themes: Array<{ name: string; version: string }>
  security: Record<string, unknown>
  last_reported_at: string | null
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const body = await req.json()
  const siteUrl = body.siteUrl as string | undefined

  const db = createServiceClient()

  if (siteUrl) {
    return NextResponse.json(await generateSiteReport(db, siteUrl))
  }

  const { data: sites } = await db
    .from('wordpress_site_health')
    .select('site_url, company_name')
    .order('company_name')

  if (!sites || sites.length === 0) {
    return NextResponse.json({ reports: [], summary: { totalSites: 0 } })
  }

  const reports = await Promise.all(
    sites.map((s: { site_url: string }) => generateSiteReport(db, s.site_url))
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
}

async function generateSiteReport(db: ReturnType<typeof createServiceClient>, siteUrl: string) {
  const [healthResult, scoresResult] = await Promise.all([
    db.from('wordpress_site_health').select('*').eq('site_url', siteUrl).maybeSingle(),
    db.from('wordpress_seo_scores').select('*').eq('site_url', siteUrl).order('score', { ascending: true }),
  ])

  const health = healthResult.data as HealthRow | null
  const scores = (scoresResult.data ?? []) as ScoreRow[]

  const totalPages = scores.length
  const avgScore = totalPages > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / totalPages)
    : 0

  const green = scores.filter(s => s.score >= 80).length
  const yellow = scores.filter(s => s.score >= 50 && s.score < 80).length
  const red = scores.filter(s => s.score < 50).length

  const issuesByType: Record<string, number> = {}
  for (const s of scores) {
    for (const issue of s.issues) {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1
    }
  }

  const topIssues = Object.entries(issuesByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([type, count]) => {
      const sample = scores.flatMap(s => s.issues).find(i => i.type === type)
      return { type, count, message: sample?.message ?? type, severity: sample?.severity ?? 'info' }
    })

  const worstPages = scores.slice(0, 5).map(s => ({
    path: s.page_path,
    title: s.page_title,
    score: s.score,
    issueCount: s.issues.length,
  }))

  const totalIssues = scores.reduce((sum, s) => sum + s.issues.length, 0)
  const pluginUpdates = health?.plugins?.filter(p => p.update_available).length ?? 0

  const securityIssues: string[] = []
  if (health?.security) {
    const sec = health.security as Record<string, boolean>
    if (sec.login_exposed) securityIssues.push('Login page is exposed')
    if (sec.xmlrpc_enabled) securityIssues.push('XML-RPC is enabled')
    if (sec.directory_listing) securityIssues.push('Directory listing is enabled')
    if (!sec.sitemap_found) securityIssues.push('No sitemap found')
  }

  return {
    siteUrl,
    companyName: health?.company_name ?? siteUrl,
    generatedAt: new Date().toISOString(),
    environment: {
      wpVersion: health?.wp_version ?? null,
      phpVersion: health?.php_version ?? null,
      pluginCount: health?.plugins?.length ?? 0,
      pluginUpdates,
      lastReported: health?.last_reported_at ?? null,
    },
    averageScore: avgScore,
    totalPages,
    totalIssues,
    scoreDistribution: { green, yellow, red },
    topIssues,
    worstPages,
    securityIssues,
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const siteUrl = req.nextUrl.searchParams.get('site')

  const db = createServiceClient()

  if (siteUrl) {
    const report = await generateSiteReport(db, siteUrl)
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
    sites.map((s: { site_url: string }) => generateSiteReport(db, s.site_url))
  )

  return NextResponse.json(reports)
}
