import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, isConfigured } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (!isConfigured) {
    return NextResponse.json({ id, ...body })
  }
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.date !== undefined)        update.date = body.date
  if (body.description !== undefined) update.description = body.description
  if (body.teamMember !== undefined)  update.team_member = body.teamMember
  if (body.serviceType !== undefined) update.service_type = body.serviceType
  if (body.hours !== undefined)       update.hours = body.hours
  if (body.minutes !== undefined)     update.minutes = body.minutes
  if (body.billable !== undefined)    update.billable = body.billable
  if (body.projectId !== undefined)   update.project_id = body.projectId
  if (body.projectName !== undefined) update.project_name = body.projectName

  const { data, error } = await db.from('time_entries').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isConfigured) {
    return NextResponse.json({ deleted: id })
  }
  const db = createServiceClient()
  const { error } = await db.from('time_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}
