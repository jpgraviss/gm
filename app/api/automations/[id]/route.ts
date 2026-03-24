import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.name    !== undefined) update.name     = body.name
  if (body.trigger !== undefined) update.trigger  = body.trigger
  if (body.actions !== undefined) update.actions  = body.actions
  if (body.status  !== undefined) update.status   = body.status
  if (body.runs    !== undefined) update.runs     = body.runs
  if (body.lastRun !== undefined) update.last_run = body.lastRun
  const { data, error } = await db.from('automations').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[automations/:id PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update automation' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('automations').delete().eq('id', id)
  if (error) {
    console.error('[automations/:id DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete automation' }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
