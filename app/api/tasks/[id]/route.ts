import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole, getAuthUser } from '@/lib/rbac'
import { departmentForUnit, TASK_DEPARTMENTS } from '@/lib/task-department'
import { VALID_STATUSES, VALID_PRIORITIES, VALID_CATEGORIES, mapTask } from '../route'
import { fireAutomations } from '@/lib/automations-engine'

// Mirrors the department-visibility rule in tasks GET (Operations should
// never touch a Finance task by id just because they know/guessed its id) —
// PATCH/DELETE previously had no such scoping despite the list route
// deliberately hiding these tasks from the same caller. Service-line
// scoping mirrors the same GET rule too: a service-tagged task is private
// to its assignee regardless of department, since it never broadcast to
// the department list in the first place.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function canTouchTask(user: any, taskDepartment: string | null, taskServiceLine: string | null, assignedTo: string): Promise<boolean> {
  // AUDIT #670 — same 'Dept Manager'/'Department Manager' alias gap as
  // the GET filter in this file's sibling route.
  if (user.isAdmin || user.role === 'Leadership' || user.role === 'Super Admin' || user.role === 'Department Manager' || user.role === 'Dept Manager') return true
  if (assignedTo === user.name) return true
  if (taskServiceLine) return false
  if (!taskDepartment || taskDepartment === 'CRM' || taskDepartment === 'General') return true
  return departmentForUnit(user.unit) === taskDepartment
}

export const PATCH = withErrorHandler('tasks/[id] PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  // Matches the enum validation POST /api/tasks already has (AUDIT #222) —
  // this route previously passed status/priority/category/department
  // straight through, so an invalid value silently vanished the task from
  // the Kanban board (its column/color lookups key off exact enum values)
  // while it still counted in "Total Tasks".
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }
  if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (body.department !== undefined && body.department !== null && !(TASK_DEPARTMENTS as readonly string[]).includes(body.department)) {
    return NextResponse.json({ error: 'Invalid department' }, { status: 400 })
  }

  const user = await getAuthUser(req)
  const { data: existing } = await db.from('app_tasks').select('department, assigned_to, team_service_line, status').eq('id', id).maybeSingle()
  if (existing && user && !(await canTouchTask(user, existing.department, existing.team_service_line, existing.assigned_to))) {
    return NextResponse.json({ error: 'Forbidden: task belongs to another department' }, { status: 403 })
  }

  const update: Record<string, unknown> = {}
  if (body.status !== undefined)        update.status = body.status
  if (body.title !== undefined)         update.title = body.title
  if (body.description !== undefined)   update.description = body.description
  if (body.category !== undefined)      update.category = body.category
  if (body.priority !== undefined)      update.priority = body.priority
  if (body.dueDate !== undefined)       update.due_date = body.dueDate
  if (body.assignedTo !== undefined)    update.assigned_to = body.assignedTo
  if (body.company !== undefined)       update.company = body.company
  if (body.companyId !== undefined)     update.company_id = body.companyId
  if (body.completedDate !== undefined) update.completed_date = body.completedDate
  if (body.recurrence !== undefined)    update.recurrence = body.recurrence
  if (body.projectId !== undefined)     update.project_id = body.projectId
  if (body.section !== undefined)       update.section = body.section
  if (body.sortOrder !== undefined)     update.sort_order = body.sortOrder
  if (body.department !== undefined)    update.department = body.department
  const { data, error } = await db.from('app_tasks').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update task')
  }
  // Delivery/Operations previously had no automation trigger at all. Only
  // fires on a real transition INTO Completed, so re-saving an
  // already-completed task doesn't re-fire downstream automations.
  if (body.status === 'Completed' && existing?.status !== 'Completed') {
    fireAutomations('task_completed', {
      taskId: id,
      title: data.title,
      category: data.category,
      priority: data.priority,
      assignedTo: data.assigned_to,
      company: data.company,
      companyId: data.company_id,
      projectId: data.project_id,
    })
  }

  // AUDIT #537 — GET/POST both return mapTask()'s camelCase shape; this
  // used to return the raw snake_case row, the same bug class #202 fixed
  // for tickets.
  return NextResponse.json(mapTask(data))
})

export const DELETE = withErrorHandler('tasks/[id] DELETE', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()

  const user = await getAuthUser(req)
  const { data: existing } = await db.from('app_tasks').select('department, assigned_to, team_service_line').eq('id', id).maybeSingle()
  if (existing && user && !(await canTouchTask(user, existing.department, existing.team_service_line, existing.assigned_to))) {
    return NextResponse.json({ error: 'Forbidden: task belongs to another department' }, { status: 403 })
  }

  const { error } = await db.from('app_tasks').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete task')
  }
  return NextResponse.json({ deleted: id })
})
