import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, slicePage, paginatedJson } from '@/lib/pagination'
import { slugifyForm } from '@/lib/forms'
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
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const { limit, cursor } = parsePagination(req)
  const db = createServiceClient()

  let query = db
    .from('forms')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) {
    console.error('[forms GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], limit, 'created_at')
  return paginatedJson(rows.map(mapForm), nextCursor)
}

export async function POST(req: NextRequest) {
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
    })
    .select()
    .single()

  if (error) {
    console.error('[forms POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logAudit({ userName: 'system', action: 'created_form', module: 'forms', type: 'action', metadata: { formId: data.id, name: data.name } })
  return NextResponse.json(mapForm(data), { status: 201 })
}
