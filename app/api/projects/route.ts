import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, PROJECT_STATUSES } from '@/lib/validation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(row: any) {
  return {
    id:                   row.id,
    contractId:           row.contract_id ?? '',
    company:              row.company,
    serviceType:          row.service_type,
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
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status  = searchParams.get('status')
  const company = searchParams.get('company')
  const db = createServiceClient()
  let query = db.from('projects').select('*').order('created_at', { ascending: false })
  if (status)  query = query.eq('status', status)
  if (company) query = query.eq('company', company)
  const { data, error } = await query
  if (error) {
    console.error('[projects GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch projects' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapProject))
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
  const db = createServiceClient()
  const { data, error } = await db
    .from('projects')
    .insert({
      id:            `pr-${Date.now()}`,
      contract_id:   body.contractId ?? null,
      company:       body.company,
      service_type:  body.serviceType ?? 'General',
      status:        body.status ?? 'Not Started',
      start_date:    body.startDate ?? null,
      launch_date:   body.launchDate ?? null,
      assigned_team: body.assignedTeam ?? [],
      progress:      body.progress ?? 0,
      milestones:    body.milestones ?? [],
      tasks:         body.tasks ?? [],
      notes:         body.notes ?? [],
      overview:      body.overview ?? '',
    })
    .select()
    .single()
  if (error) {
    console.error('[projects POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create project' }, { status: 500 })
  }
  return NextResponse.json(mapProject(data), { status: 201 })
}
