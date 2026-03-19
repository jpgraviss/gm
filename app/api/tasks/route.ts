import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTask(row: any) {
  return {
    id:              row.id,
    title:           row.title,
    description:     row.description ?? undefined,
    category:        row.category,
    priority:        row.priority,
    status:          row.status,
    company:         row.company ?? undefined,
    assignedTo:      row.assigned_to,
    dueDate:         row.due_date ?? '',
    createdDate:     row.created_date ?? '',
    completedDate:   row.completed_date ?? undefined,
    linkedId:        row.linked_id ?? undefined,
    teamServiceLine: row.team_service_line ?? undefined,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status     = searchParams.get('status')
  const assignedTo = searchParams.get('assignedTo')
  const db = createServiceClient()
  let query = db.from('app_tasks').select('*').order('due_date', { ascending: true })
  if (status)     query = query.eq('status', status)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  const { data, error } = await query
  if (error) {
    console.error('[tasks GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch tasks' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapTask))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from('app_tasks')
    .insert({
      id:               `task-${Date.now()}`,
      title:            body.title,
      description:      body.description ?? null,
      category:         body.category ?? 'General',
      priority:         body.priority ?? 'Medium',
      status:           body.status ?? 'Pending',
      company:          body.company ?? null,
      assigned_to:      body.assignedTo ?? '',
      due_date:         body.dueDate ?? null,
      created_date:     new Date().toISOString().split('T')[0],
      linked_id:        body.linkedId ?? null,
      team_service_line: body.teamServiceLine ?? null,
    })
    .select()
    .single()
  if (error) {
    console.error('[tasks POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create task' }, { status: 500 })
  }
  return NextResponse.json(mapTask(data), { status: 201 })
}
