import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.name !== undefined)     update.name = body.name
  if (body.email !== undefined)    update.email = body.email
  if (body.role !== undefined)     update.role = body.role
  if (body.unit !== undefined)     update.unit = body.unit
  if (body.status !== undefined)   update.status = body.status
  if (body.isAdmin !== undefined)  update.is_admin = body.isAdmin
  if (body.initials !== undefined) update.initials = body.initials
  const { data, error } = await db.from('team_members').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[team-members/:id PUT]', error)
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('team_members').delete().eq('id', id)
  if (error) {
    console.error('[team-members/:id DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
