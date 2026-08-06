import { NextRequest, NextResponse } from 'next/server'
import { ALL_SERVICE_VALUES } from '@/lib/services'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { computeDealScore } from '@/lib/deal-score'
import { requireRole } from '@/lib/rbac'
import { normalizeDealLineItems, computeLineItemsTotal, serviceTypesFromLineItems } from '@/lib/deal-line-items'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDeal(row: any) {
  const { score, factors } = computeDealScore({
    probability: row.probability ?? 0,
    lastActivity: row.last_activity,
    closeDate: row.close_date,
    stage: row.stage,
  })
  return {
    id:           row.id,
    company:      row.company,
    contact:      row.contact ?? { id: '', name: '', email: '', phone: '', title: '' },
    stage:        row.stage,
    value:        row.value,
    serviceType:  row.service_type,
    serviceTypes: row.service_types ?? [],
    closeDate:    row.close_date ?? '',
    assignedRep:  row.assigned_rep,
    probability:  row.probability,
    notes:        row.notes ?? [],
    lastActivity: row.last_activity ?? '',
    pipelineId:   row.pipeline_id ?? 'client-acquisition',
    companyId:    row.company_id ?? null,
    contactId:    row.contact_id ?? null,
    dealScore:    score,
    dealScoreFactors: factors,
    customFields: row.custom_fields ?? {},
    lineItems:    row.line_items ?? [],
  }
}

export const GET = withErrorHandler('deals GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')
  const pipelineId = searchParams.get('pipeline_id')
  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('deals')
    .select('*')
  if (stage) query = query.eq('stage', stage)
  if (pipelineId) query = query.eq('pipeline_id', pipelineId)
  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch deals')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapDeal), nextCursor)
})

export const POST = withErrorHandler('deals POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const body = await req.json()

  const result = validate(body, {
    company:     { required: true, type: 'string', maxLength: 200 },
    stage:       { type: 'string', maxLength: 100 },
    value:       { type: 'number', min: 0, max: 100_000_000 },
    // Validated against the catalog (canonical names + aliases + legacy
    // values), not free text. `deals.service_type` previously accepted any
    // string up to 100 chars, which is how deal TITLES ended up in the
    // service column — 'Scoreboard Designer', '2026 Website Redesign +
    // Hosting' and ~25 others, cleaned up in migration 20260805180000.
    // Importers still go through normalizeServiceType() instead, since they
    // genuinely receive free text and must map rather than reject.
    serviceType: { type: 'string', enum: [...ALL_SERVICE_VALUES] },
    assignedRep: { type: 'string', maxLength: 200 },
    probability: { type: 'number', min: 0, max: 100 },
  })
  if (!result.valid) return validationError(result.error)

  // Line items (see lib/deal-line-items.ts) are the source of truth for
  // value/serviceTypes when present — a deal pitched as multiple
  // products/services at different rates ($25.5K one-time + $57K recurring,
  // etc.) instead of one opaque number. Falls back to the plain
  // value/serviceType(s) fields when absent, so simple single-service deals
  // aren't required to build a line-item list.
  const lineItems = normalizeDealLineItems(body.lineItems)
  const serviceTypes: string[] = lineItems.length > 0
    ? serviceTypesFromLineItems(lineItems)
    : Array.isArray(body.serviceTypes) && body.serviceTypes.length > 0
      ? body.serviceTypes
      : body.serviceType ? [body.serviceType] : ['General']
  const value = lineItems.length > 0 ? computeLineItemsTotal(lineItems) : (body.value ?? 0)
  const db = createServiceClient()
  const { data, error } = await db
    .from('deals')
    .insert({
      id:           `deal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      company:      body.company,
      contact:      body.contact ?? null,
      stage:        body.stage ?? 'Lead',
      value,
      service_type: serviceTypes[0] ?? 'General',
      service_types: serviceTypes,
      line_items:   lineItems,
      close_date:   body.closeDate ?? null,
      assigned_rep: body.assignedRep ?? '',
      probability:  body.probability ?? 0,
      notes:        body.notes ?? [],
      last_activity: new Date().toISOString().split('T')[0],
      pipeline_id:  body.pipelineId ?? 'client-acquisition',
      company_id:   body.companyId ?? null,
      contact_id:   body.contactId ?? null,
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create deal')
  }
  return NextResponse.json(mapDeal(data), { status: 201 })
})
