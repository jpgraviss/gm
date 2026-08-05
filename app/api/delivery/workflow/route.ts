import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { withErrorHandler } from '@/lib/api-handler'
import { ALL_SERVICE_VALUES } from '@/lib/services'
import { DELIVERY_STEP_NAMES } from '@/lib/delivery-steps'
import { requireRole } from '@/lib/rbac'
import { requirePortalClient } from '@/lib/portal-auth'
import { belongsToCompany, normalizeCompanyName } from '@/lib/company-match'

const SERVICE_TYPES = [...ALL_SERVICE_VALUES]

const STEP_NAMES: readonly string[] = DELIVERY_STEP_NAMES

const STEP_STATUS_COLUMNS = [
  'step_01_agreement', 'step_02_invoice', 'step_03_welcome', 'step_04_portal',
  'step_05_strategy_call', 'step_06_usage_guide', 'step_07_fulfillment', 'step_08_monthly_report',
]

const STEP_COMPLETED_AT_COLUMNS: Record<number, string | null> = {
  1: 'step_01_completed_at',
  2: 'step_02_completed_at',
  3: null,
  4: null,
  5: 'step_05_completed_at',
  6: null,
  7: 'step_07_completed_at',
  8: null,
}

function toStepStatus(raw: string | null | undefined): 'completed' | 'in_progress' | 'pending' {
  if (raw === 'Completed' || raw === 'Skipped') return 'completed'
  if (raw === 'In Progress') return 'in_progress'
  return 'pending'
}

// ── Per-step client-facing detail panel (AUDIT #693) ─────────────────────────
// The client Delivery Timeline (app/client/workflow/page.tsx) renders an
// expandable panel per step off `step.details`. mapWorkflow() never populated
// it, so every panel a client opened was blank — the feature read as broken,
// not as missing. It's now built from data that genuinely exists: the
// workflow row's own step-metadata columns, plus the real contract / invoice /
// portal-client records the GET handler below looks up.
//
// Fields on the client's StepDetail interface deliberately left unpopulated,
// because this app stores no such data — omitted rather than faked, per the
// same convention as the monthly-report metrics (see delivery-dashboard's
// comment on why blank reports must not be sent):
//   contractUrl, invoiceUrl      contracts/invoices carry no document-URL
//                                column; they're rendered in-app, never
//                                stored as a downloadable file.
//   welcomeEmailUrl              outbound emails aren't archived at a
//                                per-client permalink.
//   bookingLink                  step_05_booking_id references a booking that
//                                already happened, not a "book a call" page,
//                                and there's no per-company strategy-call
//                                booking slug to link to.
//   usageGuideUrl, helpArticles  delivery_templates rows are staff-side email
//                                templates (file_path is internal), not
//                                client-servable URLs, and no help-article
//                                store exists.
//   reportUrl, metricsPreview    monthly-report metrics are aggregated on
//                                demand by /api/delivery/monthly-report/[id]
//                                (staff-only); nothing persists a
//                                client-visible report artifact to link to.
// The client page falls back to an honest empty state wherever a step ends up
// with nothing real to show.

export interface WorkflowDetailSources {
  contract?: { status?: string | null; client_signed?: string | null } | null
  invoice?: { amount?: number | string | null; status?: string | null } | null
  portalClient?: { access?: string | null } | null
}

interface StepDetail {
  signatureStatus?: string
  invoiceAmount?: number
  paymentStatus?: string
  welcomeEmailDate?: string
  portalAccess?: string
  firstLoginDate?: string
  meetingNotes?: string
  usageGuideSentDate?: string
  deliverables?: { name: string; url?: string }[]
  lastReportSentDate?: string
}

/** Drop empty keys so a step with no real data reports no `details` at all
 *  rather than an empty object the client would render as a blank panel. */
function compactDetail(detail: StepDetail): StepDetail | undefined {
  const entries = Object.entries(detail).filter(([, v]) => (
    v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)
  ))
  return entries.length > 0 ? (Object.fromEntries(entries) as StepDetail) : undefined
}

/** step_07_deliverables is real, staff-written data (POST
 *  /api/delivery/add-deliverable), but it persists the link as `fileUrl`
 *  while the client page expects `url` — that key mismatch is why even the
 *  one step with genuine data behind it showed the client nothing. The link
 *  is optional on the write side, so entries without one are kept and simply
 *  render unlinked. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDeliverables(raw: any): { name: string; url?: string }[] {
  if (!Array.isArray(raw)) return []
  return raw
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((d: any) => {
      const name = typeof d?.name === 'string' ? d.name.trim() : ''
      const link = typeof d?.fileUrl === 'string' ? d.fileUrl : typeof d?.url === 'string' ? d.url : ''
      return { name, url: link.trim() || undefined }
    })
    .filter(d => d.name.length > 0)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStepDetails(row: any, sources: WorkflowDetailSources): Record<number, StepDetail | undefined> {
  const { contract, invoice, portalClient } = sources
  const invoiceAmount = invoice?.amount == null ? undefined : Number(invoice.amount)

  return {
    // Signature state is the contract's own: a client_signed date is the
    // authoritative "Signed", otherwise show the contract's real status.
    1: contract ? compactDetail({
      signatureStatus: contract.client_signed ? 'Signed' : (contract.status ?? undefined),
    }) : undefined,
    2: compactDetail({
      invoiceAmount: Number.isFinite(invoiceAmount) ? invoiceAmount : undefined,
      paymentStatus: invoice?.status ?? undefined,
    }),
    3: compactDetail({ welcomeEmailDate: row.step_03_email_sent_at ?? undefined }),
    4: compactDetail({
      portalAccess: portalClient?.access ?? undefined,
      firstLoginDate: row.step_04_first_login ?? undefined,
    }),
    5: compactDetail({ meetingNotes: row.step_05_notes ?? undefined }),
    6: compactDetail({ usageGuideSentDate: row.step_06_email_sent_at ?? undefined }),
    7: compactDetail({ deliverables: normalizeDeliverables(row.step_07_deliverables) }),
    8: compactDetail({ lastReportSentDate: row.step_08_last_sent_at ?? undefined }),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapWorkflow(row: any, sources: WorkflowDetailSources = {}) {
  const detailsByStep = buildStepDetails(row, sources)
  const steps = STEP_NAMES.map((name, i) => {
    const stepNum = i + 1
    const status = toStepStatus(row[STEP_STATUS_COLUMNS[i]])
    const completedAtCol = STEP_COMPLETED_AT_COLUMNS[stepNum]
    return {
      step: stepNum,
      name,
      status,
      completedDate: completedAtCol ? (row[completedAtCol] ?? undefined) : undefined,
      details: detailsByStep[stepNum],
    }
  })
  const currentStep = steps.find(s => s.status !== 'completed')?.step ?? STEP_NAMES.length

  return {
    id: row.id,
    company: row.company_name,
    companyId: row.company_id ?? undefined,
    service: row.service_type,
    projectId: row.project_id ?? undefined,
    currentStep,
    steps,
    startedDate: row.created_at,
    lastUpdated: row.updated_at ?? row.created_at,
  }
}

// ── Loading the real records behind steps 1, 2 and 4 ─────────────────────────

interface CompanyRow {
  id: string
  company: string | null
  company_id: string | null
  service_type?: string | null
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0))]
}

/** lib/company-match's preference order — FK first, normalized name only as
 *  the legacy fallback. A workflow row created without a company_id (POST
 *  above allows it) has no FK to prefer, so it matches on name alone. */
function matchesWorkflowCompany(record: CompanyRow, companyId: string | null, companyName: string): boolean {
  if (companyId) {
    return belongsToCompany({ companyId: record.company_id, company: record.company }, companyId, companyName)
  }
  return normalizeCompanyName(record.company) === normalizeCompanyName(companyName)
}

/** A company can run several concurrent engagements, so prefer a record for
 *  this workflow's own service when one exists; otherwise take the most
 *  recent (candidates arrive created_at-desc). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickForWorkflow<T extends CompanyRow>(candidates: T[], row: any): T | null {
  const matches = candidates.filter(c => matchesWorkflowCompany(c, row.company_id ?? null, row.company_name))
  if (matches.length === 0) return null
  return matches.find(c => c.service_type && c.service_type === row.service_type) ?? matches[0]
}

/**
 * Best-effort lookup of the contract / invoice / portal-client records behind
 * each workflow on this page. Purely additive to the response: any failure
 * here just leaves those steps without details, it never fails the request.
 */
async function loadDetailSources(
  db: ReturnType<typeof createServiceClient>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
): Promise<Map<string, WorkflowDetailSources>> {
  const byWorkflow = new Map<string, WorkflowDetailSources>()
  if (rows.length === 0) return byWorkflow

  try {
    const contractIds = uniqueStrings(rows.map(r => r.step_01_contract_id))
    const invoiceIds = uniqueStrings(rows.map(r => r.step_02_invoice_id))
    const companyIds = uniqueStrings(rows.map(r => r.company_id))
    const companyNames = uniqueStrings(rows.map(r => r.company_name))

    const CONTRACT_COLS = 'id, company, company_id, service_type, status, client_signed, created_at'
    const INVOICE_COLS = 'id, company, company_id, contract_id, service_type, amount, status, created_at'
    const recent = { column: 'created_at', options: { ascending: false } } as const

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchAll = async (table: string, cols: string, ids: string[]): Promise<any[]> => {
      const queries = []
      if (ids.length > 0) queries.push(db.from(table).select(cols).in('id', ids))
      if (companyIds.length > 0) queries.push(db.from(table).select(cols).in('company_id', companyIds))
      if (companyNames.length > 0) queries.push(db.from(table).select(cols).in('company', companyNames))
      if (queries.length === 0) return []
      const results = await Promise.all(
        queries.map(q => q.order(recent.column, recent.options)),
      )
      // De-duplicate: the id / company_id / name queries overlap by design.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seen = new Map<string, any>()
      for (const res of results) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const record of ((res.data ?? []) as any[])) {
          if (!seen.has(record.id)) seen.set(record.id, record)
        }
      }
      return [...seen.values()]
    }

    const [contracts, invoices, portalClients] = await Promise.all([
      fetchAll('contracts', CONTRACT_COLS, contractIds),
      fetchAll('invoices', INVOICE_COLS, invoiceIds),
      fetchAll('portal_clients', 'id, company, company_id, access', []),
    ])

    for (const row of rows) {
      // The staff-set step link is the unambiguous one; the company match is
      // the fallback for the (common) workflows where it was never filled in.
      const contract = contracts.find(c => c.id === row.step_01_contract_id)
        ?? pickForWorkflow(contracts, row)
      const invoice = invoices.find(i => i.id === row.step_02_invoice_id)
        ?? (contract ? invoices.find(i => i.contract_id === contract.id) : null)
        ?? pickForWorkflow(invoices, row)

      byWorkflow.set(row.id, {
        contract,
        invoice,
        portalClient: pickForWorkflow(portalClients, row),
      })
    }
  } catch {
    return byWorkflow
  }

  return byWorkflow
}

export const POST = withErrorHandler('delivery/workflow POST', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const result = validate(body, {
    companyName: { required: true, type: 'string', maxLength: 200 },
    serviceType: { type: 'string', enum: SERVICE_TYPES },
    companyId: { type: 'string', maxLength: 100 },
    projectId: { type: 'string', maxLength: 100 },
    projectName: { type: 'string', maxLength: 200 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const id = crypto.randomUUID()

  const { data, error } = await db
    .from('delivery_workflows')
    .insert({
      id,
      company_id: body.companyId ?? null,
      project_id: body.projectId ?? null,
      company_name: body.companyName,
      project_name: body.projectName ?? null,
      service_type: body.serviceType ?? 'Website',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create workflow')
  }

  await db.from('delivery_events').insert({
    id: crypto.randomUUID(),
    workflow_id: id,
    company_id: body.companyId ?? null,
    step: null,
    event_type: 'workflow_created',
    description: `Delivery workflow created for ${body.companyName}`,
    metadata: { service_type: body.serviceType ?? 'Website' },
  })

  return NextResponse.json(mapWorkflow(data), { status: 201 })
})

export const GET = withErrorHandler('delivery/workflow GET', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('company_id')
  const company = searchParams.get('company')

  // Portal clients (portal workflow page) legitimately call this scoped to
  // their own company — see matching comment in app/api/proposals/route.ts.
  // Previously had no auth check at all, so any authenticated caller could
  // list every client's delivery workflow status by omitting the filter or
  // querying another company's id.
  const denied = company
    ? await requirePortalClient(req, company)
    : await requireRole(req, 'Team Member')
  if (denied) return denied

  const pag = parsePagination(req)

  const db = createServiceClient()
  let query = db
    .from('delivery_workflows')
    .select('*')

  if (companyId) query = query.eq('company_id', companyId)
  if (company) query = query.eq('company_name', company)
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message || 'Failed to fetch workflows')
  }

  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  const sources = await loadDetailSources(db, rows)
  return paginatedJson(rows.map(row => mapWorkflow(row, sources.get(row.id as string))), nextCursor)
})
