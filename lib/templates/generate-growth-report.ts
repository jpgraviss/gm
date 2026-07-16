import { renderTemplate, formatDate } from './template-helpers'
import type { AppSettings } from '@/lib/settings'
import { BRAND_COLORS } from '@/lib/brand'
import type { ClientReportData } from '@/lib/client-reports'
import type { GrowthNarrative } from '@/lib/report-narrative'

export interface WorkLogCategory {
  title: string
  bullets: string[]
}

export interface NextMonthItem {
  title: string
  description: string
}

export interface GrowthReportData {
  clientName: string
  preparedBy: string
  engagement: string
  period: { start: string; end: string; label: string }
  report: ClientReportData
  narrative: GrowthNarrative
  previous?: {
    seo?: { clicks?: number; impressions?: number; avgPosition?: number }
    traffic?: { sessions?: number; users?: number }
  }
  workLog: WorkLogCategory[]
  nextMonth: NextMonthItem[]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function changeBadge(current: number, previous: number | undefined, lowerIsBetter = false): string {
  if (previous === undefined || previous === current) return ''
  const diff = current - previous
  const better = lowerIsBetter ? diff < 0 : diff > 0
  const arrow = diff > 0 ? '&#9650;' : '&#9660;'
  const color = better ? '#059669' : '#dc2626'
  return `<span style="color:${color};font-size:12px;font-weight:700;margin-left:6px;">${arrow} ${Math.abs(round1(diff))}</span>`
}

function statCard(label: string, value: string, change: string, primaryColor: string, secondaryColor: string, stoneColor: string): string {
  return `<td style="padding:6px;width:25%;vertical-align:top;">
    <div style="background:${secondaryColor};border-radius:10px;padding:16px 12px;text-align:center;">
      <p style="margin:0;font-size:11px;color:${stoneColor};text-transform:uppercase;letter-spacing:0.05em;font-family:'Montserrat',sans-serif;">${label}</p>
      <p style="margin:6px 0 0;font-size:20px;font-weight:800;color:${primaryColor};font-family:'Montserrat',sans-serif;">${value}${change}</p>
    </div>
  </td>`
}

// Single-hue magnitude bars — a ranked comparison of one metric across rows
// (channels, keywords) reads as identity via the label, not the color, so
// one consistent hue (not a categorical palette) is the correct encoding
// per the dataviz "sequential = one hue" rule.
function magnitudeBar(label: string, sublabel: string, value: number, max: number, color: string, ink: string, stone: string): string {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return `<tr><td style="padding:7px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:160px;font-size:13px;color:${ink};vertical-align:middle;font-family:'Montserrat',sans-serif;">${label}${sublabel ? `<br/><span style="font-size:11px;color:${stone};">${sublabel}</span>` : ''}</td>
        <td style="vertical-align:middle;padding:0 12px;">
          <div style="background:#e5e7eb;border-radius:4px;height:10px;overflow:hidden;">
            <div style="background:${color};height:100%;width:${pct}%;border-radius:4px;"></div>
          </div>
        </td>
        <td style="width:70px;font-size:13px;font-weight:700;color:${ink};text-align:right;vertical-align:middle;font-family:'Montserrat',sans-serif;">${fmt(value)}</td>
      </tr>
    </table>
  </td></tr>`
}

function winCard(keyword: string, position: number, change: number, targetUrl: string | null, primaryColor: string, accentColor: string, ink: string, stone: string): string {
  const changeHtml = change !== 0
    ? `<span style="color:#059669;font-size:12px;font-weight:700;">&#9650; moved up ${Math.abs(change)} position${Math.abs(change) === 1 ? '' : 's'}</span>`
    : `<span style="color:${stone};font-size:12px;">holding position</span>`
  return `<td style="padding:6px;width:50%;vertical-align:top;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-left:4px solid ${primaryColor};border-radius:8px;padding:14px 16px;">
      <p style="margin:0;font-size:11px;color:${accentColor};font-weight:700;text-transform:uppercase;letter-spacing:0.04em;font-family:'Montserrat',sans-serif;">Position #${position}</p>
      <p style="margin:4px 0 6px;font-size:15px;font-weight:700;color:${ink};font-family:'Montserrat',sans-serif;">${keyword}</p>
      ${targetUrl ? `<p style="margin:0 0 6px;font-size:11px;color:${stone};word-break:break-all;font-family:'Montserrat',sans-serif;">${targetUrl}</p>` : ''}
      ${changeHtml}
    </div>
  </td>`
}

export function generateGrowthReportHtml(data: GrowthReportData, settings?: AppSettings): string {
  const { report, narrative, previous = {} } = data
  const brand = {
    primary: settings?.branding?.primaryColor || BRAND_COLORS.primary,
    secondary: settings?.branding?.secondaryColor || BRAND_COLORS.secondary,
    accent: settings?.branding?.accentColor || BRAND_COLORS.accent,
    ink: settings?.branding?.inkColor || BRAND_COLORS.ink,
    stone: settings?.branding?.stoneColor || BRAND_COLORS.stone,
    darkBg: settings?.branding?.darkBg || BRAND_COLORS.darkBg,
  }
  const companyName = settings?.company?.name ?? 'Graviss Marketing'
  const supportEmail = settings?.email.supportEmail ?? 'info@gravissmarketing.com'
  const website = settings?.company?.website ?? 'gravissmarketing.com'

  // ── Work completed (paired two-per-row) ─────────────────────────────────
  const workLogRows: string[] = []
  const cells = data.workLog.map(cat => `
      <td style="padding:8px;width:50%;vertical-align:top;">
        <div style="background:${brand.secondary};border-radius:10px;padding:16px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:${brand.primary};text-transform:uppercase;letter-spacing:0.05em;font-family:'Montserrat',sans-serif;">${cat.title}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${cat.bullets.map(b => `<tr><td style="padding:2px 0;font-size:13px;color:${brand.ink};font-family:'Montserrat',sans-serif;"><span style="color:${brand.accent};margin-right:6px;">&#8226;</span>${b}</td></tr>`).join('')}
          </table>
        </div>
      </td>`)
  for (let i = 0; i < cells.length; i += 2) {
    workLogRows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td style="width:50%;"></td>'}</tr>`)
  }

  // ── Search visibility ──────────────────────────────────────────────────
  let searchSection = ''
  if (report.seo) {
    const cards =
      statCard('Clicks', fmt(report.seo.clicks), changeBadge(report.seo.clicks, previous.seo?.clicks), brand.primary, brand.secondary, brand.stone) +
      statCard('Impressions', fmt(report.seo.impressions), changeBadge(report.seo.impressions, previous.seo?.impressions), brand.primary, brand.secondary, brand.stone) +
      statCard('Avg. Position', round1(report.seo.avgPosition).toString(), changeBadge(round1(report.seo.avgPosition), previous.seo?.avgPosition !== undefined ? round1(previous.seo.avgPosition) : undefined, true), brand.primary, brand.secondary, brand.stone) +
      statCard('CTR', `${round1(report.seo.ctr)}%`, '', brand.primary, brand.secondary, brand.stone)
    searchSection = `
    <tr><td style="padding:28px 32px 0;background:#ffffff;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${brand.primary};text-transform:uppercase;letter-spacing:0.06em;font-family:'Montserrat',sans-serif;">Search Visibility &amp; Rankings</p>
      <p style="margin:0 0 14px;font-size:14px;color:${brand.ink};line-height:1.6;font-family:'Montserrat',sans-serif;">${narrative.searchVisibility}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cards}</tr></table>
    </td></tr>`
  }

  // ── Traffic channels ────────────────────────────────────────────────────
  let channelsSection = ''
  if (report.traffic && report.traffic.channels.length > 0) {
    const top = [...report.traffic.channels].sort((a, b) => b.sessions - a.sessions).slice(0, 6)
    const max = Math.max(...top.map(c => c.sessions), 1)
    const bars = top.map(c => magnitudeBar(c.channel, `${fmt(c.users)} users`, c.sessions, max, brand.primary, brand.ink, brand.stone)).join('')
    channelsSection = `
    <tr><td style="padding:28px 32px 0;background:#ffffff;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${brand.primary};text-transform:uppercase;letter-spacing:0.06em;font-family:'Montserrat',sans-serif;">Traffic Channels</p>
      <p style="margin:0 0 14px;font-size:14px;color:${brand.ink};line-height:1.6;font-family:'Montserrat',sans-serif;">${narrative.trafficChannels}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bars}</table>
    </td></tr>`
  }

  // ── Engagement ──────────────────────────────────────────────────────────
  let engagementSection = ''
  if (report.traffic) {
    const cards =
      statCard('Users', fmt(report.traffic.users), changeBadge(report.traffic.users, previous.traffic?.users), brand.primary, brand.secondary, brand.stone) +
      statCard('Sessions', fmt(report.traffic.sessions), '', brand.primary, brand.secondary, brand.stone) +
      statCard('Avg. Session', `${Math.round(report.traffic.avgSessionDurationSec / 60)}m`, '', brand.primary, brand.secondary, brand.stone) +
      statCard('Bounce Rate', `${round1(report.traffic.bounceRate)}%`, '', brand.primary, brand.secondary, brand.stone)
    engagementSection = `
    <tr><td style="padding:28px 32px 0;background:#ffffff;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${brand.primary};text-transform:uppercase;letter-spacing:0.06em;font-family:'Montserrat',sans-serif;">User Engagement</p>
      <p style="margin:0 0 14px;font-size:14px;color:${brand.ink};line-height:1.6;font-family:'Montserrat',sans-serif;">${narrative.engagement}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cards}</tr></table>
    </td></tr>`
  }

  // ── Keyword wins (real position-history deltas, not screenshots) ───────
  let winsSection = ''
  if (report.ranking && report.ranking.keywords.length > 0) {
    const wins = [...report.ranking.keywords]
      .filter(k => k.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 6)
    if (wins.length > 0) {
      const cardsRows: string[] = []
      for (let i = 0; i < wins.length; i += 2) {
        const a = wins[i]
        const b = wins[i + 1]
        cardsRows.push(`<tr>${winCard(a.keyword, a.position, a.change, a.targetUrl, brand.primary, brand.accent, brand.ink, brand.stone)}${b ? winCard(b.keyword, b.position, b.change, b.targetUrl, brand.primary, brand.accent, brand.ink, brand.stone) : '<td style="width:50%;"></td>'}</tr>`)
      }
      winsSection = `
      <tr><td style="padding:28px 32px 0;background:#ffffff;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${brand.primary};text-transform:uppercase;letter-spacing:0.06em;font-family:'Montserrat',sans-serif;">Keyword Ranking Wins</p>
        <p style="margin:0 0 14px;font-size:12px;color:${brand.stone};font-family:'Montserrat',sans-serif;">Tracked: <strong style="color:${brand.ink};">${report.ranking.tracked}</strong> &middot; Top 10: <strong style="color:${brand.primary};">${report.ranking.top10}</strong> &middot; Top 3: <strong style="color:${brand.primary};">${report.ranking.top3}</strong></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cardsRows.join('')}</table>
      </td></tr>`
    }
  }

  // ── Pages in search (honest proxy — not a true index-coverage claim) ────
  let searchFootprintSection = ''
  if (report.seo && report.seo.pagesInSearch > 0) {
    searchFootprintSection = `
    <tr><td style="padding:20px 32px 0;background:#ffffff;">
      <div style="background:${brand.secondary};border-radius:10px;padding:14px 16px;">
        <p style="margin:0;font-size:12px;color:${brand.stone};font-family:'Montserrat',sans-serif;">Pages appearing in Google Search this period</p>
        <p style="margin:2px 0 0;font-size:20px;font-weight:800;color:${brand.primary};font-family:'Montserrat',sans-serif;">${fmt(report.seo.pagesInSearch)}</p>
      </div>
    </td></tr>`
  }

  // ── Next month priorities ───────────────────────────────────────────────
  const nextMonthHtml = data.nextMonth.length > 0
    ? data.nextMonth.map((item, i) => `
      <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:32px;vertical-align:top;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background:${brand.primary};color:#fff;font-size:11px;font-weight:700;font-family:'Montserrat',sans-serif;">${i + 1}</span></td>
          <td style="vertical-align:top;">
            <p style="margin:0;font-size:13px;font-weight:700;color:${brand.ink};font-family:'Montserrat',sans-serif;">${item.title}</p>
            <p style="margin:2px 0 0;font-size:12px;color:${brand.stone};font-family:'Montserrat',sans-serif;">${item.description}</p>
          </td>
        </tr></table>
      </td></tr>`).join('')
    : ''

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{client_name} — Growth Report — {period_label}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap'); @media print { body { background:#fff !important; } .no-print { display:none !important; } }</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

<!-- Cover -->
<tr><td style="background:${brand.darkBg};padding:48px 40px;text-align:center;">
  <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.15em;color:${brand.accent};font-weight:700;font-family:'Syncopate',sans-serif;">{period_label} &middot; GROWTH REPORT</p>
  <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:0.02em;font-family:'Syncopate',sans-serif;">Your growth engine, at work.</h1>
  <p style="margin:0 auto;max-width:440px;font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6;font-family:'Montserrat',sans-serif;">${narrative.monthInOneLine}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
    <tr>
      <td style="padding:0 18px;text-align:left;border-left:2px solid rgba(255,255,255,0.15);">
        <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;font-family:'Montserrat',sans-serif;">Prepared For</p>
        <p style="margin:2px 0 0;font-size:13px;color:#fff;font-family:'Montserrat',sans-serif;">{client_name}</p>
      </td>
      <td style="padding:0 18px;text-align:left;border-left:2px solid rgba(255,255,255,0.15);">
        <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;font-family:'Montserrat',sans-serif;">Prepared By</p>
        <p style="margin:2px 0 0;font-size:13px;color:#fff;font-family:'Montserrat',sans-serif;">{prepared_by}</p>
      </td>
      <td style="padding:0 18px;text-align:left;border-left:2px solid rgba(255,255,255,0.15);">
        <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.05em;font-family:'Montserrat',sans-serif;">Engagement</p>
        <p style="margin:2px 0 0;font-size:13px;color:#fff;font-family:'Montserrat',sans-serif;">{engagement}</p>
      </td>
    </tr>
  </table>
</td></tr>

<!-- Work completed -->
${data.workLog.length > 0 ? `
<tr><td style="padding:28px 32px 0;background:#ffffff;">
  <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:${brand.primary};text-transform:uppercase;letter-spacing:0.06em;font-family:'Montserrat',sans-serif;">Work We Completed This Month</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${workLogRows.join('')}</table>
</td></tr>` : ''}

<!-- Search visibility -->
${searchSection}

<!-- Traffic channels -->
${channelsSection}

<!-- Engagement -->
${engagementSection}

<!-- Search footprint -->
${searchFootprintSection}

<!-- Keyword wins -->
${winsSection}

<!-- Next month -->
${data.nextMonth.length > 0 ? `
<tr><td style="padding:28px 32px 0;background:#ffffff;">
  <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${brand.primary};text-transform:uppercase;letter-spacing:0.06em;font-family:'Montserrat',sans-serif;">Next Month</p>
  <p style="margin:0 0 14px;font-size:13px;color:${brand.stone};font-family:'Montserrat',sans-serif;">Turning visibility into pipeline.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${nextMonthHtml}</table>
</td></tr>` : ''}

<!-- Closing -->
<tr><td style="background:${brand.darkBg};padding:32px 40px;text-align:center;">
  <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#fff;font-family:'Syncopate',sans-serif;">${companyName.toUpperCase()}</p>
  <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.6);font-family:'Montserrat',sans-serif;">${website} &middot; Generated {generated_date}</p>
</td></tr>

<!-- Footer -->
<tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:11px;color:${brand.stone};font-family:'Montserrat',sans-serif;">&copy; ${companyName} &middot; <a href="mailto:${supportEmail}" style="color:${brand.primary};">${supportEmail}</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  return renderTemplate(html, {
    client_name: data.clientName,
    prepared_by: data.preparedBy,
    engagement: data.engagement,
    period_label: data.period.label,
    generated_date: formatDate(new Date()),
  })
}
