import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
  const update: Record<string, unknown> = {
    last_modified: new Date().toISOString().split('T')[0],
  }
  if (body.name           !== undefined) update.name            = body.name
  if (body.status         !== undefined) update.status          = body.status
  if (body.trigger        !== undefined) update.trigger         = body.trigger
  if (body.targetSegment  !== undefined) update.target_segment  = body.targetSegment
  if (body.enrolledCount  !== undefined) update.enrolled_count  = body.enrolledCount
  if (body.activeCount    !== undefined) update.active_count    = body.activeCount
  if (body.completedCount !== undefined) update.completed_count = body.completedCount
  if (body.openRate       !== undefined) update.open_rate       = body.openRate
  if (body.clickRate      !== undefined) update.click_rate      = body.clickRate
  if (body.replyRate      !== undefined) update.reply_rate      = body.replyRate
  if (body.steps          !== undefined) update.steps           = body.steps
  const { data, error } = await db.from('sequences').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('sequences').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}
