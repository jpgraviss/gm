import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, PROJECT_STATUSES } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'

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
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status  = searchParams.get('status')
  const company = searchParams.get('company')
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
    console.error('[projects GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch projects' }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapProject), nextCursor)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = validate(body, {
    company: { required: true, type: 'string', maxLength: 200 },
    serviceType: { type: 'string', maxLength: 100 },
    status: { type: 'string', enum: [...PROJECT_STATUSES] },
    overview: { type: 'string', maxLength: 5000 },
  })
  if (!result.valid) return validationError(result.error)

  const serviceTypes: string[] = Array.isArray(body.serviceTypes) && body.serviceTypes.length > 0
    ? body.serviceTypes
    : body.serviceType ? [body.serviceType] : ['General']
  const db = createServiceClient()
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
    console.error('[projects POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create project' }, { status: 500 })
  }
  return NextResponse.json(mapProject(data), { status: 201 })
}
