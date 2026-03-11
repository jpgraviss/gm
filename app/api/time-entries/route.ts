import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEntry(row: any) {
  return {
    id:          row.id,
    date:        row.date,
    projectId:   row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    description: row.description,
    teamMember:  row.team_member,
    serviceType: row.service_type,
    hours:       row.hours,
    minutes:     row.minutes,
    billable:    row.billable,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const weekStart = searchParams.get('weekStart')
  const weekEnd   = searchParams.get('weekEnd')
  const member    = searchParams.get('member')
  const db = createServiceClient()
  let query = db.from('time_entries').select('*').order('date', { ascending: false })
  if (weekStart) query = query.gte('date', weekStart)
  if (weekEnd)   query = query.lte('date', weekEnd)
  if (member)    query = query.eq('team_member', member)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(mapEntry))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from('time_entries')
    .insert({
      id:           `te-${Date.now()}`,
      date:         body.date,
      project_id:   body.projectId ?? null,
      project_name: body.projectName ?? null,
      description:  body.description ?? '',
      team_member:  body.teamMember ?? '',
      service_type: body.serviceType ?? 'General',
      hours:        body.hours ?? 0,
      minutes:      body.minutes ?? 0,
      billable:     body.billable ?? true,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapEntry(data), { status: 201 })
}
