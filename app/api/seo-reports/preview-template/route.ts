import { NextResponse } from 'next/server'
import { generateMonthlyReportHtml } from '@/lib/templates/generate-monthly-report'
import { getSettings } from '@/lib/settings'

export async function GET() {
  const settings = await getSettings()

  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const monthLabel = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const html = generateMonthlyReportHtml({
    clientName: 'Acme Corporation',
    companyName: settings?.company?.name || 'Graviss Marketing',
    period: {
      start: lastMonth.toISOString().slice(0, 10),
      end: lastMonthEnd.toISOString().slice(0, 10),
      label: monthLabel,
    },
    metrics: {
      traffic: {
        sessions: 1247,
        users: 892,
        pageviews: 3456,
        bounceRate: 42.3,
        previousSessions: 1089,
        previousUsers: 761,
      },
      seo: {
        clicks: 890,
        impressions: 15420,
        avgPosition: 12.4,
        ctr: 5.8,
        previousClicks: 734,
        previousImpressions: 13200,
      },
      reputation: {
        newReviews: 7,
        averageRating: 4.8,
        totalReviews: 142,
        previousTotalReviews: 135,
      },
      ranking: {
        tracked: 25,
        top3: 4,
        top10: 12,
        improved: 8,
        declined: 3,
        keywords: [
          { keyword: 'digital marketing agency', position: 3, change: 2 },
          { keyword: 'seo services near me', position: 5, change: 1 },
          { keyword: 'web design company', position: 8, change: -1 },
          { keyword: 'social media management', position: 12, change: 3 },
          { keyword: 'ppc advertising', position: 15, change: 0 },
        ],
      },
      uptime: {
        sitesMonitored: 3,
        uptimePercent: 99.97,
        incidents: 1,
      },
    },
    recommendations: [
      'Add more internal links to blog posts to improve crawl depth',
      'Optimize meta descriptions for top 5 landing pages',
      'Consider adding FAQ schema to service pages for rich snippets',
    ],
    changelog: [
      'Published 4 new blog posts targeting long-tail keywords',
      'Updated Google Business Profile with holiday hours',
      'Resolved 1 uptime incident (3 min downtime on June 14)',
      'Added structured data markup to 8 service pages',
    ],
  }, settings)

  return NextResponse.json({ html })
}
