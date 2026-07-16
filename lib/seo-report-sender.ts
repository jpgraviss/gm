import { createServiceClient } from '@/lib/supabase'
import { buildClientReport, saveReportSnapshot, getPreviousSnapshot, type ClientReportConfig, type ClientReportData } from '@/lib/client-reports'
import { generateGrowthReportHtml, type WorkLogCategory, type NextMonthItem } from '@/lib/templates/generate-growth-report'
import { generateGrowthNarrative } from '@/lib/report-narrative'
import { sendEmail } from '@/lib/email'
import { getSettings, type AppSettings } from '@/lib/settings'

/**
 * Assembles and renders the full growth report — real GSC/GA4/rank-tracker
 * data, month-over-month deltas pulled from the last saved snapshot, an
 * AI-or-fallback narrative, and whatever staff entered in report_work_log
 * for this exact period (falls back to empty sections if nothing was
 * entered — never fabricated).
 */
async function buildGrowthReportHtml(
  reportData: ClientReportData,
  companyName: string,
  period: { start: string; end: string; label: string },
  settings: AppSettings,
): Promise<string> {
  const [prevSeo, prevTraffic] = await Promise.all([
    getPreviousSnapshot(companyName, 'search_console', period.start),
    getPreviousSnapshot(companyName, 'analytics', period.start),
  ])
  const previous = {
    seo: prevSeo ? { clicks: prevSeo.clicks as number, impressions: prevSeo.impressions as number, avgPosition: prevSeo.avgPosition as number } : undefined,
    traffic: prevTraffic ? { sessions: prevTraffic.sessions as number, users: prevTraffic.users as number } : undefined,
  }

  const narrative = await generateGrowthNarrative(reportData, previous)

  const db = createServiceClient()
  const { data: workLogRow } = await db
    .from('report_work_log')
    .select('categories, next_month, updated_by')
    .eq('company_name', companyName)
    .eq('period_start', period.start)
    .maybeSingle()

  return generateGrowthReportHtml({
    clientName: companyName,
    preparedBy: (workLogRow?.updated_by as string) || `${settings?.company.name ?? 'Graviss Marketing'} Growth Team`,
    engagement: 'SEO & Digital Growth',
    period,
    report: reportData,
    narrative,
    previous,
    workLog: (workLogRow?.categories as WorkLogCategory[]) ?? [],
    nextMonth: (workLogRow?.next_month as NextMonthItem[]) ?? [],
  }, settings)
}

interface ClientIntegration {
  id: string
  company_name: string
  company_id: string | null
  gsc_site_url: string | null
  ga4_property_id: string | null
  gbp_location_name: string | null
  portal_enabled: boolean
  seo_reports_enabled: boolean
  seo_report_recipients: string[] | null
  last_seo_report_at: string | null
}

interface SendResult {
  company: string
  sent: boolean
  recipient?: string
  error?: string
}

function lastMonthRange(): { start: string; end: string; label: string } {
  const now = new Date()
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1)
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const monthName = firstOfPrevMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return { start: fmt(firstOfPrevMonth), end: fmt(lastOfPrevMonth), label: monthName }
}

export async function seoReportsDue(): Promise<boolean> {
  const today = new Date()
  if (today.getUTCDate() !== 1) return false

  const db = createServiceClient()
  const { data } = await db
    .from('client_integrations')
    .select('last_seo_report_at')
    .eq('seo_reports_enabled', true)
    .order('last_seo_report_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!data?.last_seo_report_at) return true

  const lastSent = new Date(data.last_seo_report_at)
  const startOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  return lastSent < startOfToday
}

export async function sendMonthlyClientReports(): Promise<{ sent: number; failed: number; results: SendResult[] }> {
  const db = createServiceClient()
  const settings = await getSettings()

  const { data: integrations, error } = await db
    .from('client_integrations')
    .select('*')
    .eq('seo_reports_enabled', true)

  if (error || !integrations || integrations.length === 0) {
    return { sent: 0, failed: 0, results: [] }
  }

  const { start, end, label } = lastMonthRange()
  const results: SendResult[] = []
  let sent = 0
  let failed = 0

  for (const integration of integrations as ClientIntegration[]) {
    try {
      const config: ClientReportConfig = {
        companyName: integration.company_name,
        companyId: integration.company_id ?? undefined,
        gscSiteUrl: integration.gsc_site_url ?? undefined,
        ga4PropertyId: integration.ga4_property_id ?? undefined,
        gbpLocationName: integration.gbp_location_name ?? undefined,
        startDate: start,
        endDate: end,
      }

      const reportData = await buildClientReport(config)
      await saveReportSnapshot(reportData)

      let recipientEmails: string[] = []

      if (integration.seo_report_recipients?.length) {
        recipientEmails = integration.seo_report_recipients
      } else if (integration.company_id) {
        const { data: contacts } = await db
          .from('crm_contacts')
          .select('emails')
          .eq('company_id', integration.company_id)
          .eq('is_primary', true)
          .limit(1)

        if (contacts?.[0]) {
          const emails = (contacts[0] as { emails: string[] }).emails
          if (emails?.length) recipientEmails = [emails[0]]
        }
      }

      if (recipientEmails.length === 0) {
        results.push({ company: integration.company_name, sent: false, error: 'No recipient found' })
        failed++
        continue
      }

      const html = await buildGrowthReportHtml(reportData, integration.company_name, { start, end, label }, settings)

      const emailResult = await sendEmail({
        to: recipientEmails,
        subject: `Your Growth Report — ${label}`,
        html,
      })

      if (emailResult.success) {
        await db
          .from('client_integrations')
          .update({ last_seo_report_at: new Date().toISOString() })
          .eq('id', integration.id)

        results.push({ company: integration.company_name, sent: true, recipient: recipientEmails.join(', ') })
        sent++
      } else {
        results.push({ company: integration.company_name, sent: false, recipient: recipientEmails.join(', '), error: emailResult.error })
        failed++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[seo-reports] Failed for ${integration.company_name}:`, err)
      results.push({ company: integration.company_name, sent: false, error: message })
      failed++
    }
  }

  return { sent, failed, results }
}

export async function sendSingleReport(companyName: string, options?: { recipientOverride?: string; preview?: boolean }): Promise<{ html: string; sent: boolean; recipient?: string; error?: string }> {
  const db = createServiceClient()
  const settings = await getSettings()

  const { data: integration } = await db
    .from('client_integrations')
    .select('*')
    .eq('company_name', companyName)
    .maybeSingle()

  if (!integration) {
    return { html: '', sent: false, error: 'No integration found for this company' }
  }

  const row = integration as ClientIntegration
  const { start, end, label } = lastMonthRange()

  const reportData = await buildClientReport({
    companyName: row.company_name,
    companyId: row.company_id ?? undefined,
    gscSiteUrl: row.gsc_site_url ?? undefined,
    ga4PropertyId: row.ga4_property_id ?? undefined,
    gbpLocationName: row.gbp_location_name ?? undefined,
    startDate: start,
    endDate: end,
  })

  const html = await buildGrowthReportHtml(reportData, row.company_name, { start, end, label }, settings)

  if (options?.preview) {
    return { html, sent: false }
  }

  let recipientEmails: string[] = options?.recipientOverride ? [options.recipientOverride] : []

  if (recipientEmails.length === 0 && row.seo_report_recipients?.length) {
    recipientEmails = row.seo_report_recipients
  }

  if (recipientEmails.length === 0 && row.company_id) {
    const { data: contacts } = await db
      .from('crm_contacts')
      .select('emails')
      .eq('company_id', row.company_id)
      .eq('is_primary', true)
      .limit(1)

    if (contacts?.[0]) {
      const emails = (contacts[0] as { emails: string[] }).emails
      if (emails?.length) recipientEmails = [emails[0]]
    }
  }

  if (recipientEmails.length === 0) {
    return { html, sent: false, error: 'No recipient found' }
  }

  const result = await sendEmail({
    to: recipientEmails,
    subject: `Your Growth Report — ${label}`,
    html,
  })

  if (result.success) {
    await saveReportSnapshot(reportData)
    await db
      .from('client_integrations')
      .update({ last_seo_report_at: new Date().toISOString() })
      .eq('id', row.id)
  }

  return { html, sent: result.success, recipient: recipientEmails.join(', '), error: result.error }
}
