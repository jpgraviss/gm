import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.stage !== undefined)       update.stage = body.stage
  if (body.value !== undefined)       update.value = body.value
  if (body.probability !== undefined) update.probability = body.probability
  if (body.assignedRep !== undefined) update.assigned_rep = body.assignedRep
  if (body.closeDate !== undefined)   update.close_date = body.closeDate
  if (body.notes !== undefined)       update.notes = body.notes
  if (body.contact !== undefined)     update.contact = body.contact
  update.last_activity = new Date().toISOString().split('T')[0]
  const { data, error } = await db.from('deals').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('deals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}
