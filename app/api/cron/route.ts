import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'

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
    const seqRes = await fetch(`${baseUrl}/api/sequences/execute`, { method: 'POST' })
    results.sequences = await seqRes.json()
  } catch (err) {
    console.error('[cron] Sequence execution failed:', err)
    results.sequences = { error: 'Failed' }
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

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...results })
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
