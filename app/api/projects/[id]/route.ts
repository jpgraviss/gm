import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, PROJECT_STATUSES } from '@/lib/validation'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const result = validate(body, {
    status: { type: 'string', enum: [...PROJECT_STATUSES] },
    overview: { type: 'string', maxLength: 5000 },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.status !== undefined)               update.status = body.status
  if (body.progress !== undefined)             update.progress = body.progress
  if (body.milestones !== undefined)           update.milestones = body.milestones
  if (body.tasks !== undefined)                update.tasks = body.tasks
  if (body.assignedTeam !== undefined)         update.assigned_team = body.assignedTeam
  if (body.notes !== undefined)               update.notes = body.notes
  if (body.overview !== undefined)            update.overview = body.overview
  if (body.launchDate !== undefined)           update.launch_date = body.launchDate
  if (body.maintenanceStartDate !== undefined) update.maintenance_start_date = body.maintenanceStartDate
  const { data, error } = await db.from('projects').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[projects/:id PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update project' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('projects').delete().eq('id', id)
  if (error) {
    console.error('[projects/:id DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete project' }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
