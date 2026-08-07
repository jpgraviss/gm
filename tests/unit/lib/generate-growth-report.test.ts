import { describe, it, expect } from 'vitest'
import { generateGrowthReportHtml, type GrowthReportData } from '@/lib/templates/generate-growth-report'
import type { ClientReportData } from '@/lib/client-reports'
import type { GrowthNarrative } from '@/lib/report-narrative'

// AUDIT #589 — report_work_log fields (categories[].title/.bullets,
// nextMonth[].title/.description) are staff-entered with no server-side
// sanitization, then were interpolated raw into this client-facing HTML
// email, matching the bug class already fixed at #386/#529/#540/#570.

const baseReport: ClientReportData = {
  company: { name: 'Acme Co' },
  period: { start: '2026-06-01', end: '2026-06-30', label: 'June 2026' },
}

const baseNarrative: GrowthNarrative = {
  monthInOneLine: 'Steady growth this month.',
  searchVisibility: 'Search performance held steady.',
  trafficChannels: 'Traffic channels were stable.',
  engagement: 'Engagement was consistent.',
  source: 'fallback',
}

function buildData(overrides: Partial<GrowthReportData> = {}): GrowthReportData {
  return {
    clientName: 'Acme Co',
    preparedBy: 'Jamie Rep',
    engagement: 'SEO / AEO',
    period: { start: '2026-06-01', end: '2026-06-30', label: 'June 2026' },
    report: baseReport,
    narrative: baseNarrative,
    workLog: [],
    nextMonth: [],
    ...overrides,
  }
}

describe('generateGrowthReportHtml — HTML escaping (#589)', () => {
  it('escapes a malicious workLog category title and bullet', () => {
    const html = generateGrowthReportHtml(buildData({
      workLog: [{ title: '<img src=x onerror="1">', bullets: ['<script>1</script>'] }],
    }))

    expect(html).not.toContain('<img src=x onerror="1">')
    expect(html).not.toContain('<script>1</script>')
    // AUDIT #766 — was `onerror="1"` with raw quotes. This file used to
    // carry its own escapeHtml() that skipped quotes, while preparedBy below
    // went through a stronger one; both now use lib/html-escape.ts.
    expect(html).toContain('&lt;img src=x onerror=&quot;1&quot;&gt;')
    expect(html).toContain('&lt;script&gt;1&lt;/script&gt;')
  })

  it('escapes a malicious nextMonth title and description', () => {
    const html = generateGrowthReportHtml(buildData({
      nextMonth: [{ title: '<b>Bold</b>', description: '<img src=x onerror="1">' }],
    }))

    expect(html).not.toContain('<b>Bold</b>')
    expect(html).not.toContain('<img src=x onerror="1">')
    expect(html).toContain('&lt;b&gt;Bold&lt;/b&gt;')
  })

  it('escapes a malicious preparedBy name', () => {
    const html = generateGrowthReportHtml(buildData({ preparedBy: '<img src=x onerror="1">' }))

    // preparedBy flows through the shared renderTemplate() (AUDIT #621).
    // Since #766 every field in this file escapes identically, so this is
    // no longer the odd one out.
    expect(html).not.toContain('<img src=x onerror="1">')
    expect(html).toContain('&lt;img src=x onerror=&quot;1&quot;&gt;')
  })

  it('renders plain workLog/nextMonth content unescaped-looking (no stray entities)', () => {
    const html = generateGrowthReportHtml(buildData({
      workLog: [{ title: 'SEO Work', bullets: ['Published 3 blog posts'] }],
      nextMonth: [{ title: 'Link building', description: 'Outreach to 10 sites' }],
    }))

    expect(html).toContain('SEO Work')
    expect(html).toContain('Published 3 blog posts')
    expect(html).toContain('Link building')
    expect(html).toContain('Outreach to 10 sites')
  })
})
