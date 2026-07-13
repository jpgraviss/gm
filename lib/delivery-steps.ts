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
