import { renderTemplate, formatDate } from './template-helpers'
import type { AppSettings } from '@/lib/settings'
import { BRAND_COLORS } from '@/lib/brand'

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
  wordpressSeo?: {
    averageScore: number
    totalPages: number
    scoreDistribution: { green: number; yellow: number; red: number }
    pluginUpdates: number
    securityIssues: string[]
    worstPages: Array<{ path: string; title: string | null; score: number }>
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

const BRAND_DEFAULTS = {
  primary: BRAND_COLORS.primary,
  secondary: BRAND_COLORS.secondary,
  accent: BRAND_COLORS.accent,
  ink: BRAND_COLORS.ink,
  stone: BRAND_COLORS.stone,
  darkBg: BRAND_COLORS.darkBg,
}

function changeIndicator(current: number, previous: number | undefined): string {
  if (previous === undefined) return ''
  const diff = current - previous
  if (diff === 0) return `<span style="color:${BRAND_DEFAULTS.stone};font-size:12px;margin-left:6px;">no change</span>`
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

function metricCard(label: string, value: string, change: string, primaryColor: string): string {
  return `<td style="padding:8px;width:33%;vertical-align:top;">
    <div style="background:${BRAND_DEFAULTS.secondary};border-radius:8px;padding:16px;text-align:center;">
      <p style="margin:0;font-size:12px;color:${BRAND_DEFAULTS.stone};text-transform:uppercase;letter-spacing:0.05em;font-family:'Montserrat',sans-serif;">${label}</p>
      <p style="margin:6px 0 0;font-size:22px;font-weight:700;color:${primaryColor};font-family:'Montserrat',sans-serif;">${value}${change}</p>
    </div>
  </td>`
}

function cssBar(label: string, value: number, max: number, color: string): string {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return `<tr><td style="padding:6px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:120px;font-size:13px;color:${BRAND_DEFAULTS.ink};vertical-align:middle;font-family:'Montserrat',sans-serif;">${label}</td>
        <td style="vertical-align:middle;padding:0 12px;">
          <div style="background:#e5e7eb;border-radius:4px;height:14px;overflow:hidden;">
            <div style="background:${color};height:100%;width:${pct}%;border-radius:4px;"></div>
          </div>
        </td>
        <td style="width:50px;font-size:13px;font-weight:600;color:${BRAND_DEFAULTS.ink};text-align:right;vertical-align:middle;font-family:'Montserrat',sans-serif;">${value}</td>
      </tr>
    </table>
  </td></tr>`
}

export function generateMonthlyReportHtml(data: MonthlyReportData, settings?: AppSettings): string {
  const { metrics } = data
  const brand = {
    primary: settings?.branding?.primaryColor || BRAND_DEFAULTS.primary,
    secondary: settings?.branding?.secondaryColor || BRAND_DEFAULTS.secondary,
    accent: settings?.branding?.accentColor || BRAND_DEFAULTS.accent,
    ink: settings?.branding?.inkColor || BRAND_DEFAULTS.ink,
    stone: settings?.branding?.stoneColor || BRAND_DEFAULTS.stone,
    darkBg: settings?.branding?.darkBg || BRAND_DEFAULTS.darkBg,
  }
  const primaryColor = brand.primary
  const darkBg = brand.darkBg
  const companyName = settings?.company?.name ?? data.companyName
  const supportEmail = settings?.email.supportEmail ?? 'info@gravissmarketing.com'

  let summaryCards = ''
  if (metrics.traffic) {
    summaryCards += metricCard('Sessions', metrics.traffic.sessions.toLocaleString(), percentChange(metrics.traffic.sessions, metrics.traffic.previousSessions), primaryColor)
    summaryCards += metricCard('Users', metrics.traffic.users.toLocaleString(), percentChange(metrics.traffic.users, metrics.traffic.previousUsers), primaryColor)
    summaryCards += metricCard('Bounce Rate', `${metrics.traffic.bounceRate.toFixed(1)}%`, '', primaryColor)
  }
  if (metrics.seo) {
    summaryCards += metricCard('Clicks', metrics.seo.clicks.toLocaleString(), changeIndicator(metrics.seo.clicks, metrics.seo.previousClicks), primaryColor)
    summaryCards += metricCard('Impressions', metrics.seo.impressions.toLocaleString(), changeIndicator(metrics.seo.impressions, metrics.seo.previousImpressions), primaryColor)
    summaryCards += metricCard('Avg Position', metrics.seo.avgPosition.toFixed(1), '', primaryColor)
  }
  if (metrics.uptime) {
    summaryCards += metricCard('Uptime', `${metrics.uptime.uptimePercent}%`, '', primaryColor)
    summaryCards += metricCard('Sites', metrics.uptime.sitesMonitored.toString(), '', primaryColor)
    summaryCards += metricCard('Incidents', metrics.uptime.incidents.toString(), '', primaryColor)
  }
  if (metrics.wordpressSeo) {
    summaryCards += metricCard('Website SEO Score', `${metrics.wordpressSeo.averageScore}/100`, '', primaryColor)
  }

  let rankingSection = ''
  if (metrics.ranking && metrics.ranking.keywords.length > 0) {
    const maxPos = Math.max(...metrics.ranking.keywords.map((k) => k.position), 1)
    const bars = metrics.ranking.keywords
      .slice(0, 10)
      .map((k) => {
        const changeColor = k.change > 0 ? '#059669' : k.change < 0 ? '#dc2626' : brand.stone
        const changeText = k.change !== 0 ? ` <span style="color:${changeColor};font-size:11px;">(${k.change > 0 ? '+' : ''}${k.change})</span>` : ''
        return cssBar(`${k.keyword}${changeText}`, k.position, maxPos, primaryColor)
      })
      .join('')
    rankingSection = `
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${primaryColor};text-transform:uppercase;letter-spacing:0.06em;font-family:'Syncopate',sans-serif;">Keyword Rankings</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td style="font-size:12px;color:${brand.stone};font-family:'Montserrat',sans-serif;">Tracked: <strong style="color:${brand.ink};">${metrics.ranking.tracked}</strong></td>
          <td style="font-size:12px;color:${brand.stone};text-align:center;font-family:'Montserrat',sans-serif;">Top 3: <strong style="color:${primaryColor};">${metrics.ranking.top3}</strong></td>
          <td style="font-size:12px;color:${brand.stone};text-align:right;font-family:'Montserrat',sans-serif;">Top 10: <strong style="color:${primaryColor};">${metrics.ranking.top10}</strong></td>
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
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${primaryColor};text-transform:uppercase;letter-spacing:0.06em;font-family:'Syncopate',sans-serif;">Reputation</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:14px;color:${brand.ink};font-family:'Montserrat',sans-serif;">Rating: <span style="color:#f59e0b;font-size:16px;">${stars}</span> <strong>${metrics.reputation.averageRating.toFixed(1)}</strong></td>
          <td style="font-size:14px;color:${brand.ink};text-align:center;font-family:'Montserrat',sans-serif;">New Reviews: <strong>${metrics.reputation.newReviews}</strong></td>
          <td style="font-size:14px;color:${brand.ink};text-align:right;font-family:'Montserrat',sans-serif;">Total: <strong>${metrics.reputation.totalReviews}</strong>${changeIndicator(metrics.reputation.totalReviews, metrics.reputation.previousTotalReviews)}</td>
        </tr>
      </table>
    </td></tr>`
  }

  let wordpressSeoSection = ''
  if (metrics.wordpressSeo) {
    const wp = metrics.wordpressSeo
    const scoreColor = wp.averageScore >= 80 ? '#059669' : wp.averageScore >= 50 ? '#d97706' : '#dc2626'
    const worstPagesHtml = wp.worstPages.length
      ? wp.worstPages.slice(0, 3).map(p =>
          `<tr><td style="padding:3px 0;font-size:13px;color:${brand.ink};font-family:'Montserrat',sans-serif;">${p.title || p.path}</td><td style="padding:3px 0;font-size:13px;color:${brand.stone};text-align:right;font-family:'Montserrat',sans-serif;">${p.score}/100</td></tr>`
        ).join('')
      : ''
    const securityHtml = wp.securityIssues.length
      ? `<p style="margin:10px 0 0;font-size:12px;color:#dc2626;font-family:'Montserrat',sans-serif;">&#9888; ${wp.securityIssues.join(' &middot; ')}</p>`
      : ''
    wordpressSeoSection = `
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${primaryColor};text-transform:uppercase;letter-spacing:0.06em;font-family:'Syncopate',sans-serif;">Website SEO Health</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:14px;color:${brand.ink};font-family:'Montserrat',sans-serif;">Avg. Page Score: <strong style="color:${scoreColor};">${wp.averageScore}/100</strong></td>
          <td style="font-size:14px;color:${brand.ink};text-align:center;font-family:'Montserrat',sans-serif;">Pages Scanned: <strong>${wp.totalPages}</strong></td>
          <td style="font-size:14px;color:${brand.ink};text-align:right;font-family:'Montserrat',sans-serif;">Plugin Updates: <strong style="color:${wp.pluginUpdates > 0 ? '#d97706' : brand.ink};">${wp.pluginUpdates}</strong></td>
        </tr>
      </table>
      ${worstPagesHtml ? `<p style="margin:12px 0 4px;font-size:12px;color:${brand.stone};text-transform:uppercase;letter-spacing:0.05em;font-family:'Montserrat',sans-serif;">Pages Needing Attention</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${worstPagesHtml}</table>` : ''}
      ${securityHtml}
    </td></tr>`
  }

  const recommendationsHtml = data.recommendations.length
    ? data.recommendations
        .map((r) => `<tr><td style="padding:4px 0;font-size:14px;color:${brand.ink};font-family:'Montserrat',sans-serif;"><span style="color:${brand.accent};font-weight:700;margin-right:8px;">&#8226;</span>${r}</td></tr>`)
        .join('')
    : `<tr><td style="padding:4px 0;font-size:14px;color:${brand.stone};font-family:'Montserrat',sans-serif;">No recommendations this period.</td></tr>`

  const changelogHtml = data.changelog.length
    ? data.changelog
        .map((c) => `<tr><td style="padding:4px 0;font-size:14px;color:${brand.ink};font-family:'Montserrat',sans-serif;"><span style="color:${primaryColor};font-weight:700;margin-right:8px;">&#10003;</span>${c}</td></tr>`)
        .join('')
    : `<tr><td style="padding:4px 0;font-size:14px;color:${brand.stone};font-family:'Montserrat',sans-serif;">No changes logged this period.</td></tr>`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr><td style="background:${darkBg};padding:32px;text-align:center;">
  <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">{company_name}</h1>
  <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.65);letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">MONTHLY REPORT</p>
  <p style="margin:10px 0 0;font-size:14px;color:${brand.secondary};font-family:'Montserrat',sans-serif;">{client_name} - {period_label}</p>
</td></tr>

<!-- Executive Summary -->
<tr><td style="background:#ffffff;padding:24px 32px;">
  <p style="margin:0 0 16px;font-size:14px;font-weight:700;color:${primaryColor};text-transform:uppercase;letter-spacing:0.06em;font-family:'Syncopate',sans-serif;">Executive Summary</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>${summaryCards}</tr>
  </table>
</td></tr>

<!-- Rankings -->
${rankingSection}

<!-- Reputation -->
${reputationSection}

<!-- Website SEO Health -->
${wordpressSeoSection}

<!-- Recommendations -->
<tr><td style="padding:24px 32px 0;background:#ffffff;">
  <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${primaryColor};text-transform:uppercase;letter-spacing:0.06em;font-family:'Syncopate',sans-serif;">Recommendations</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${recommendationsHtml}</table>
</td></tr>

<!-- Changelog -->
<tr><td style="padding:24px 32px;background:#ffffff;">
  <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:${primaryColor};text-transform:uppercase;letter-spacing:0.06em;font-family:'Syncopate',sans-serif;">Changelog</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${changelogHtml}</table>
</td></tr>

<!-- Footer -->
<tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:${brand.stone};font-family:'Montserrat',sans-serif;">Generated on {generated_date}</p>
  <p style="margin:4px 0 0;font-size:12px;color:${brand.stone};font-family:'Montserrat',sans-serif;">&copy; {company_name} &middot; <a href="mailto:${supportEmail}" style="color:${primaryColor};">${supportEmail}</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  return renderTemplate(html, {
    client_name: data.clientName,
    company_name: companyName,
    period_label: data.period.label,
    generated_date: formatDate(new Date()),
  })
}
