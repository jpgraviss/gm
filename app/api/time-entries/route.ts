import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, isConfigured } from '@/lib/supabase'
import { timeEntries as seedEntries } from '@/lib/data'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const weekStart = searchParams.get('weekStart')
  const weekEnd   = searchParams.get('weekEnd')
  const member    = searchParams.get('member')

  if (!isConfigured) {
    let results = [...seedEntries]
    if (weekStart) results = results.filter(e => e.date >= weekStart)
    if (weekEnd)   results = results.filter(e => e.date <= weekEnd)
    if (member)    results = results.filter(e => e.teamMember === member)
    return NextResponse.json(results)
  }

  const db = createServiceClient()
  let query = db.from('time_entries').select('*').order('date', { ascending: false })
  if (weekStart) query = query.gte('date', weekStart)
  if (weekEnd)   query = query.lte('date', weekEnd)
  if (member)    query = query.eq('team_member', member)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const entry = {
    id:           body.id ?? `te-${Date.now()}`,
    date:         body.date,
    project_id:   body.projectId,
    project_name: body.projectName,
    description:  body.description,
    team_member:  body.teamMember,
    service_type: body.serviceType,
    hours:        body.hours ?? 0,
    minutes:      body.minutes ?? 0,
    billable:     body.billable ?? true,
  }

  if (!isConfigured) {
    return NextResponse.json({ ...body, id: entry.id })
  }

  const db = createServiceClient()
  const { data, error } = await db.from('time_entries').insert(entry).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
