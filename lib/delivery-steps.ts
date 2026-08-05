/**
 * The 8 stages of the client delivery pipeline. Fixed, not configurable:
 * `delivery_workflows` has one dedicated column per step (step_01_agreement
 * … step_08_monthly_report — see supabase/migrations/add_delivery_system.sql
 * and app/api/delivery/workflow/[id]/step/route.ts's STEP_COLUMNS), so
 * steps can't be added, removed, reordered, or renamed without a schema
 * change. Single source of truth for the names so the delivery API, the
 * internal delivery dashboard, and the read-only Settings display can't
 * drift from each other.
 */
export const DELIVERY_STEP_NAMES = [
  'Contract Signed',
  'Invoice & Payment',
  'Welcome Email',
  'Portal Access',
  'Strategy Call',
  'Usage Guide & Resources',
  'Deliverables',
  'Reporting & Analytics',
] as const

/**
 * Which columns back each step. Lives here rather than in the step-PATCH
 * route because `lib/delivery-sync.ts` now writes the same columns from
 * Contracts / Finance / Portal events, and two independent copies of this
 * map would drift the first time a column is renamed.
 *
 * `completedAt` is null for the steps whose schema genuinely has no
 * completion timestamp (welcome email, portal access, usage guide, monthly
 * report all track a send/login timestamp in `meta` instead).
 */
export const DELIVERY_STEP_COLUMNS: Record<number, { status: string; completedAt: string | null; meta: string[] }> = {
  1: { status: 'step_01_agreement',      completedAt: 'step_01_completed_at', meta: ['step_01_contract_id', 'step_01_completed_at'] },
  2: { status: 'step_02_invoice',        completedAt: 'step_02_completed_at', meta: ['step_02_invoice_id', 'step_02_completed_at'] },
  3: { status: 'step_03_welcome',        completedAt: null,                   meta: ['step_03_email_sent_at', 'step_03_opened_at'] },
  4: { status: 'step_04_portal',         completedAt: null,                   meta: ['step_04_first_login'] },
  5: { status: 'step_05_strategy_call',  completedAt: 'step_05_completed_at', meta: ['step_05_booking_id', 'step_05_completed_at', 'step_05_notes'] },
  6: { status: 'step_06_usage_guide',    completedAt: null,                   meta: ['step_06_email_sent_at', 'step_06_opened_at'] },
  7: { status: 'step_07_fulfillment',    completedAt: 'step_07_completed_at', meta: ['step_07_deliverables', 'step_07_completed_at'] },
  8: { status: 'step_08_monthly_report', completedAt: null,                   meta: ['step_08_last_sent_at', 'step_08_send_day'] },
}

/** A step already in one of these states must never be pushed backwards. */
export const DELIVERY_TERMINAL_STATUSES = ['Completed', 'Skipped'] as const
