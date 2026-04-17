import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlaybook(row: any) {
  return {
    id:          row.id,
    workspaceId: row.workspace_id,
    title:       row.title,
    category:    row.category ?? '',
    content:     row.content ?? '',
    tags:        row.tags ?? [],
    status:      row.status,
    createdBy:   row.created_by ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db.from('playbooks').select('*').eq('id', id).single()
  if (error || !data) {
    return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })
  }
  return NextResponse.json(mapPlaybook(data))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined)    update.title = body.title
  if (body.category !== undefined) update.category = body.category
  if (body.content !== undefined)  update.content = body.content
  if (body.tags !== undefined)     update.tags = body.tags
  if (body.status !== undefined)   update.status = body.status

  const { data, error } = await db.from('playbooks').update(update).eq('id', id).select().single()
  if (error || !data) {
    console.error('[playbooks PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update playbook' }, { status: 500 })
  }
  return NextResponse.json(mapPlaybook(data))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('playbooks').delete().eq('id', id)
  if (error) {
    console.error('[playbooks DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logAudit({ userName: 'system', action: 'deleted_playbook', module: 'sales_enablement', type: 'warning', metadata: { playbookId: id } })
  return NextResponse.json({ deleted: id })
}
