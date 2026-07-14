import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { computeDealScore } from '@/lib/deal-score'
import { requireRole } from '@/lib/rbac'

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
    serviceType: { type: 'string', maxLength: 100 },
    assignedRep: { type: 'string', maxLength: 200 },
    probability: { type: 'number', min: 0, max: 100 },
  })
  if (!result.valid) return validationError(result.error)

  const serviceTypes: string[] = Array.isArray(body.serviceTypes) && body.serviceTypes.length > 0
    ? body.serviceTypes
    : body.serviceType ? [body.serviceType] : ['General']
  const db = createServiceClient()
  const { data, error } = await db
    .from('deals')
    .insert({
      id:           `deal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      company:      body.company,
      contact:      body.contact ?? null,
      stage:        body.stage ?? 'Lead',
      value:        body.value ?? 0,
      service_type: serviceTypes[0] ?? 'General',
      service_types: serviceTypes,
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
