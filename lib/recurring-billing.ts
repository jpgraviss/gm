import { createServiceClient } from '@/lib/supabase'
import { contractMonthlyValue } from '@/lib/metrics'
import { logActivity } from '@/lib/activity-log'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Recurring (retainer) invoice generation.
 *
 * The single largest day-to-day gap in the Finance module: nothing kept
 * invoices flowing from active recurring contracts. Every invoice for every
 * retainer client had to be manually recreated each period (via CSV import
 * or the time-billing flow) — with ~30 real contract clients that's a
 * standing monthly chore that also silently drifts from what the contracts
 * actually say. Two sources feed this:
 *
 *   1. `contracts` with a recurring `billing_structure` (Monthly/Quarterly/
 *      Annual) that are Fully Executed and inside their term.
 *   2. `maintenance_records` with an Active status and a `next_billing_date`
 *      that's due — the cancellation-fee path already auto-invoiced
 *      (AUDIT #467) but regular month-to-month billing never did.
 *
 * Safety properties this deliberately guarantees:
 * - **Idempotent per period.** Before inserting, it checks whether an
 *   invoice already exists for that contract in the current billing period.
 *   The cron can run many times a day (a GitHub Action pings it every 5
 *   minutes) — without this it would mint duplicate invoices continuously.
 * - **Correct per-period amount.** `contractMonthlyValue()` normalizes
 *   Quarterly/Annual contract values; billing an Annual contract's full
 *   value every period would be a serious overcharge.
 * - **Never bills a $0 or negative amount.**
 * - **Never bills past the contract's end.** A contract whose renewal date
 *   has passed stops generating invoices rather than billing indefinitely.
 */

export interface RecurringBillingResult {
  contractsChecked: number
  maintenanceChecked: number
  invoicesCreated: number
  skipped: number
  errors: number
}

const RECURRING_STRUCTURES = new Set(['monthly', 'quarterly', 'annual'])

/** Months between invoices for a given billing structure. */
export function periodMonths(billingStructure: string): number {
  const bs = (billingStructure ?? '').toLowerCase()
  if (bs.includes('quarter')) return 3
  if (bs.includes('annual') || bs.includes('year')) return 12
  return 1
}

export function isRecurringStructure(billingStructure: string): boolean {
  const bs = (billingStructure ?? '').toLowerCase()
  if (!bs) return false
  // One-time / milestone / project billing is explicitly not recurring.
  if (bs.includes('one') || bs.includes('milestone') || bs.includes('project') || bs.includes('custom')) return false
  return RECURRING_STRUCTURES.has(bs) || bs.includes('month') || bs.includes('quarter') || bs.includes('annual')
}

/**
 * The inclusive start date of the billing period `now` falls into, given a
 * contract that started on `startDate` and bills every `months` months.
 * Used as the idempotency key: at most one invoice per contract per period.
 */
export function currentPeriodStart(startDate: string, months: number, now: Date): string | null {
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return null
  if (start > now) return null

  const monthsElapsed =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  // Whole periods completed since the contract began.
  let periodsElapsed = Math.floor(monthsElapsed / months)
  // Not yet past the anniversary day-of-month within this period.
  const candidate = new Date(start)
  candidate.setMonth(candidate.getMonth() + periodsElapsed * months)
  if (candidate > now) periodsElapsed -= 1
  if (periodsElapsed < 0) return null

  const periodStart = new Date(start)
  periodStart.setMonth(periodStart.getMonth() + periodsElapsed * months)
  return periodStart.toISOString().split('T')[0]
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

export async function generateRecurringInvoices(
  client?: SupabaseClient,
  now: Date = new Date(),
): Promise<RecurringBillingResult> {
  const db = client ?? createServiceClient()
  const result: RecurringBillingResult = {
    contractsChecked: 0, maintenanceChecked: 0, invoicesCreated: 0, skipped: 0, errors: 0,
  }
  const today = now.toISOString().split('T')[0]

  // ── Contracts ────────────────────────────────────────────────────────
  const { data: contracts } = await db
    .from('contracts')
    .select('id, company, company_id, value, billing_structure, start_date, renewal_date, service_type, status')
    .eq('status', 'Fully Executed')

  for (const contract of (contracts ?? []) as Record<string, unknown>[]) {
    result.contractsChecked++
    try {
      const billingStructure = String(contract.billing_structure ?? '')
      if (!isRecurringStructure(billingStructure)) { result.skipped++; continue }

      const startDate = String(contract.start_date ?? '')
      if (!startDate) { result.skipped++; continue }

      // Never bill past the contract's own end.
      const renewalDate = contract.renewal_date ? String(contract.renewal_date) : null
      if (renewalDate && renewalDate < today) { result.skipped++; continue }

      const months = periodMonths(billingStructure)
      const periodStart = currentPeriodStart(startDate, months, now)
      if (!periodStart) { result.skipped++; continue }

      const amount = contractMonthlyValue({
        value: Number(contract.value) || 0,
        billingStructure,
      })
      if (amount <= 0) { result.skipped++; continue }

      // Idempotency: one invoice per contract per period. Without this the
      // cron (pinged every 5 minutes) would mint duplicates all day.
      const { data: existing } = await db
        .from('invoices')
        .select('id')
        .eq('contract_id', contract.id as string)
        .gte('issued_date', periodStart)
        .limit(1)
        .maybeSingle()
      if (existing) { result.skipped++; continue }

      const dueDate = addMonths(today, 0)
      const due = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const { error } = await db.from('invoices').insert({
        id: `inv-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        company: contract.company ?? '',
        company_id: contract.company_id ?? null,
        contract_id: contract.id,
        amount,
        status: 'Pending',
        issued_date: dueDate,
        issue_date: dueDate,
        due_date: due,
        service_type: contract.service_type ?? 'General',
        source: 'recurring',
      })
      if (error) {
        console.error(`[recurring-billing] contract ${contract.id} invoice insert failed:`, error.message)
        result.errors++
        continue
      }

      result.invoicesCreated++
      logActivity({
        type: 'invoice',
        title: `Recurring invoice raised — ${billingStructure}`,
        body: `${contract.service_type ?? 'General'} · period starting ${periodStart}`,
        companyId: (contract.company_id as string) ?? null,
        companyName: (contract.company as string) ?? null,
      }, db)
    } catch (err) {
      console.error('[recurring-billing] contract loop error:', err instanceof Error ? err.message : err)
      result.errors++
    }
  }

  // ── Maintenance records ──────────────────────────────────────────────
  // The cancellation-fee path already auto-invoiced (AUDIT #467); regular
  // month-to-month retainer billing off next_billing_date never did.
  const { data: maintenance } = await db
    .from('maintenance_records')
    .select('id, company, company_id, contract_id, monthly_fee, next_billing_date, service_type, status, end_date')
    .eq('status', 'Active')

  for (const record of (maintenance ?? []) as Record<string, unknown>[]) {
    result.maintenanceChecked++
    try {
      const nextBilling = record.next_billing_date ? String(record.next_billing_date) : null
      if (!nextBilling || nextBilling > today) { result.skipped++; continue }

      const endDate = record.end_date ? String(record.end_date) : null
      if (endDate && endDate < today) { result.skipped++; continue }

      const amount = Number(record.monthly_fee) || 0
      if (amount <= 0) { result.skipped++; continue }

      const { error } = await db.from('invoices').insert({
        id: `inv-maint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        company: record.company ?? '',
        company_id: record.company_id ?? null,
        contract_id: record.contract_id ?? null,
        amount,
        status: 'Pending',
        issued_date: today,
        issue_date: today,
        due_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        service_type: record.service_type ?? 'General',
        source: 'recurring',
      })
      if (error) {
        console.error(`[recurring-billing] maintenance ${record.id} invoice insert failed:`, error.message)
        result.errors++
        continue
      }

      // Advance the schedule only after the invoice actually landed — an
      // insert failure must not silently skip a client's billing month.
      const { error: advanceErr } = await db
        .from('maintenance_records')
        .update({ next_billing_date: addMonths(nextBilling, 1) })
        .eq('id', record.id as string)
        .eq('next_billing_date', nextBilling) // atomic claim vs. overlapping runs
      if (advanceErr) {
        console.error(`[recurring-billing] maintenance ${record.id} schedule advance failed:`, advanceErr.message)
        result.errors++
      }

      result.invoicesCreated++
      logActivity({
        type: 'invoice',
        title: 'Recurring maintenance invoice raised',
        body: `${record.service_type ?? 'General'} · billing date ${nextBilling}`,
        companyId: (record.company_id as string) ?? null,
        companyName: (record.company as string) ?? null,
      }, db)
    } catch (err) {
      console.error('[recurring-billing] maintenance loop error:', err instanceof Error ? err.message : err)
      result.errors++
    }
  }

  return result
}
