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
  // Verify cron secret in production
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...results })
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
