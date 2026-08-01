import { describe, it, expect } from 'vitest'
import { generateMonthlyReportHtml, type MonthlyReportData } from '@/lib/templates/generate-monthly-report'

// AUDIT #654 — the #621 fix escaped recommendations[]/changelog[] in this
// same function, but missed 3 sibling fields fed from the same free-form
// customizationData.metrics on POST /api/delivery/send-template:
// ranking.keywords[].keyword, wordpressSeo.worstPages[].title/.path, and
// wordpressSeo.securityIssues[].

function buildData(overrides: Partial<MonthlyReportData> = {}): MonthlyReportData {
  return {
    clientName: 'Acme Co',
    companyName: 'Acme Co',
    period: { start: '2026-06-01', end: '2026-06-30', label: 'June 2026' },
    metrics: {},
    recommendations: [],
    changelog: [],
    ...overrides,
  }
}

function ranking(keywords: Array<{ keyword: string; position: number; change: number }>) {
  return { tracked: keywords.length, top3: 0, top10: 0, improved: 0, declined: 0, keywords }
}

function wordpressSeo(overrides: {
  securityIssues?: string[]
  worstPages?: Array<{ path: string; title: string | null; score: number }>
}) {
  return {
    averageScore: 50,
    totalPages: 1,
    scoreDistribution: { green: 0, yellow: 1, red: 0 },
    pluginUpdates: 0,
    securityIssues: overrides.securityIssues ?? [],
    worstPages: overrides.worstPages ?? [],
  }
}

const PAYLOAD = '<img src=x onerror=alert(1)>'

describe('generateMonthlyReportHtml — HTML escaping (#654)', () => {
  it('escapes a malicious ranking keyword', () => {
    const html = generateMonthlyReportHtml(buildData({
      metrics: { ranking: ranking([{ keyword: PAYLOAD, position: 5, change: 0 }]) },
    }))
    expect(html).not.toContain(PAYLOAD)
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('escapes a malicious worstPages title', () => {
    const html = generateMonthlyReportHtml(buildData({
      metrics: { wordpressSeo: wordpressSeo({ worstPages: [{ path: '/x', title: PAYLOAD, score: 10 }] }) },
    }))
    expect(html).not.toContain(PAYLOAD)
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('escapes a malicious worstPages path when title is null', () => {
    const html = generateMonthlyReportHtml(buildData({
      metrics: { wordpressSeo: wordpressSeo({ worstPages: [{ path: PAYLOAD, title: null, score: 10 }] }) },
    }))
    expect(html).not.toContain(PAYLOAD)
  })

  it('escapes malicious securityIssues entries', () => {
    const html = generateMonthlyReportHtml(buildData({
      metrics: { wordpressSeo: wordpressSeo({ securityIssues: [PAYLOAD] }) },
    }))
    expect(html).not.toContain(PAYLOAD)
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('still renders normal keyword/page/security text unescaped-looking (no double-escaping)', () => {
    const html = generateMonthlyReportHtml(buildData({
      metrics: {
        ranking: ranking([{ keyword: 'best pizza', position: 1, change: 0 }]),
        wordpressSeo: wordpressSeo({ securityIssues: ['Outdated plugin'], worstPages: [{ path: '/home', title: 'Home Page', score: 90 }] }),
      },
    }))
    expect(html).toContain('best pizza')
    expect(html).toContain('Home Page')
    expect(html).toContain('Outdated plugin')
  })
})
