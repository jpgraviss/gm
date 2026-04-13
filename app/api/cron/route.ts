import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { checkSite, recordCheck, computeUptime30d, type MonitoredSiteRow } from '@/lib/uptime'
import { checkAllRanks } from '@/lib/rank-tracker'

/**
 * Cron endpoint — called on a schedule (e.g. every 6 hours via Vercel Cron).
 * Handles:
 * 1. Execute pending email sequence steps
 * 2. Check for time-based automation triggers (overdue invoices, upcoming renewals)
 */
export async function GET(req: NextRequest) {
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
    const syncRes = await fetch(`${baseUrl2}/api/calendar/sync`, { method: 'POST' })
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
    const emailRes = await fetch(`${baseUrl}/api/tickets/from-email`, { method: 'POST' })
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

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...results })
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
    switch (rec.frequency) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + rec.interval)
        break
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + rec.interval * 7)
        break
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + rec.interval)
        break
      default:
        continue
    }

    const nextDueStr = nextDue.toISOString().split('T')[0]

    // Respect endDate — don't spawn if next date is past endDate
    if (rec.endDate && nextDueStr > rec.endDate) {
      // Clear recurrence on the completed task so we don't check it again
      await db.from('app_tasks').update({ recurrence: null }).eq('id', task.id)
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

    // Null out recurrence on the completed task so it doesn't spawn again
    await db.from('app_tasks').update({ recurrence: null }).eq('id', task.id)
  }
}

async function checkTimeBasedTriggers() {
  const db = createServiceClient()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Check for overdue invoices (due date has passed, status is still Sent)
  const { data: overdueInvoices } = await db
    .from('invoices')
    .select('*')
    .eq('status', 'Sent')
    .lt('due_date', todayStr)

  for (const inv of overdueInvoices ?? []) {
    // Update status to Overdue
    await db.from('invoices').update({ status: 'Overdue' }).eq('id', inv.id)
    fireAutomations('invoice_overdue', { invoiceId: inv.id, company: inv.company, ...inv })
  }

  // Check for overdue invoices by 3+ days
  const threeDaysAgo = new Date(today.getTime() - 3 * 86400000).toISOString().split('T')[0]
  const { data: overdue3 } = await db
    .from('invoices')
    .select('*')
    .eq('status', 'Overdue')
    .lt('due_date', threeDaysAgo)

  for (const inv of overdue3 ?? []) {
    fireAutomations('invoice_overdue', { invoiceId: inv.id, company: inv.company, overdueDays: 3, ...inv })
  }

  // Check renewals within 90 days
  const in90Days = new Date(today.getTime() + 90 * 86400000).toISOString().split('T')[0]
  const { data: renewals90 } = await db
    .from('contracts')
    .select('*')
    .lte('renewal_date', in90Days)
    .gte('renewal_date', todayStr)
    .in('status', ['Fully Executed', 'Active'])

  for (const c of renewals90 ?? []) {
    const daysUntil = Math.ceil((new Date(c.renewal_date).getTime() - today.getTime()) / 86400000)
    if (daysUntil <= 30) {
      fireAutomations('renewal_30', { contractId: c.id, company: c.company, daysUntil, ...c })
    } else {
      fireAutomations('renewal_90', { contractId: c.id, company: c.company, daysUntil, ...c })
    }
  }
}
