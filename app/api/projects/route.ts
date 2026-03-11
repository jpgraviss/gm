import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

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
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const db = createServiceClient()
  let query = db.from('projects').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(mapProject))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
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
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapProject(data), { status: 201 })
}
