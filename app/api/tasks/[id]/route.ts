import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

export const PATCH = withErrorHandler('tasks/[id] PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
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
  const { data, error } = await db.from('app_tasks').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update task')
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('tasks/[id] DELETE', async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('app_tasks').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete task')
  }
  return NextResponse.json({ deleted: id })
})
