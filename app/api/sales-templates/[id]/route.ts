import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplate(row: any) {
  return {
    id:          row.id,
    workspaceId: row.workspace_id,
    title:       row.title,
    category:    row.category ?? undefined,
    content:     row.content ?? '',
    subject:     row.subject ?? undefined,
    tags:        row.tags ?? [],
    usageCount:  row.usage_count ?? 0,
    status:      row.status,
    createdBy:   row.created_by ?? undefined,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

export const GET = withErrorHandler('sales-templates/[id] GET', async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db.from('sales_templates').select('*').eq('id', id).single()
  if (error || !data) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }
  return NextResponse.json(mapTemplate(data))
})

export const PATCH = withErrorHandler('sales-templates/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined)       update.title = body.title
  if (body.category !== undefined)    update.category = body.category
  if (body.content !== undefined)     update.content = body.content
  if (body.subject !== undefined)     update.subject = body.subject
  if (body.tags !== undefined)        update.tags = body.tags
  if (body.status !== undefined)      update.status = body.status
  if (body.workspaceId !== undefined) update.workspace_id = body.workspaceId

  const { data, error } = await db.from('sales_templates').update(update).eq('id', id).select().single()
  if (error || !data) {
    throw new Error(error?.message || 'Failed to update template')
  }
  return NextResponse.json(mapTemplate(data))
})

export const DELETE = withErrorHandler('sales-templates/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('sales_templates').delete().eq('id', id)
  if (error) {
    throw new Error(error.message || 'Failed to delete template')
  }
  logAudit({ userName: 'system', action: 'deleted_sales_template', module: 'sales-templates', type: 'warning', metadata: { templateId: id } })
  return NextResponse.json({ deleted: id })
})
