import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { checkSite, recordCheck, computeUptime30d, type MonitoredSiteRow } from '@/lib/uptime'
import { checkAllRanks, sendDueScheduledReports } from '@/lib/rank-tracker'
import { publishSocialPost } from '@/lib/social-publish'
import { processScheduledEmails } from '@/lib/email-scheduler'
import { sendMonthlyClientReports, seoReportsDue } from '@/lib/seo-report-sender'
import { syncGranolaNotes, isGranolaConfigured } from '@/lib/granola'
import { dispatchReviewCampaign } from '@/lib/review-campaigns'

/**
 * Cron endpoint — called on a schedule (e.g. every 6 hours via Vercel Cron).
 * Handles:
 * 1. Execute pending email sequence steps
 * 2. Check for time-based automation triggers (overdue invoices, upcoming renewals)
 */
export const GET = withErrorHandler('cron GET', async (req) => {
  // Verify cron secret — always required in production
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  // 1. Execute pending sequence steps
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const seqRes = await fetch(`${baseUrl}/api/sequences/execute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    results.sequences = await seqRes.json()
  } catch (err) {
    console.error('[cron] Sequence execution failed:', err)
    results.sequences = { error: 'Failed' }
  }

  // 1b. Check for sequence replies
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const replyRes = await fetch(`${baseUrl}/api/sequences/reply-check`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    results.sequenceReplies = await replyRes.json()
  } catch (err) {
    console.error('[cron] Sequence reply check failed:', err)
    results.sequenceReplies = { error: 'Failed' }
  }

  // 1c. Resume pending automation steps (Wait action)
  try {
    await resumePendingAutomationSteps()
    results.pendingSteps = { checked: true }
  } catch (err) {
    console.error('[cron] Pending automation steps failed:', err)
    results.pendingSteps = { error: 'Failed' }
  }

  // 2. Check time-based automation triggers
  try {
    await checkTimeBasedTriggers()
    results.timeTriggers = { checked: true }
  } catch (err) {
    console.error('[cron] Time-based trigger check failed:', err)
    results.timeTriggers = { error: 'Failed' }
  }

  // 3. Calendar sync
  try {
    const baseUrl2 = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const syncRes = await fetch(`${baseUrl2}/api/calendar/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    results.calendarSync = await syncRes.json()
  } catch (err) {
    console.error('[cron] Calendar sync failed:', err)
    results.calendarSync = { error: 'Failed' }
  }

  // 4. Spawn next occurrence for completed recurring tasks
  try {
    await spawnRecurringTasks()
    results.recurringTasks = { checked: true }
  } catch (err) {
    console.error('[cron] Recurring task spawn failed:', err)
    results.recurringTasks = { error: 'Failed' }
  }

  // 4. Email-to-ticket conversion
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const emailRes = await fetch(`${baseUrl}/api/tickets/from-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    results.emailToTicket = await emailRes.json()
  } catch (err) {
    console.error('[cron] Email-to-ticket failed:', err)
    results.emailToTicket = { error: 'Failed' }
  }

  // 5. Website uptime checks — run every cron invocation, but only hit each
  //    site if its last_check_at is older than its check_interval_minutes.
  try {
    results.uptime = await runUptimeChecks()
  } catch (err) {
    console.error('[cron] Uptime checks failed:', err)
    results.uptime = { error: 'Failed' }
  }

  // 5b. Publish scheduled social posts whose scheduled_at has passed.
  try {
    results.socialPosts = await publishScheduledSocialPosts()
  } catch (err) {
    console.error('[cron] Scheduled social publishing failed:', err)
    results.socialPosts = { error: 'Failed' }
  }

  // 6. Keyword rank tracker — once per UTC day. GSC data has a 2-3 day lag,
  //    so running more than once/day is wasted quota. We detect "already ran
  //    today" by checking whether the most-recently-checked tracked keyword
  //    was updated during the current UTC date.
  try {
    if (await rankCheckDue()) {
      results.rankTracker = await checkAllRanks()
    } else {
      results.rankTracker = { skipped: true }
    }
  } catch (err) {
    console.error('[cron] Rank tracker failed:', err)
    results.rankTracker = { error: 'Failed' }
  }

  // 7. Process scheduled/recurring emails that are due.
  try {
    results.scheduledEmails = await processScheduledEmails()
  } catch (err) {
    console.error('[cron] Scheduled email processing failed:', err)
    results.scheduledEmails = { error: 'Failed' }
  }

  // 8. Monthly SEO reports — runs on the 1st of each month.
  try {
    if (await seoReportsDue()) {
      results.seoReports = await sendMonthlyClientReports()
    } else {
      results.seoReports = { skipped: true }
    }
  } catch (err) {
    console.error('[cron] SEO report sending failed:', err)
    results.seoReports = { error: 'Failed' }
  }

  // 9. Granola meeting-notes sync — no-op until an API key is saved in
  //    Settings > Integrations (lib/granola.ts).
  try {
    if (await isGranolaConfigured()) {
      results.granola = await syncGranolaNotes()
    } else {
      results.granola = { skipped: true }
    }
  } catch (err) {
    console.error('[cron] Granola sync failed:', err)
    results.granola = { error: 'Failed' }
  }

  // 10. Dispatch scheduled review campaigns whose scheduled_at has passed.
  try {
    results.reviewCampaigns = await dispatchScheduledReviewCampaigns()
  } catch (err) {
    console.error('[cron] Review campaign dispatch failed:', err)
    results.reviewCampaigns = { error: 'Failed' }
  }

  // 11. Send scheduled rank-tracker ranking reports whose cadence is due.
  try {
    results.rankTrackerReports = await sendDueScheduledReports()
  } catch (err) {
    console.error('[cron] Rank tracker scheduled reports failed:', err)
    results.rankTrackerReports = { error: 'Failed' }
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...results })
})

/**
 * Send review campaigns whose scheduled_at has arrived. Each row is claimed
 * atomically (status 'scheduled' -> 'active', only proceeding if the update
 * actually returned a row) so two overlapping cron ticks can't both dispatch
 * the same campaign twice.
 */
async function dispatchScheduledReviewCampaigns(): Promise<{ dispatched: number; sent: number; failed: number }> {
  const db = createServiceClient()
  const now = new Date().toISOString()

  const { data: due } = await db
    .from('review_campaigns')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .limit(20)

  let dispatched = 0
  let sent = 0
  let failed = 0

  for (const row of due ?? []) {
    const { data: claimed } = await db
      .from('review_campaigns')
      .update({ status: 'active' })
      .eq('id', row.id)
      .eq('status', 'scheduled')
      .select('*')
      .maybeSingle()
    if (!claimed) continue

    dispatched++
    try {
      const result = await dispatchReviewCampaign(db, claimed)
      sent += result.sent
      failed += result.failed
      await db.from('review_campaigns').update({ status: 'sent' }).eq('id', claimed.id)
    } catch (err) {
      console.error('[cron] Failed to dispatch review campaign', claimed.id, err)
      // Leave it claimable again rather than stuck 'active' forever.
      await db.from('review_campaigns').update({ status: 'scheduled' }).eq('id', claimed.id)
      failed++
    }
  }

  return { dispatched, sent, failed }
}

/**
 * Determine if we should run the daily rank-tracking job on this cron tick.
 * Returns true when the most recently-checked tracked keyword was checked
 * before the start of today (UTC) — i.e., we have not yet run today.
 */
async function rankCheckDue(): Promise<boolean> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('tracked_keywords')
    .select('last_checked_at')
    .order('last_checked_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[cron] rankCheckDue query failed:', error)
    return false
  }
  // No tracked keywords yet — nothing to do, but still "due" is fine; the
  // job is a cheap no-op.
  if (!data?.last_checked_at) return true

  const last = new Date(data.last_checked_at)
  const now = new Date()
  const sameUtcDay =
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth() === now.getUTCMonth() &&
    last.getUTCDate() === now.getUTCDate()
  return !sameUtcDay
}

/**
 * Iterate non-paused monitored sites, run HTTP checks that are due, record
 * results, and refresh the 30-day uptime percentage.
 */
async function runUptimeChecks(): Promise<{ checked: number; skipped: number; errors: number }> {
  const db = createServiceClient()

  const { data: sites, error } = await db
    .from('monitored_sites')
    .select('*')
    .neq('status', 'paused')

  if (error) {
    console.error('[cron] Failed to load monitored sites:', error)
    return { checked: 0, skipped: 0, errors: 1 }
  }

  const now = Date.now()
  let checked = 0
  let skipped = 0
  let errors = 0

  for (const site of (sites ?? []) as MonitoredSiteRow[]) {
    const interval = (site.check_interval_minutes ?? 15) * 60_000
    if (site.last_check_at) {
      const last = new Date(site.last_check_at).getTime()
      if (now - last < interval) {
        skipped++
        continue
      }
    }

    try {
      const result = await checkSite(site.url)
      await recordCheck(site.id, result)
      // Refresh 30d uptime on up→down transitions or roughly once per hour
      if (!result.up || Math.random() < 0.1) {
        await computeUptime30d(site.id)
      }
      checked++
    } catch (err) {
      console.error('[cron] uptime check failed for', site.id, err)
      errors++
    }
  }

  return { checked, skipped, errors }
}

/**
 * Publish social posts whose scheduled_at has passed. Each post goes through
 * the same publisher path as a manual publish, so per-platform success/failure
 * is recorded honestly.
 */
async function publishScheduledSocialPosts(): Promise<{ published: number; failed: number; skipped: number }> {
  const db = createServiceClient()
  const now = new Date().toISOString()

  const { data: due, error } = await db
    .from('social_posts')
    .select('id')
    .eq('status', 'scheduled')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', now)
    .limit(50)

  if (error) {
    console.error('[cron] Failed to load scheduled social posts:', error)
    return { published: 0, failed: 0, skipped: 0 }
  }

  let published = 0
  let failed = 0
  let skipped = 0

  for (const row of due ?? []) {
    try {
      const result = await publishSocialPost(row.id)
      if (result.reason) { skipped++; continue }
      if (result.anySucceeded) published++
      else failed++
    } catch (err) {
      console.error('[cron] Failed to publish scheduled post', row.id, err)
      failed++
    }
  }

  return { published, failed, skipped }
}

async function spawnRecurringTasks() {
  const db = createServiceClient()

  // Find completed tasks that still have a recurrence rule (haven't spawned yet)
  const { data: completedRecurring, error } = await db
    .from('app_tasks')
    .select('*')
    .eq('status', 'Completed')
    .not('recurrence', 'is', null)

  if (error) {
    console.error('[cron] Failed to query recurring tasks:', error)
    return
  }

  for (const task of completedRecurring ?? []) {
    const rec = task.recurrence as { frequency: string; interval: number; endDate?: string }
    if (!rec?.frequency || !rec?.interval) continue

    // Calculate next due date from the original due date
    const baseDue = new Date(task.due_date)
    if (isNaN(baseDue.getTime())) continue

    const nextDue = new Date(baseDue)
    const originalDay = nextDue.getDate()
    switch (rec.frequency) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + rec.interval)
        break
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + rec.interval * 7)
        break
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + rec.interval)
        // setMonth silently overflows for due-days 29-31 into whatever day
        // the target month lands on (Jan 31 + 1mo -> Mar 3, skipping
        // February entirely) — clamp back to the target month's last day.
        if (nextDue.getDate() !== originalDay) nextDue.setDate(0)
        break
      default:
        continue
    }

    const nextDueStr = nextDue.toISOString().split('T')[0]

    // Atomic claim — null recurrence first, conditioned on it still being
    // set, so two overlapping cron ticks (GH Actions pings every 5 min,
    // no execution-time guard) can't both read this same completed task
    // and both spawn a duplicate next occurrence. Sibling jobs in this
    // file (resumePendingAutomationSteps, dispatchScheduledReviewCampaigns)
    // already use this claim-before-work pattern; this was the one job
    // missing it.
    const { data: claimed } = await db
      .from('app_tasks')
      .update({ recurrence: null })
      .eq('id', task.id)
      .not('recurrence', 'is', null)
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    // Respect endDate — don't spawn if next date is past endDate
    // (recurrence is already cleared above, so it won't be re-checked)
    if (rec.endDate && nextDueStr > rec.endDate) {
      continue
    }

    // Create the new task with same fields but new ID, Pending status, updated due date
    await db.from('app_tasks').insert({
      id:                `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title:             task.title,
      description:       task.description ?? null,
      category:          task.category,
      priority:          task.priority,
      status:            'Pending',
      company:           task.company ?? null,
      assigned_to:       task.assigned_to,
      due_date:          nextDueStr,
      created_date:      new Date().toISOString().split('T')[0],
      linked_id:         task.linked_id ?? null,
      team_service_line: task.team_service_line ?? null,
      recurrence:        task.recurrence,
      parent_task_id:    task.id,
    })
  }
}

// automation_pending_steps has no status column — resume position is
// tracked via step_index (an index into the automation's own actions
// array), not a frozen remaining_actions snapshot. The row is claimed
// atomically by deleting it: only the invocation whose DELETE actually
// returns a row proceeds, so two overlapping cron ticks (or a retry)
// can't both pick up and re-execute the same step (AUDIT.md #12/#13).
async function resumePendingAutomationSteps() {
  const db = createServiceClient()
  const now = new Date().toISOString()

  const { data: pending } = await db
    .from('automation_pending_steps')
    .select('id')
    .lte('resume_at', now)
    .limit(50)

  if (!pending?.length) return

  for (const step of pending) {
    const { data: claimed } = await db
      .from('automation_pending_steps')
      .delete()
      .eq('id', step.id)
      .select('*')
      .maybeSingle()
    if (!claimed) continue

    try {
      const { data: automation } = await db
        .from('automations')
        .select('*')
        .eq('id', claimed.automation_id)
        .single()

      // The paused run's automation_runs row is sitting at status 'waiting'
      // and would stay there forever if we just `continue` here — finalize
      // it as failed so it's not silently indistinguishable from a run
      // that's still genuinely in progress.
      if (!automation || automation.status !== 'Active') {
        await db.from('automation_runs').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error: !automation
            ? 'Automation was deleted while a Wait step was pending'
            : `Automation was ${automation.status?.toLowerCase() ?? 'paused'} while a Wait step was pending`,
        }).eq('id', claimed.run_id).then(() => {}, () => {})
        continue
      }

      // Re-fetched fresh from the automation's current actions, not a
      // snapshot taken when the Wait fired — if the automation was edited
      // while a step was pending, resume reflects the latest version.
      const allActions = (automation.actions as unknown[]) ?? []
      const remainingActions = allActions.slice((claimed.step_index as number) ?? 0)
      const ctx = (claimed.context as Record<string, unknown>) ?? {}

      const { data: existingRun } = await db
        .from('automation_runs')
        .select('steps')
        .eq('id', claimed.run_id)
        .maybeSingle()
      // Drop the trailing 'pending' placeholders the pause recorded for
      // these exact actions — they're about to be replaced with real
      // results, so keeping them would duplicate every remaining step.
      const priorSteps = ((existingRun?.steps as { status: string }[]) ?? [])
        .filter(s => s.status !== 'pending')

      if (remainingActions.length > 0) {
        const { executeWorkflow } = await import('@/lib/automations-engine')
        await executeWorkflow(
          { ...automation, actions: remainingActions },
          'pending_resume',
          ctx,
          db,
          true,
          (claimed.step_index as number) ?? 0,
          claimed.run_id as string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          priorSteps as any,
        )
      } else {
        await db.from('automation_runs').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        }).eq('id', claimed.run_id).then(() => {}, () => {})
      }
    } catch (err) {
      // The pending-step row is already gone (claimed via delete above).
      // executeWorkflow has its own internal try/catch around action
      // execution, so a failure there already finalizes the run's own
      // automation_runs row — this only fires for an error outside that
      // (e.g. before executeWorkflow is even reached), which would
      // otherwise leave the run stuck at 'waiting' forever.
      await db.from('automation_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      }).eq('id', claimed.run_id).then(() => {}, () => {})
      console.error(`[cron] Failed to resume pending step ${step.id}:`, err)
    }
  }
}

async function checkTimeBasedTriggers() {
  const db = createServiceClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Check for overdue invoices (due date has passed, status is still Sent).
  // Uses conditional UPDATE ... WHERE status='Sent' RETURNING so only the
  // worker that wins the transition fires the automation — no duplicate
  // notifications when two cron ticks overlap.
  const { data: overdueInvoices } = await db
    .from('invoices')
    .select('id')
    .eq('status', 'Sent')
    .lt('due_date', todayStr)

  for (const { id } of overdueInvoices ?? []) {
    const { data: claimed } = await db
      .from('invoices')
      .update({ status: 'Overdue' })
      .eq('id', id)
      .eq('status', 'Sent')
      .select('*')
      .maybeSingle()
    if (claimed) {
      fireAutomations('invoice_overdue', { invoiceId: claimed.id, company: claimed.company, ...claimed })
    }
  }

  // Check for overdue invoices by 3+ days — atomic claim on overdue_3d_notified
  // to guarantee the notification fires exactly once per invoice.
  const threeDaysAgo = new Date(today.getTime() - 3 * 86400000).toISOString().split('T')[0]
  const { data: overdue3 } = await db
    .from('invoices')
    .select('id')
    .eq('status', 'Overdue')
    .eq('overdue_3d_notified', false)
    .lt('due_date', threeDaysAgo)

  for (const { id } of overdue3 ?? []) {
    const { data: claimed } = await db
      .from('invoices')
      .update({ overdue_3d_notified: true })
      .eq('id', id)
      .eq('overdue_3d_notified', false)
      .select('*')
      .maybeSingle()
    if (claimed) {
      fireAutomations('invoice_overdue', { invoiceId: claimed.id, company: claimed.company, overdueDays: 3, ...claimed })
    }
  }

  // Check renewals within 90 days — atomic claim on renewal_30/90_notified.
  const in90Days = new Date(today.getTime() + 90 * 86400000).toISOString().split('T')[0]
  const { data: renewals90 } = await db
    .from('contracts')
    .select('id, renewal_date, renewal_90_notified, renewal_30_notified')
    .lte('renewal_date', in90Days)
    .gte('renewal_date', todayStr)
    .in('status', ['Fully Executed', 'Active'])
    .or('renewal_90_notified.eq.false,renewal_30_notified.eq.false')

  for (const c of renewals90 ?? []) {
    const daysUntil = Math.ceil((new Date(c.renewal_date).getTime() - today.getTime()) / 86400000)
    if (daysUntil <= 30 && !c.renewal_30_notified) {
      const { data: claimed } = await db
        .from('contracts')
        .update({ renewal_30_notified: true })
        .eq('id', c.id)
        .eq('renewal_30_notified', false)
        .select('*')
        .maybeSingle()
      if (claimed) {
        fireAutomations('renewal_30', { contractId: claimed.id, company: claimed.company, daysUntil, ...claimed })
      }
    } else if (daysUntil > 30 && !c.renewal_90_notified) {
      const { data: claimed } = await db
        .from('contracts')
        .update({ renewal_90_notified: true })
        .eq('id', c.id)
        .eq('renewal_90_notified', false)
        .select('*')
        .maybeSingle()
      if (claimed) {
        fireAutomations('renewal_90', { contractId: claimed.id, company: claimed.company, daysUntil, ...claimed })
      }
    }
  }
}
