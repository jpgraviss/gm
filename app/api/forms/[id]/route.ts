import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapForm(row: any) {
  return {
    id:              row.id,
    name:            row.name,
    slug:            row.slug,
    description:     row.description ?? '',
    fields:          row.fields ?? [],
    submitLabel:     row.submit_label,
    successMessage:  row.success_message,
    redirectUrl:     row.redirect_url ?? undefined,
    notifyEmails:    row.notify_emails ?? [],
    createContact:   row.create_contact,
    createDeal:      row.create_deal,
    dealStage:       row.deal_stage ?? undefined,
    tags:            row.tags ?? [],
    owner:           row.owner ?? undefined,
    status:          row.status,
    submissionsCount: row.submissions_count ?? 0,
    primaryColor:    row.primary_color ?? '#015035',
    textColor:       row.text_color ?? '#111827',
    bgColor:         row.bg_color ?? '#f9fafb',
    bgTransparent:   row.bg_transparent ?? false,
    fontFamily:      row.font_family ?? 'system-ui',
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db.from('forms').select('*').eq('id', id).single()
  if (error || !data) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }
  return NextResponse.json(mapForm(data))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined)            update.name = body.name
  if (body.description !== undefined)     update.description = body.description
  if (body.fields !== undefined)          update.fields = body.fields
  if (body.submitLabel !== undefined)     update.submit_label = body.submitLabel
  if (body.successMessage !== undefined)  update.success_message = body.successMessage
  if (body.redirectUrl !== undefined)     update.redirect_url = body.redirectUrl
  if (body.notifyEmails !== undefined)    update.notify_emails = body.notifyEmails
  if (body.createContact !== undefined)   update.create_contact = body.createContact
  if (body.createDeal !== undefined)      update.create_deal = body.createDeal
  if (body.dealStage !== undefined)       update.deal_stage = body.dealStage
  if (body.tags !== undefined)            update.tags = body.tags
  if (body.owner !== undefined)           update.owner = body.owner
  if (body.status !== undefined)          update.status = body.status
  if (body.primaryColor !== undefined)   update.primary_color = body.primaryColor
  if (body.textColor !== undefined)      update.text_color = body.textColor
  if (body.bgColor !== undefined)        update.bg_color = body.bgColor
  if (body.bgTransparent !== undefined)  update.bg_transparent = body.bgTransparent
  if (body.fontFamily !== undefined)     update.font_family = body.fontFamily

  const { data, error } = await db.from('forms').update(update).eq('id', id).select().single()
  if (error || !data) {
    console.error('[forms PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update form' }, { status: 500 })
  }
  return NextResponse.json(mapForm(data))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('forms').delete().eq('id', id)
  if (error) {
    console.error('[forms DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logAudit({ userName: 'system', action: 'deleted_form', module: 'forms', type: 'warning', metadata: { formId: id } })
  return NextResponse.json({ deleted: id })
}
