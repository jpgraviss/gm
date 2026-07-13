import type { SupabaseClient } from '@supabase/supabase-js'

// Shared by app/api/wordpress/seo/reports/route.ts (manual "Generate Report"
// in the Rank Tracker > WordPress SEO Reports tab) and lib/client-reports.ts
// (the automated monthly client-report email) — one source of truth for
// what a WordPress SEO report actually contains, so the two never drift.

export interface WordPressScoreRow {
  score: number
  issues: Array<{ type: string; message: string; severity: string }>
  page_path: string
  page_title: string | null
  word_count?: number | null
  readability_score?: number | null
  focus_keyword?: string | null
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

export interface WordPressSeoReport {
  siteUrl: string
  companyName: string
  generatedAt: string
  environment: {
    wpVersion: string | null
    phpVersion: string | null
    pluginCount: number
    pluginUpdates: number
    lastReported: string | null
  }
  averageScore: number
  averageReadability: number | null
  totalPages: number
  totalIssues: number
  scoreDistribution: { green: number; yellow: number; red: number }
  topIssues: Array<{ type: string; count: number; message: string; severity: string }>
  worstPages: Array<{ path: string; title: string | null; score: number; issueCount: number }>
  securityIssues: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateWordPressSeoReport(db: SupabaseClient<any>, siteUrl: string): Promise<WordPressSeoReport> {
  const [healthResult, scoresResult] = await Promise.all([
    db.from('wordpress_site_health').select('*').eq('site_url', siteUrl).maybeSingle(),
    db.from('wordpress_seo_scores').select('*').eq('site_url', siteUrl).order('score', { ascending: true }),
  ])

  const health = healthResult.data as HealthRow | null
  const scores = (scoresResult.data ?? []) as WordPressScoreRow[]

  const totalPages = scores.length
  const avgScore = totalPages > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / totalPages)
    : 0

  const readabilityScores = scores.map(s => s.readability_score).filter((n): n is number => typeof n === 'number')
  const avgReadability = readabilityScores.length > 0
    ? Math.round(readabilityScores.reduce((a, b) => a + b, 0) / readabilityScores.length)
    : null

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
    averageReadability: avgReadability,
    totalPages,
    totalIssues,
    scoreDistribution: { green, yellow, red },
    topIssues,
    worstPages,
    securityIssues,
  }
}
