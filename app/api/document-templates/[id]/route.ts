import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { validate, validationError } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

const TEMPLATE_TYPES = ['proposal', 'contract', 'addendum']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplate(row: any) {
  return {
    id:        row.id,
    name:      row.name,
    type:      row.type,
    body:      row.body,
    version:   row.version,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const GET = withErrorHandler('document-templates/[id] GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { data } = await db.from('document_templates').select('*').eq('id', id).single()
  if (!data) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  return NextResponse.json(mapTemplate(data))
})

export const PATCH = withErrorHandler('document-templates/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()

  const result = validate(body, {
    name: { type: 'string', maxLength: 200 },
    type: { type: 'string', enum: TEMPLATE_TYPES },
    body: { type: 'string', maxLength: 50_000 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const { data: existing } = await db.from('document_templates').select('type').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) update.name = body.name
  if (body.type !== undefined) update.type = body.type
  if (body.body !== undefined) {
    update.body = body.body
    // A body edit is a real content change to a legal document — bump the
    // version so anyone relying on the old text (e.g. a previously
    // generated proposal/contract) can tell it drifted from the template
    // that produced it.
    const { data: current } = await db.from('document_templates').select('version').eq('id', id).single()
    update.version = (current?.version ?? 1) + 1
  }
  if (body.isDefault !== undefined) {
    update.is_default = body.isDefault
    if (body.isDefault === true) {
      const targetType = (body.type as string | undefined) ?? existing.type
      await db.from('document_templates').update({ is_default: false }).eq('type', targetType).neq('id', id)
    }
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await db.from('document_templates').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(mapTemplate(data))
})

export const DELETE = withErrorHandler('document-templates/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('document_templates').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
  logAudit({
    userName: 'system',
    action: 'deleted_document_template',
    module: 'contracts',
    type: 'warning',
    metadata: { templateId: id },
  })
  return NextResponse.json({ deleted: id })
})
