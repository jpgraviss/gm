import { describe, it, expect } from 'vitest'
import { buildReportRecommendations } from '@/lib/client-reports'
import type { WordPressSeoReport } from '@/lib/wordpress-seo-report'

function makeWpReport(overrides: Partial<WordPressSeoReport> = {}): WordPressSeoReport {
  return {
    siteUrl: 'https://example.com',
    companyName: 'Example Co',
    generatedAt: '2026-07-13T00:00:00Z',
    environment: { wpVersion: '6.6', phpVersion: '8.2', pluginCount: 10, pluginUpdates: 0, lastReported: null },
    averageScore: 85,
    averageReadability: 70,
    totalPages: 10,
    totalIssues: 0,
    scoreDistribution: { green: 10, yellow: 0, red: 0 },
    topIssues: [],
    worstPages: [],
    securityIssues: [],
    ...overrides,
  }
}

describe('buildReportRecommendations — WordPress SEO rules', () => {
  it('recommends nothing WordPress-specific when the site is healthy', () => {
    const recs = buildReportRecommendations({ wordpressSeo: makeWpReport() })
    expect(recs.some(r => r.toLowerCase().includes('plugin') || r.toLowerCase().includes('security check'))).toBe(false)
  })

  it('flags pages with a poor SEO score', () => {
    const recs = buildReportRecommendations({
      wordpressSeo: makeWpReport({
        scoreDistribution: { green: 5, yellow: 2, red: 3 },
        worstPages: [{ path: '/about', title: 'About', score: 32, issueCount: 5 }],
      }),
    })
    expect(recs.some(r => r.includes('3 pages') && r.includes('/about'))).toBe(true)
  })

  it('flags outdated plugins as a security recommendation', () => {
    const recs = buildReportRecommendations({
      wordpressSeo: makeWpReport({ environment: { wpVersion: '6.6', phpVersion: '8.2', pluginCount: 10, pluginUpdates: 4, lastReported: null } }),
    })
    expect(recs.some(r => r.includes('4 WordPress plugins'))).toBe(true)
  })

  it('surfaces real site-health security issues', () => {
    const recs = buildReportRecommendations({
      wordpressSeo: makeWpReport({ securityIssues: ['XML-RPC is enabled', 'No sitemap found'] }),
    })
    expect(recs.some(r => r.includes('XML-RPC is enabled') && r.includes('No sitemap found'))).toBe(true)
  })
})
