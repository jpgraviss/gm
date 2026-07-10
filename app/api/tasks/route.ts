import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser } from '@/lib/rbac'
import { TASK_DEPARTMENTS, departmentForUnit } from '@/lib/task-department'

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
    department:      row.department ?? null,
  }
}

export const GET = withErrorHandler('tasks GET', async (req: NextRequest) => {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status     = searchParams.get('status')
  const assignedTo = searchParams.get('assignedTo')
  const projectId  = searchParams.get('projectId')
  const companyId  = searchParams.get('companyId')
  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('app_tasks')
    .select('*')
  if (status)     query = query.eq('status', status)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (projectId)  query = query.eq('project_id', projectId)
  if (companyId)  query = query.eq('company_id', companyId)

  // Department visibility: Leadership/Super Admin/admins see everything.
  // Everyone else only sees CRM/General/untagged tasks (cross-functional,
  // company-scoped work), tasks in their own mapped department, and
  // anything explicitly assigned to them — never another department's
  // internal task list (e.g. Operations never sees Finance tasks).
  const unrestricted = user.isAdmin || user.role === 'Leadership' || user.role === 'Super Admin'
  if (!unrestricted) {
    const dept = departmentForUnit(user.unit)
    const safeDepts = Array.from(new Set(['CRM', 'General', ...(dept ? [dept] : [])]))
    const safeName = user.name.replace(/[,()]/g, '')
    query = query.or(`department.is.null,department.in.(${safeDepts.join(',')}),assigned_to.eq.${safeName}`)
  }

  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch tasks')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapTask), nextCursor)
})

const VALID_STATUSES = ['Pending', 'In Progress', 'Completed']
const VALID_PRIORITIES = ['High', 'Medium', 'Low']
const VALID_CATEGORIES = ['Deal', 'Contract', 'Billing', 'Renewal', 'Project', 'Ticket', 'Email', 'General']

export const POST = withErrorHandler('tasks POST', async (req: NextRequest) => {
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
  if (body.department && !(TASK_DEPARTMENTS as readonly string[]).includes(body.department)) {
    return NextResponse.json({ error: 'Invalid department' }, { status: 400 })
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
      department:        body.department ?? (body.companyId ? 'CRM' : null),
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create task')
  }
  return NextResponse.json(mapTask(data), { status: 201 })
})
