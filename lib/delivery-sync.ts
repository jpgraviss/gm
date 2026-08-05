import { createServiceClient } from '@/lib/supabase'
import { normalizeCompanyName } from '@/lib/company-match'
import { DELIVERY_STEP_COLUMNS, DELIVERY_STEP_NAMES, DELIVERY_TERMINAL_STATUSES } from '@/lib/delivery-steps'

/**
 * Advances a client's Delivery Workflow from events that happen in *other*
 * modules.
 *
 * `delivery_workflows` was written by exactly one place — `app/api/delivery/**`
 * — so every step only ever moved when a staff member manually clicked it on
 * the Delivery dashboard. That made the 8-step pipeline a checklist someone
 * had to remember to tick, not a status board: the app already knew the
 * contract was fully executed (Contracts), that the invoice was paid (Stripe
 * webhook / invoice PATCH), and when the client first logged into their
 * portal, and none of it reached the workflow. A client could be fully
 * onboarded and still show "Step 1: Contract Signed — Pending" to both staff
 * and — via app/client/workflow — the client themselves.
 *
 * Design notes:
 *  - **Forward only.** A step already Completed or Skipped is never touched,
 *    so a re-fired webhook, a second signature request, or a staff member
 *    who ticked the step ahead of the system can't be undone. That also
 *    makes every call idempotent, which matters because the Stripe webhook
 *    and the cron are both at-least-once.
 *  - **Best effort, never throws.** Same posture as lib/activity-log.ts: a
 *    workflow write failing must not turn a successful contract signature or
 *    payment into an error response.
 *  - **Service-scoped when it can be.** A company can run concurrent
 *    engagements (Website + SEO). When the triggering record names a service
 *    and any of the company's workflows match it, only those advance;
 *    otherwise every workflow for the company does, because the underlying
 *    event ("they signed", "they paid") is genuinely client-level.
 */

export interface AdvanceDeliveryStepInput {
  /** Preferred key — the real FK. */
  companyId?: string | null
  /** Legacy fallback for workflows created before company_id was populated. */
  companyName?: string | null
  /** 1-8; see DELIVERY_STEP_NAMES. */
  step: number
  /** Restricts to workflows of this service when any match. */
  serviceType?: string | null
  /** Extra step columns to set, e.g. `{ step_01_contract_id: 'c-1' }`. */
  meta?: Record<string, unknown>
  /** Human-readable reason, recorded on the delivery_events row. */
  reason?: string
}

interface WorkflowRow {
  id: string
  company_id: string | null
  company_name: string | null
  service_type: string | null
  [column: string]: unknown
}

function normalizeService(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** Either service label containing the other counts as the same line —
 *  'website' vs 'website development', 'seo' vs 'seo / aeo'. */
function servicesOverlap(a: string, b: string): boolean {
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

function isTerminal(status: unknown): boolean {
  return typeof status === 'string' && (DELIVERY_TERMINAL_STATUSES as readonly string[]).includes(status)
}

/**
 * Loads the workflows this event applies to. Queries by FK and by name
 * separately (rather than one `.or()`) so the two key styles can't interfere,
 * then de-duplicates — the same shape `loadDetailSources` already uses in
 * app/api/delivery/workflow/route.ts.
 */
async function findWorkflows(
  db: ReturnType<typeof createServiceClient>,
  companyId: string | null,
  companyName: string | null,
): Promise<WorkflowRow[]> {
  const queries = []
  if (companyId) queries.push(db.from('delivery_workflows').select('*').eq('company_id', companyId))
  if (companyName) queries.push(db.from('delivery_workflows').select('*').eq('company_name', companyName))
  if (queries.length === 0) return []

  const results = await Promise.all(queries)
  const seen = new Map<string, WorkflowRow>()
  for (const res of results) {
    for (const row of ((res.data ?? []) as WorkflowRow[])) {
      if (!seen.has(row.id)) seen.set(row.id, row)
    }
  }

  const rows = [...seen.values()]
  if (companyId) return rows

  // Name-only match. Note the tolerance here is narrow and deliberately not
  // oversold: the DB filter is already exact-string `.eq()`, and
  // normalizeCompanyName only trims and lowercases — it does NOT strip
  // punctuation or legal suffixes, so "ADCO, Inc." and "ADCO Inc" are still
  // different companies to this code. That's acceptable because company_id
  // is the real key and this branch only exists for legacy workflow rows
  // created before the FK was populated; the fix for a genuine name mismatch
  // is to backfill company_id, not to loosen the matching.
  const target = normalizeCompanyName(companyName)
  return rows.filter(r => normalizeCompanyName(r.company_name) === target)
}

/**
 * Marks a delivery step Completed for a company's workflow(s).
 * Returns the number of workflows actually advanced (0 is normal and not an
 * error: the client may have no workflow, or the step may already be done).
 */
export async function advanceDeliveryStep(input: AdvanceDeliveryStepInput): Promise<number> {
  try {
    const stepDef = DELIVERY_STEP_COLUMNS[input.step]
    if (!stepDef) return 0

    const companyId = input.companyId || null
    const companyName = input.companyName || null
    if (!companyId && !companyName) return 0

    const db = createServiceClient()
    const all = await findWorkflows(db, companyId, companyName)
    if (all.length === 0) return 0

    // Prefer this event's own service line when the company runs several.
    // Matched loosely on purpose: `delivery_workflows.service_type` defaults
    // to 'Website' while a contract or invoice may carry 'Website
    // Development', and an exact comparison would miss and silently fall
    // back to advancing every workflow — the opposite of the intent.
    const service = normalizeService(input.serviceType)
    const scoped = service
      ? all.filter(w => servicesOverlap(normalizeService(w.service_type), service))
      : []
    const candidates = scoped.length > 0 ? scoped : all

    const now = new Date().toISOString()
    let advanced = 0

    for (const workflow of candidates) {
      if (isTerminal(workflow[stepDef.status])) continue

      const update: Record<string, unknown> = {
        [stepDef.status]: 'Completed',
        updated_at: now,
      }
      if (stepDef.completedAt) update[stepDef.completedAt] = now
      for (const [col, value] of Object.entries(input.meta ?? {})) {
        // Only columns this step actually owns — a typo'd key would
        // otherwise fail the whole UPDATE and lose a real event.
        if (stepDef.meta.includes(col)) update[col] = value
      }

      // Re-assert the not-already-terminal condition in the WHERE clause so
      // two concurrent events (Stripe webhook + a staff click) can't both
      // claim the step; the loser updates 0 rows instead of overwriting.
      const { data, error } = await db
        .from('delivery_workflows')
        .update(update)
        .eq('id', workflow.id)
        .not(stepDef.status, 'in', '("Completed","Skipped")')
        .select('id')
        .maybeSingle()

      if (error) {
        console.error('[delivery-sync] step update failed:', error.message)
        continue
      }
      if (!data) continue

      advanced++
      await db.from('delivery_events').insert({
        id: crypto.randomUUID(),
        workflow_id: workflow.id,
        company_id: workflow.company_id,
        step: input.step,
        event_type: 'step_auto_completed',
        description: input.reason
          ?? `Step ${input.step} (${DELIVERY_STEP_NAMES[input.step - 1]}) completed automatically`,
        metadata: { source: 'delivery-sync', ...(input.meta ?? {}) },
      })
    }

    return advanced
  } catch (err) {
    console.error('[delivery-sync] unexpected failure:', err instanceof Error ? err.message : err)
    return 0
  }
}

// ── Named helpers, one per real cross-module event ────────────────────────────
// Thin on purpose: the call sites live in Contracts / Finance / Portal code
// that shouldn't have to know which numbered column backs which step.

export function onContractFullyExecuted(contract: {
  id?: string | null
  company_id?: string | null
  company?: string | null
  service_type?: string | null
}): Promise<number> {
  return advanceDeliveryStep({
    companyId: contract.company_id,
    companyName: contract.company,
    serviceType: contract.service_type,
    step: 1,
    meta: contract.id ? { step_01_contract_id: contract.id } : undefined,
    reason: 'Contract fully executed',
  })
}

export function onInvoicePaid(invoice: {
  id?: string | null
  company_id?: string | null
  company?: string | null
  service_type?: string | null
}): Promise<number> {
  return advanceDeliveryStep({
    companyId: invoice.company_id,
    companyName: invoice.company,
    serviceType: invoice.service_type,
    step: 2,
    meta: invoice.id ? { step_02_invoice_id: invoice.id } : undefined,
    reason: 'Invoice paid',
  })
}

export function onPortalFirstLogin(client: {
  company_id?: string | null
  company?: string | null
}): Promise<number> {
  return advanceDeliveryStep({
    companyId: client.company_id,
    companyName: client.company,
    step: 4,
    meta: { step_04_first_login: new Date().toISOString() },
    reason: 'Client signed into the portal for the first time',
  })
}
