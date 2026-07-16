import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole, getAuthUser } from '@/lib/rbac'
import { departmentForUnit } from '@/lib/task-department'

// Mirrors the department-visibility rule in tasks GET (Operations should
// never touch a Finance task by id just because they know/guessed its id) —
// PATCH/DELETE previously had no such scoping despite the list route
// deliberately hiding these tasks from the same caller.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function canTouchTask(user: any, taskDepartment: string | null, assignedTo: string): Promise<boolean> {
  if (user.isAdmin || user.role === 'Leadership' || user.role === 'Super Admin') return true
  if (!taskDepartment || taskDepartment === 'CRM' || taskDepartment === 'General') return true
  if (departmentForUnit(user.unit) === taskDepartment) return true
  return assignedTo === user.name
}

export const PATCH = withErrorHandler('tasks/[id] PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const user = await getAuthUser(req)
  const { data: existing } = await db.from('app_tasks').select('department, assigned_to').eq('id', id).maybeSingle()
  if (existing && user && !(await canTouchTask(user, existing.department, existing.assigned_to))) {
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
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('tasks/[id] DELETE', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()

  const user = await getAuthUser(req)
  const { data: existing } = await db.from('app_tasks').select('department, assigned_to').eq('id', id).maybeSingle()
  if (existing && user && !(await canTouchTask(user, existing.department, existing.assigned_to))) {
    return NextResponse.json({ error: 'Forbidden: task belongs to another department' }, { status: 403 })
  }

  const { error } = await db.from('app_tasks').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete task')
  }
  return NextResponse.json({ deleted: id })
})
