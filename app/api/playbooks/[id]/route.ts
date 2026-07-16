import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlaybook(row: any) {
  return {
    id:          row.id,
    workspaceId: row.workspace_id,
    title:       row.title,
    category:    row.category ?? undefined,
    content:     row.content ?? '',
    tags:        row.tags ?? [],
    status:      row.status,
    createdBy:   row.created_by ?? undefined,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

export const GET = withErrorHandler('playbooks/[id] GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db.from('playbooks').select('*').eq('id', id).single()
  if (error || !data) {
    return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })
  }
  return NextResponse.json(mapPlaybook(data))
})

export const PATCH = withErrorHandler('playbooks/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined)       update.title = body.title
  if (body.category !== undefined)    update.category = body.category
  if (body.content !== undefined)     update.content = body.content
  if (body.tags !== undefined)        update.tags = body.tags
  if (body.status !== undefined)      update.status = body.status
  if (body.workspaceId !== undefined) update.workspace_id = body.workspaceId

  const { data, error } = await db.from('playbooks').update(update).eq('id', id).select().single()
  if (error || !data) {
    throw new Error(error?.message || 'Failed to update playbook')
  }
  return NextResponse.json(mapPlaybook(data))
})

export const DELETE = withErrorHandler('playbooks/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('playbooks').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete playbook')
  }
  logAudit({ userName: 'system', action: 'deleted_playbook', module: 'playbooks', type: 'warning', metadata: { playbookId: id } })
  return NextResponse.json({ deleted: id })
})
