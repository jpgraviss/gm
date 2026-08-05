import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, PROJECT_STATUSES } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { requirePortalClient } from '@/lib/portal-auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(row: any) {
  return {
    id:                   row.id,
    contractId:           row.contract_id ?? '',
    company:              row.company,
    companyId:            row.company_id || null,
    serviceType:          row.service_type,
    serviceTypes:         row.service_types ?? [],
    status:               row.status,
    startDate:            row.start_date ?? '',
    launchDate:           row.launch_date ?? '',
    maintenanceStartDate: row.maintenance_start_date ?? undefined,
    assignedTeam:         row.assigned_team ?? [],
    progress:             row.progress ?? 0,
    milestones:           row.milestones ?? [],
    tasks:                row.tasks ?? [],
    notes:                row.notes ?? [],
    overview:             row.overview ?? '',
    sections:             row.sections ?? ['To Do', 'In Progress', 'Done'],
    color:                row.color ?? '#015035',
    description:          row.description ?? '',
    // Null means "not tracked", never 0 — every pre-existing project has
    // neither set, and defaulting them to 0 would render as "0h budgeted,
    // 100% over" on the detail page. `?? null` (not `?? 0`) on purpose.
    budgetAmount:         row.budget_amount ?? null,
    estimatedHours:       row.estimated_hours ?? null,
  }
}

/**
 * budget_amount / estimated_hours parsing, shared by POST here and PATCH in
 * ./[id]/route.ts (exported so the two can't drift).
 *
 * Accepts a number or a numeric string (what a form input yields). `null`
 * and `''` mean "clear it" and map to SQL NULL — the "not tracked" state,
 * which is deliberately distinct from 0 ("budgeted zero"). `undefined` means
 * the caller didn't mention the field, so it's left untouched. Anything else
 * is rejected rather than silently coerced or dropped.
 */
export function parseNullableNumber(
  value: unknown,
): { ok: true; value: number | null | undefined } | { ok: false } {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null || value === '') return { ok: true, value: null }
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n) || n < 0) return { ok: false }
  return { ok: true, value: n }
}

export const GET = withErrorHandler('projects GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const status  = searchParams.get('status')
  const company = searchParams.get('company')

  // Portal clients (portal projects page/dashboard) legitimately call this
  // scoped to their own company — see matching comment in
  // app/api/proposals/route.ts. Previously had no scoping check at all, so
  // a portal client could read any other client's projects by changing
  // the company param.
  const denied = company
    ? await requirePortalClient(req, company)
    : await requireRole(req, 'Team Member')
  if (denied) return denied

  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('projects')
    .select('*')
  if (status)  query = query.eq('status', status)
  if (company) query = query.eq('company', company)
  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch projects')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapProject), nextCursor)
})

export const POST = withErrorHandler('projects POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const result = validate(body, {
    company: { required: true, type: 'string', maxLength: 200 },
    serviceType: { type: 'string', maxLength: 100 },
    status: { type: 'string', enum: [...PROJECT_STATUSES] },
    overview: { type: 'string', maxLength: 5000 },
    contractId: { type: 'string', maxLength: 100 },
  })
  if (!result.valid) return validationError(result.error)

  const serviceTypes: string[] = Array.isArray(body.serviceTypes) && body.serviceTypes.length > 0
    ? body.serviceTypes
    : body.serviceType ? [body.serviceType] : ['General']
  const db = createServiceClient()

  // AUDIT.md #400 — "Convert to Project" (app/contracts/page.tsx) sends a
  // real contractId here; confirm it exists rather than letting a typo or
  // stale id silently create an unlinked project that looks linked.
  if (body.contractId) {
    const { data: contract, error: cErr } = await db.from('contracts').select('id').eq('id', body.contractId).single()
    if (cErr || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
  }

  const { data, error } = await db
    .from('projects')
    .insert({
      id:            `pr-${Date.now()}`,
      contract_id:   body.contractId || null,
      company:       body.company,
      company_id:    body.companyId || null,
      service_type:  serviceTypes[0] ?? 'General',
      service_types: serviceTypes,
      status:        body.status ?? 'Not Started',
      start_date:    body.startDate ?? null,
      launch_date:   body.launchDate ?? null,
      assigned_team: body.assignedTeam ?? [],
      progress:      body.progress ?? 0,
      milestones:    body.milestones ?? [],
      tasks:         body.tasks ?? [],
      notes:         body.notes ?? [],
      overview:      body.overview ?? '',
      sections:      body.sections ?? ['To Do', 'In Progress', 'Done'],
      color:         body.color ?? '#015035',
      description:   body.description ?? '',
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create project')
  }
  return NextResponse.json(mapProject(data), { status: 201 })
})
