import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('tickets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}
