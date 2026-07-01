import { createServiceClient } from '@/lib/supabase'
import { getResend } from '@/lib/resend'

/**
 * Website uptime monitoring.
 *
 * Hits each monitored site, records the result, transitions status, and
 * sends an email alert when a site goes from up → down.
 */

export interface CheckResult {
  up: boolean
  statusCode: number | null
  responseTimeMs: number
  errorMessage: string | null
}

export interface MonitoredSiteRow {
  id: string
  workspace_id: string
  company_id: string | null
  company_name: string
  url: string
  check_interval_minutes: number
  alert_emails: string[]
  status: 'up' | 'down' | 'degraded' | 'paused'
  last_check_at: string | null
  last_up_at: string | null
  last_down_at: string | null
  response_time_ms: number | null
  uptime_30d: number | null
}

const CHECK_TIMEOUT_MS = 10_000
const DEGRADED_THRESHOLD_MS = 3_000

/**
 * Perform an HTTP check against the given URL. Tries HEAD first and falls
 * back to GET if the server doesn't support HEAD (405/501).
 */
export async function checkSite(url: string): Promise<CheckResult> {
  const started = Date.now()

  async function attempt(method: 'HEAD' | 'GET'): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
    try {
      return await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'GravHub-Uptime/1.0 (+https://app.gravissmarketing.com)' },
      })
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    let res: Response
    try {
      res = await attempt('HEAD')
      if (res.status === 405 || res.status === 501) {
        res = await attempt('GET')
      }
    } catch {
      res = await attempt('GET')
    }

    const elapsed = Date.now() - started
    const up = res.status >= 200 && res.status < 400
    return {
      up,
      statusCode: res.status,
      responseTimeMs: elapsed,
      errorMessage: up ? null : `HTTP ${res.status}`,
    }
  } catch (err) {
    const elapsed = Date.now() - started
    const message = err instanceof Error ? err.message : String(err)
    return {
      up: false,
      statusCode: null,
      responseTimeMs: elapsed,
      errorMessage: message.includes('aborted') ? 'Timeout after 10s' : message,
    }
  }
}

/**
 * Record a check result: insert a row into `uptime_checks` and update the
 * corresponding `monitored_sites` row (status transitions, timestamps,
 * latest response time). If the site transitions from up → down, send a
 * down alert to the configured recipients.
 */
export async function recordCheck(siteId: string, result: CheckResult): Promise<void> {
  const db = createServiceClient()

  const { data: site, error: siteErr } = await db
    .from('monitored_sites')
    .select('*')
    .eq('id', siteId)
    .maybeSingle()
  if (siteErr || !site) {
    console.error('[uptime] recordCheck: site not found', siteId, siteErr)
    return
  }

  const typed = site as MonitoredSiteRow
  const now = new Date().toISOString()

  await db.from('uptime_checks').insert({
    id: `uchk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspace_id: typed.workspace_id,
    site_id: siteId,
    checked_at: now,
    status_code: result.statusCode,
    response_time_ms: result.responseTimeMs,
    up: result.up,
    error_message: result.errorMessage,
  })

  // Decide new status
  let newStatus: MonitoredSiteRow['status']
  if (!result.up) {
    newStatus = 'down'
  } else if (result.responseTimeMs > DEGRADED_THRESHOLD_MS) {
    newStatus = 'degraded'
  } else {
    newStatus = 'up'
  }

  // Don't override a manual 'paused' state — the cron already filters
  // these out, but guard against direct callers.
  if (typed.status === 'paused') return

  const update: Record<string, unknown> = {
    status: newStatus,
    last_check_at: now,
    response_time_ms: result.responseTimeMs,
    updated_at: now,
  }
  if (result.up) {
    update.last_up_at = now
  } else {
    update.last_down_at = now
  }

  await db.from('monitored_sites').update(update).eq('id', siteId)

  // Fire alert on up → down transition
  if (!result.up && typed.status !== 'down') {
    try {
      await sendDownAlert({ ...typed, status: newStatus, last_down_at: now }, result)
    } catch (err) {
      console.error('[uptime] sendDownAlert failed', err)
    }
  }
}

/**
 * Compute the 30-day uptime percentage for a site and write it to
 * `monitored_sites.uptime_30d`.
 */
export async function computeUptime30d(siteId: string): Promise<number> {
  const db = createServiceClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('uptime_checks')
    .select('up')
    .eq('site_id', siteId)
    .gte('checked_at', since)

  if (error || !data || data.length === 0) {
    return 100
  }

  const total = data.length
  const ups = data.filter((r: { up: boolean }) => r.up).length
  const pct = Math.round((ups / total) * 10000) / 100

  await db
    .from('monitored_sites')
    .update({ uptime_30d: pct, updated_at: new Date().toISOString() })
    .eq('id', siteId)

  return pct
}

/**
 * Send a "site is down" email alert to the configured recipients.
 */
export async function sendDownAlert(
  site: MonitoredSiteRow,
  result?: CheckResult,
): Promise<void> {
  if (!site.alert_emails || site.alert_emails.length === 0) return

  const reason = result?.errorMessage ?? 'Unknown error'
  const statusCode = result?.statusCode ?? 'N/A'
  const from = process.env.UPTIME_ALERT_FROM ?? 'GravHub Uptime <alerts@gravissmarketing.com>'

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#dc2626;margin:0 0 8px;">Site is down: ${escapeHtml(site.company_name)}</h2>
      <p style="color:#4b5563;margin:0 0 16px;">
        <a href="${escapeHtml(site.url)}" style="color:#015035;">${escapeHtml(site.url)}</a>
        is not responding.
      </p>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;">
        <tr><td style="padding:8px 12px;color:#6b7280;font-size:12px;">Status code</td><td style="padding:8px 12px;font-size:13px;">${statusCode}</td></tr>
        <tr><td style="padding:8px 12px;color:#6b7280;font-size:12px;">Error</td><td style="padding:8px 12px;font-size:13px;">${escapeHtml(reason)}</td></tr>
        <tr><td style="padding:8px 12px;color:#6b7280;font-size:12px;">Detected at</td><td style="padding:8px 12px;font-size:13px;">${new Date().toISOString()}</td></tr>
      </table>
      <p style="color:#9ca3af;font-size:11px;margin-top:16px;">
        You're receiving this because your email is listed on this monitor in GravHub.
      </p>
    </div>
  `

  await (await getResend()).emails.send({
    from,
    to: site.alert_emails,
    subject: `[DOWN] ${site.company_name} — ${site.url}`,
    html,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
