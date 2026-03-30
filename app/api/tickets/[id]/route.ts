import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, TICKET_STATUSES, TASK_PRIORITIES } from '@/lib/validation'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const result = validate(body, {
    status: { type: 'string', enum: [...TICKET_STATUSES] },
    priority: { type: 'string', enum: [...TASK_PRIORITIES] },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()
  const update: Record<string, unknown> = {
    updated_date: new Date().toISOString().split('T')[0],
  }
  if (body.status !== undefined)     update.status = body.status
  if (body.priority !== undefined)   update.priority = body.priority
  if (body.assignedTo !== undefined) update.assigned_to = body.assignedTo
  if (body.tags !== undefined)       update.tags = body.tags
  if (body.messages !== undefined)   update.messages = body.messages
  if (body.linkedTaskId !== undefined) update.linked_task_id = body.linkedTaskId
  const { data, error } = await db.from('tickets').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[tickets PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update ticket' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('tickets').delete().eq('id', id)
  if (error) {
    console.error('[tickets DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete ticket' }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
