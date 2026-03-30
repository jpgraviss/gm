import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { validate, validationError } from '@/lib/validation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContact(row: any) {
  return {
    id:             row.id,
    companyId:      row.company_id ?? undefined,
    companyName:    row.company_name ?? '',
    firstName:      row.first_name ?? '',
    lastName:       row.last_name ?? '',
    fullName:       row.full_name ?? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
    title:          row.title ?? undefined,
    emails:         row.emails ?? [],
    phones:         row.phones ?? [],
    linkedIn:       row.linked_in ?? undefined,
    website:        row.website ?? undefined,
    isPrimary:      row.is_primary ?? false,
    lifecycleStage: row.lifecycle_stage ?? undefined,
    owner:          row.owner ?? '',
    tags:           row.tags ?? [],
    notes:          row.notes ?? undefined,
    contactNotes:   row.contact_notes ?? [],
    contactTasks:   row.contact_tasks ?? [],
    createdDate:    row.created_date ?? '',
    lastActivity:   row.last_activity ?? undefined,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')

  const db = createServiceClient()
  let query = db.from('crm_contacts').select('*').order('full_name')
  if (companyId) query = query.eq('company_id', companyId)

  const { data, error } = await query
  if (error) {
    console.error('[crm/contacts GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch contacts' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapContact))
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const result = validate(body, {
    firstName:   { required: true, type: 'string', maxLength: 100 },
    lastName:    { required: true, type: 'string', maxLength: 100 },
    companyName: { type: 'string', maxLength: 200 },
    title:       { type: 'string', maxLength: 200 },
    emails:      { type: 'array' },
    owner:       { type: 'string', maxLength: 200 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('crm_contacts')
    .insert({
      id:              `ct-${Date.now()}`,
      company_id:      body.companyId ?? null,
      company_name:    body.companyName ?? '',
      first_name:      body.firstName,
      last_name:       body.lastName,
      full_name:       body.fullName ?? `${body.firstName} ${body.lastName}`,
      title:           body.title ?? null,
      emails:          body.emails ?? [],
      phones:          body.phones ?? [],
      linked_in:       body.linkedIn ?? null,
      website:         body.website ?? null,
      is_primary:      body.isPrimary ?? false,
      lifecycle_stage: body.lifecycleStage ?? null,
      owner:           body.owner ?? '',
      tags:            body.tags ?? [],
      notes:           body.notes ?? null,
      contact_notes:   body.contactNotes ?? [],
      contact_tasks:   body.contactTasks ?? [],
      created_date:    new Date().toISOString().split('T')[0],
    })
    .select()
    .single()
  if (error) {
    console.error('[crm/contacts POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create contact' }, { status: 500 })
  }
  fireAutomations('contact_created', { contactId: data.id, company: data.company_name, ...data })

  return NextResponse.json(mapContact(data), { status: 201 })
}
