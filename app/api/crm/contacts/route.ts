import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { validate, validationError } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'

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
    leadStatus:     row.lead_status ?? undefined,
    owner:          row.owner ?? '',
    tags:           row.tags ?? [],
    notes:          row.notes ?? undefined,
    contactNotes:   row.contact_notes ?? [],
    contactTasks:   row.contact_tasks ?? [],
    createdDate:    row.created_date ?? '',
    lastActivity:   row.last_activity ?? undefined,
    hubspotData:    row.hubspot_data ?? undefined,
  }
}

export const GET = withErrorHandler('crm/contacts GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')
  const pag = parsePagination(req)

  const db = createServiceClient()
  let query = db.from('crm_contacts').select('*')
  if (companyId) query = query.eq('company_id', companyId)
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch contacts')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapContact), nextCursor)
})

export const POST = withErrorHandler('crm/contacts POST', async (req) => {
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

  const emails: string[] = body.emails ?? []
  const fullName = body.fullName ?? `${body.firstName} ${body.lastName}`

  if (emails.length > 0) {
    const { data: emailMatch } = await db
      .from('crm_contacts')
      .select('id, full_name, emails')
      .overlaps('emails', emails)
      .limit(1)
      .maybeSingle()
    if (emailMatch) {
      return NextResponse.json(
        { error: `A contact with this email already exists: ${emailMatch.full_name}` },
        { status: 409 },
      )
    }
  }

  const companyName = body.companyName ?? ''
  if (fullName && companyName) {
    const { data: nameMatch } = await db
      .from('crm_contacts')
      .select('id, full_name')
      .ilike('full_name', fullName)
      .ilike('company_name', companyName)
      .limit(1)
      .maybeSingle()
    if (nameMatch) {
      return NextResponse.json(
        { error: `A contact named "${nameMatch.full_name}" already exists at this company` },
        { status: 409 },
      )
    }
  }

  const { data, error } = await db
    .from('crm_contacts')
    .insert({
      id:              `ct-${Date.now()}`,
      company_id:      body.companyId ?? null,
      company_name:    body.companyName ?? '',
      first_name:      body.firstName,
      last_name:       body.lastName,
      full_name:       fullName,
      title:           body.title ?? null,
      emails:          emails,
      phones:          body.phones ?? [],
      linked_in:       body.linkedIn ?? null,
      website:         body.website ?? null,
      is_primary:      body.isPrimary ?? false,
      lifecycle_stage: body.lifecycleStage ?? null,
      lead_status:     body.leadStatus ?? null,
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
    throw new Error(error?.message || 'Failed to create contact')
  }
  fireAutomations('contact_created', { contactId: data.id, company: data.company_name, ...data })

  return NextResponse.json(mapContact(data), { status: 201 })
})
