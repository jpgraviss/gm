import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.status !== undefined)        update.status = body.status
  if (body.title !== undefined)         update.title = body.title
  if (body.priority !== undefined)      update.priority = body.priority
  if (body.dueDate !== undefined)       update.due_date = body.dueDate
  if (body.assignedTo !== undefined)    update.assigned_to = body.assignedTo
  if (body.completedDate !== undefined) update.completed_date = body.completedDate
  const { data, error } = await db.from('app_tasks').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[tasks/:id PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update task' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('app_tasks').delete().eq('id', id)
  if (error) {
    console.error('[tasks/:id DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete task' }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
