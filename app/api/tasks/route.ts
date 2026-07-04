import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, slicePage, paginatedJson } from '@/lib/pagination'

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
    companyId:       row.company_id || null,
    assignedTo:      row.assigned_to,
    dueDate:         row.due_date ?? '',
    createdDate:     row.created_date ?? '',
    completedDate:   row.completed_date ?? undefined,
    linkedId:        row.linked_id ?? undefined,
    teamServiceLine: row.team_service_line ?? undefined,
    recurrence:      row.recurrence ?? null,
    parentTaskId:    row.parent_task_id ?? undefined,
    projectId:       row.project_id ?? undefined,
    section:         row.section ?? undefined,
    sortOrder:       row.sort_order ?? 0,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status     = searchParams.get('status')
  const assignedTo = searchParams.get('assignedTo')
  const projectId  = searchParams.get('projectId')
  const { limit, cursor } = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('app_tasks')
    .select('*')
    .order(projectId ? 'sort_order' : 'created_at', { ascending: projectId ? true : false })
    .limit(limit + 1)
  if (status)     query = query.eq('status', status)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (projectId)  query = query.eq('project_id', projectId)
  if (cursor) query = query.lt('created_at', cursor)
  const { data, error } = await query
  if (error) {
    console.error('[tasks GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch tasks' }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], limit, 'created_at')
  return paginatedJson(rows.map(mapTask), nextCursor)
}

const VALID_STATUSES = ['Pending', 'In Progress', 'Completed']
const VALID_PRIORITIES = ['High', 'Medium', 'Low']
const VALID_CATEGORIES = ['Deal', 'Contract', 'Billing', 'Renewal', 'Project', 'Ticket', 'Email', 'General']

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (body.title.length > 500) {
    return NextResponse.json({ error: 'Title too long (max 500 chars)' }, { status: 400 })
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }
  if (body.category && !VALID_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

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
      company_id:       body.companyId ?? null,
      assigned_to:      body.assignedTo ?? '',
      due_date:         body.dueDate ?? null,
      created_date:     new Date().toISOString().split('T')[0],
      linked_id:        body.linkedId ?? null,
      team_service_line: body.teamServiceLine ?? null,
      recurrence:        body.recurrence ?? null,
      parent_task_id:    body.parentTaskId ?? null,
      project_id:        body.projectId ?? null,
      section:           body.section ?? null,
      sort_order:        body.sortOrder ?? 0,
    })
    .select()
    .single()
  if (error) {
    console.error('[tasks POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create task' }, { status: 500 })
  }
  return NextResponse.json(mapTask(data), { status: 201 })
}
