import { createServiceClient } from '@/lib/supabase'
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
 * - **Idempotent per period, enforced by the database.** The invoice id is
 *   derived from the contract and the period start, so a second attempt for
 *   the same period hits the `invoices` primary key and is rejected by
 *   Postgres. An earlier version used a check-then-insert, which is not
 *   safe here: the GitHub Action pings this route with
 *   `--max-time 30 --retry 3` against a handler declaring `maxDuration = 300`,
 *   so a slow tick genuinely runs up to four times concurrently, and
 *   `vercel.json` schedules a fourth collision at 00:00 UTC. Four overlapping
 *   runs would all read "no invoice yet" and all insert one.
 * - **Correct per-period amount.** `contracts.value` is already the
 *   per-billing-period figure (see lib/metrics.ts) — a Quarterly contract
 *   with value 9000 bills $9,000 per quarter. This bills `value` directly.
 *   It deliberately does NOT use `contractMonthlyValue()`, which divides by
 *   3/12 to normalize for MRR: that is the right figure for a dashboard
 *   metric and the wrong one for an invoice raised once per period, and
 *   using it here under-billed Quarterly 3x and Annual 12x.
 * - **Never bills a $0 or negative amount.**
 * - **Never bills past the contract's end.** A contract whose renewal date
 *   has passed stops generating invoices rather than billing indefinitely.
 * - **Month-end safe.** All month arithmetic clamps to the target month's
 *   last day. Plain `Date.setMonth()` overflows (Jan 31 + 1 month → Mar 3),
 *   which both pushed the computed period start into the future — defeating
 *   the idempotency key entirely — and silently skipped a whole billing
 *   month for month-end maintenance records.
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
 * The per-invoice amount for one billing period.
 *
 * `contracts.value` is already the per-billing-period figure — a Quarterly
 * contract with value 9000 bills $9,000 every quarter. Deliberately NOT
 * `contractMonthlyValue()`: that divides Quarterly by 3 and Annual by 12 to
 * normalize for MRR, which is correct for a dashboard metric and wrong for
 * an invoice raised once per period.
 */
export function contractPeriodAmount(value: number, billingStructure: string): number {
  if (!isRecurringStructure(billingStructure)) return 0
  return Number(value) || 0
}

/**
 * Add whole months, clamping the day-of-month to the target month's last day.
 *
 * `Date.setMonth()` overflows instead of clamping: Jan 31 + 1 month lands on
 * Mar 3, not Feb 28. That single behavior caused two separate billing bugs —
 * a period start computed into the future (so the idempotency key never
 * matched and invoices duplicated every tick) and a maintenance schedule that
 * skipped February outright and then drifted off the 31st permanently.
 */
export function addMonthsClamped(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const day = d.getUTCDate()
  // Day 0 of the following month is the last day of the target month.
  const lastDayOfTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0)).getUTCDate()
  const result = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + months,
    Math.min(day, lastDayOfTarget),
  ))
  return result.toISOString().split('T')[0]
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
  let periodsElapsed = Math.floor(monthsElapsed / months)

  // Walk back until the period start is genuinely on or before `now`. A
  // single decrement isn't enough — the old code decremented based on one
  // candidate and then recomputed the answer without re-checking it, so a
  // month-end contract could still return a future date.
  const today = now.toISOString().split('T')[0]
  while (periodsElapsed >= 0) {
    const candidate = addMonthsClamped(startDate, periodsElapsed * months)
    if (candidate <= today) return candidate
    periodsElapsed -= 1
  }
  return null
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

      const amount = contractPeriodAmount(Number(contract.value) || 0, billingStructure)
      if (amount <= 0) { result.skipped++; continue }

      // Idempotency enforced by the primary key, not by a check-then-insert:
      // overlapping cron runs would all read "no invoice yet" and all insert.
      const invoiceId = `inv-rec-${contract.id}-${periodStart}`
      const due = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const { error } = await db.from('invoices').insert({
        id: invoiceId,
        company: contract.company ?? '',
        company_id: contract.company_id ?? null,
        contract_id: contract.id,
        amount,
        status: 'Pending',
        issued_date: today,
        issue_date: today,
        due_date: due,
        service_type: contract.service_type ?? 'General',
        source: 'recurring',
      })
      if (error) {
        // 23505 = unique_violation: this period is already invoiced, which is
        // the expected outcome on every tick after the first. Not an error.
        if (error.code === '23505') { result.skipped++; continue }
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

      // Claim the billing date FIRST, and only invoice if the claim won.
      // The previous order (insert, then claim) meant two overlapping runs
      // both inserted an $800 invoice and only the losing claim was silently
      // discarded — and a failed claim left next_billing_date unchanged, so
      // the next tick five minutes later invoiced again, forever.
      const { data: claimed } = await db
        .from('maintenance_records')
        .update({ next_billing_date: addMonthsClamped(nextBilling, 1) })
        .eq('id', record.id as string)
        .eq('next_billing_date', nextBilling)
        .select('id')
        .maybeSingle()
      if (!claimed) { result.skipped++; continue }

      const { error } = await db.from('invoices').insert({
        // Deterministic on the claimed billing date — belt and braces
        // alongside the claim above.
        id: `inv-maint-${record.id}-${nextBilling}`,
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
        if (error.code === '23505') { result.skipped++; continue }
        console.error(`[recurring-billing] maintenance ${record.id} invoice insert failed:`, error.message)
        // Release the claim so the next run retries rather than silently
        // skipping a client's billing month.
        await db
          .from('maintenance_records')
          .update({ next_billing_date: nextBilling })
          .eq('id', record.id as string)
        result.errors++
        continue
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
