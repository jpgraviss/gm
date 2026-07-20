import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { slugifyForm } from '@/lib/forms'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'

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
    popupConfig:     row.popup_config ?? undefined,
    webhookUrl:      row.webhook_url ?? undefined,
    sendConfirmation: row.send_confirmation ?? false,
    confirmationSubject: row.confirmation_subject ?? undefined,
    confirmationMessage: row.confirmation_message ?? undefined,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  }
}

export const GET = withErrorHandler('forms GET', async (req: NextRequest) => {
  const pag = parsePagination(req)
  const db = createServiceClient()

  let query = db
    .from('forms')
    .select('*')
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    throw new Error(String(error))
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapForm), nextCursor)
})

export const POST = withErrorHandler('forms POST', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const actor = await getAuthUser(req)
  const body = await req.json()

  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Generate unique slug — append suffix if taken
  let slug = body.slug ? slugifyForm(body.slug) : slugifyForm(body.name)
  for (let i = 0; i < 10; i++) {
    const { data: existing } = await db.from('forms').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    slug = `${slugifyForm(body.name)}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data, error } = await db
    .from('forms')
    .insert({
      id:              `form-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name:            body.name,
      slug,
      description:     body.description ?? null,
      fields:          body.fields ?? [],
      submit_label:    body.submitLabel ?? 'Submit',
      success_message: body.successMessage ?? "Thanks! We'll be in touch.",
      redirect_url:    body.redirectUrl ?? null,
      notify_emails:   body.notifyEmails ?? [],
      create_contact:  body.createContact ?? true,
      create_deal:     body.createDeal ?? false,
      deal_stage:      body.dealStage ?? null,
      tags:            body.tags ?? [],
      owner:           body.owner ?? null,
      status:          body.status ?? 'Active',
      primary_color:   body.primaryColor ?? '#015035',
      text_color:      body.textColor ?? '#111827',
      bg_color:        body.bgColor ?? '#f9fafb',
      bg_transparent:  body.bgTransparent ?? false,
      font_family:     body.fontFamily ?? 'system-ui',
      popup_config:    body.popupConfig ?? null,
      webhook_url:     body.webhookUrl ?? null,
      send_confirmation: body.sendConfirmation ?? false,
      confirmation_subject: body.confirmationSubject ?? null,
      confirmation_message: body.confirmationMessage ?? null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(String(error))
  }

  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'created_form', module: 'forms', type: 'action', metadata: { formId: data.id, name: data.name } })
  return NextResponse.json(mapForm(data), { status: 201 })
})
