import { renderTemplate, formatDate } from './template-helpers'

export interface MonthlyReportMetrics {
  traffic?: {
    sessions: number
    users: number
    pageviews: number
    bounceRate: number
    previousSessions?: number
    previousUsers?: number
  }
  seo?: {
    clicks: number
    impressions: number
    avgPosition: number
    ctr: number
    previousClicks?: number
    previousImpressions?: number
  }
  reputation?: {
    newReviews: number
    averageRating: number
    totalReviews: number
    previousTotalReviews?: number
  }
  ranking?: {
    tracked: number
    top3: number
    top10: number
    improved: number
    declined: number
    keywords: Array<{ keyword: string; position: number; change: number }>
  }
  uptime?: {
    sitesMonitored: number
    uptimePercent: number
    incidents: number
  }
}

export interface MonthlyReportData {
  clientName: string
  companyName: string
  period: { start: string; end: string; label: string }
  metrics: MonthlyReportMetrics
  recommendations: string[]
  changelog: string[]
}

function changeIndicator(current: number, previous: number | undefined): string {
  if (previous === undefined) return ''
  const diff = current - previous
  if (diff === 0) return '<span style="color:#6b7280;font-size:12px;margin-left:6px;">no change</span>'
  const arrow = diff > 0 ? '&#9650;' : '&#9660;'
  const color = diff > 0 ? '#059669' : '#dc2626'
  return `<span style="color:${color};font-size:12px;font-weight:600;margin-left:6px;">${arrow} ${Math.abs(diff).toLocaleString()}</span>`
}

function percentChange(current: number, previous: number | undefined): string {
  if (previous === undefined || previous === 0) return ''
  const pct = ((current - previous) / previous) * 100
  const arrow = pct > 0 ? '&#9650;' : '&#9660;'
  const color = pct > 0 ? '#059669' : '#dc2626'
  return `<span style="color:${color};font-size:12px;font-weight:600;margin-left:6px;">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`
}

function metricCard(label: string, value: string, change: string): string {
  return `<td style="padding:8px;width:33%;vertical-align:top;">
    <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">${label}</p>
      <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:#015035;">${value}${change}</p>
    </div>
  </td>`
}

function cssBar(label: string, value: number, max: number, color: string = '#015035'): string {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return `<tr><td style="padding:6px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:120px;font-size:13px;color:#374151;vertical-align:middle;">${label}</td>
        <td style="vertical-align:middle;padding:0 12px;">
          <div style="background:#e5e7eb;border-radius:4px;height:14px;overflow:hidden;">
            <div style="background:${color};height:100%;width:${pct}%;border-radius:4px;"></div>
          </div>
        </td>
        <td style="width:50px;font-size:13px;font-weight:600;color:#1f2937;text-align:right;vertical-align:middle;">${value}</td>
      </tr>
    </table>
  </td></tr>`
}

export function generateMonthlyReportHtml(data: MonthlyReportData): string {
  const { metrics } = data

  let summaryCards = ''
  if (metrics.traffic) {
    summaryCards += metricCard('Sessions', metrics.traffic.sessions.toLocaleString(), percentChange(metrics.traffic.sessions, metrics.traffic.previousSessions))
    summaryCards += metricCard('Users', metrics.traffic.users.toLocaleString(), percentChange(metrics.traffic.users, metrics.traffic.previousUsers))
    summaryCards += metricCard('Bounce Rate', `${metrics.traffic.bounceRate.toFixed(1)}%`, '')
  }
  if (metrics.seo) {
    summaryCards += metricCard('Clicks', metrics.seo.clicks.toLocaleString(), changeIndicator(metrics.seo.clicks, metrics.seo.previousClicks))
    summaryCards += metricCard('Impressions', metrics.seo.impressions.toLocaleString(), changeIndicator(metrics.seo.impressions, metrics.seo.previousImpressions))
    summaryCards += metricCard('Avg Position', metrics.seo.avgPosition.toFixed(1), '')
  }
  if (metrics.uptime) {
    summaryCards += metricCard('Uptime', `${metrics.uptime.uptimePercent}%`, '')
    summaryCards += metricCard('Sites', metrics.uptime.sitesMonitored.toString(), '')
    summaryCards += metricCard('Incidents', metrics.uptime.incidents.toString(), '')
  }

  let rankingSection = ''
  if (metrics.ranking && metrics.ranking.keywords.length > 0) {
    const maxPos = Math.max(...metrics.ranking.keywords.map((k) => k.position), 1)
    const bars = metrics.ranking.keywords
      .slice(0, 10)
      .map((k) => {
        const changeColor = k.change > 0 ? '#059669' : k.change < 0 ? '#dc2626' : '#6b7280'
        const changeText = k.change !== 0 ? ` <span style="color:${changeColor};font-size:11px;">(${k.change > 0 ? '+' : ''}${k.change})</span>` : ''
        return cssBar(`${k.keyword}${changeText}`, k.position, maxPos)
      })
      .join('')
    rankingSection = `
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Keyword Rankings</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td style="font-size:12px;color:#6b7280;">Tracked: <strong style="color:#1f2937;">${metrics.ranking.tracked}</strong></td>
          <td style="font-size:12px;color:#6b7280;text-align:center;">Top 3: <strong style="color:#015035;">${metrics.ranking.top3}</strong></td>
          <td style="font-size:12px;color:#6b7280;text-align:right;">Top 10: <strong style="color:#015035;">${metrics.ranking.top10}</strong></td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bars}</table>
    </td></tr>`
  }

  let reputationSection = ''
  if (metrics.reputation) {
    const stars = '&#9733;'.repeat(Math.round(metrics.reputation.averageRating)) + '&#9734;'.repeat(5 - Math.round(metrics.reputation.averageRating))
    reputationSection = `
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Reputation</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:14px;color:#374151;">Rating: <span style="color:#f59e0b;font-size:16px;">${stars}</span> <strong>${metrics.reputation.averageRating.toFixed(1)}</strong></td>
          <td style="font-size:14px;color:#374151;text-align:center;">New Reviews: <strong>${metrics.reputation.newReviews}</strong></td>
          <td style="font-size:14px;color:#374151;text-align:right;">Total: <strong>${metrics.reputation.totalReviews}</strong>${changeIndicator(metrics.reputation.totalReviews, metrics.reputation.previousTotalReviews)}</td>
        </tr>
      </table>
    </td></tr>`
  }

  const recommendationsHtml = data.recommendations.length
    ? data.recommendations
        .map((r) => `<tr><td style="padding:4px 0;font-size:14px;color:#374151;"><span style="color:#015035;font-weight:700;margin-right:8px;">&#8226;</span>${r}</td></tr>`)
        .join('')
    : '<tr><td style="padding:4px 0;font-size:14px;color:#6b7280;">No recommendations this period.</td></tr>'

  const changelogHtml = data.changelog.length
    ? data.changelog
        .map((c) => `<tr><td style="padding:4px 0;font-size:14px;color:#374151;"><span style="color:#015035;font-weight:700;margin-right:8px;">&#10003;</span>${c}</td></tr>`)
        .join('')
    : '<tr><td style="padding:4px 0;font-size:14px;color:#6b7280;">No changes logged this period.</td></tr>'

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;">

<!-- Header -->
<tr><td style="background:#015035;padding:32px;text-align:center;">
  <img src="https://app.gravissmarketing.com/logo-white.png" alt="Graviss Marketing" style="height:32px;margin-bottom:16px;" />
  <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Monthly Report</h1>
  <p style="margin:6px 0 0;font-size:14px;color:#a7f3d0;">{client_name} &mdash; {period_label}</p>
</td></tr>

<!-- Executive Summary -->
<tr><td style="background:#ffffff;padding:24px 32px;">
  <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Executive Summary</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>${summaryCards}</tr>
  </table>
</td></tr>

<!-- Rankings -->
${rankingSection}

<!-- Reputation -->
${reputationSection}

<!-- Recommendations -->
<tr><td style="padding:24px 32px 0;background:#ffffff;">
  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Recommendations</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${recommendationsHtml}</table>
</td></tr>

<!-- Changelog -->
<tr><td style="padding:24px 32px;background:#ffffff;">
  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#015035;text-transform:uppercase;letter-spacing:0.05em;">Changelog</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${changelogHtml}</table>
</td></tr>

<!-- Footer -->
<tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">Generated on {generated_date}</p>
  <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">&copy; {company_name} &middot; All rights reserved</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  return renderTemplate(html, {
    client_name: data.clientName,
    company_name: data.companyName,
    period_label: data.period.label,
    generated_date: formatDate(new Date()),
  })
}
