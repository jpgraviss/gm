import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, TICKET_STATUSES, TASK_PRIORITIES } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTicket(row: any) {
  return {
    id:            row.id,
    subject:       row.subject,
    company:       row.company,
    companyId:     row.company_id || null,
    contactName:   row.contact_name ?? '',
    contactEmail:  row.contact_email ?? '',
    status:        row.status,
    priority:      row.priority,
    source:        row.source,
    serviceType:   row.service_type,
    projectId:     row.project_id ?? undefined,
    assignedTo:    row.assigned_to ?? undefined,
    tags:          row.tags ?? [],
    messages:      row.messages ?? [],
    linkedTaskId:  row.linked_task_id ?? undefined,
    createdDate:   row.created_date ?? '',
    updatedDate:   row.updated_date ?? '',
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const company = searchParams.get('company')
  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('tickets')
    .select('*')
  if (status) query = query.eq('status', status)
  if (company) query = query.eq('company', company)
  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    console.error('[tickets GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch tickets' }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapTicket), nextCursor)
}

async function applyRoutingRules(
  db: ReturnType<typeof createServiceClient>,
  company: string,
  priority: string,
  serviceType: string,
): Promise<string | null> {
  if (priority === 'Urgent' || priority === 'High') {
    const { data: leader } = await db
      .from('team_members')
      .select('name')
      .eq('unit', 'Leadership')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (leader) return leader.name
  }

  const { data: rep } = await db
    .from('deals')
    .select('assigned_rep')
    .eq('company', company)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (rep?.assigned_rep) return rep.assigned_rep

  const unitMap: Record<string, string> = {
    'SEO': 'Delivery/Operations',
    'Web Design': 'Delivery/Operations',
    'Social Media': 'Delivery/Operations',
    'PPC': 'Delivery/Operations',
    'Billing': 'Billing/Finance',
    'General': 'Sales',
  }
  const unit = unitMap[serviceType]
  if (unit) {
    const { data: member } = await db
      .from('team_members')
      .select('name')
      .eq('unit', unit)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (member) return member.name
  }

  return null
}

export async function POST(req: NextRequest) {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const result = validate(body, {
    subject: { required: true, type: 'string', maxLength: 500 },
    company: { required: true, type: 'string', maxLength: 200 },
    status: { type: 'string', enum: [...TICKET_STATUSES] },
    priority: { type: 'string', enum: [...TASK_PRIORITIES] },
  })
  if (!result.valid) return validationError(result.error)
  const today = new Date().toISOString().split('T')[0]
  const db = createServiceClient()

  let assignedTo = body.assignedTo ?? null
  if (!assignedTo) {
    assignedTo = await applyRoutingRules(
      db,
      body.company ?? '',
      body.priority ?? 'Medium',
      body.serviceType ?? 'General',
    )
  }

  const { data, error } = await db
    .from('tickets')
    .insert({
      id:            `tkt-${Date.now()}`,
      subject:       body.subject,
      company:       body.company ?? '',
      company_id:    body.companyId ?? null,
      contact_name:  body.contactName ?? null,
      contact_email: body.contactEmail ?? null,
      status:        body.status ?? 'Open',
      priority:      body.priority ?? 'Medium',
      source:        body.source ?? 'Email',
      service_type:  body.serviceType ?? 'General',
      project_id:    body.projectId ?? null,
      assigned_to:   assignedTo,
      tags:          body.tags ?? [],
      messages:      body.messages ?? [],
      created_date:  today,
      updated_date:  today,
    })
    .select()
    .single()
  if (error) {
    console.error('[tickets POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create ticket' }, { status: 500 })
  }
  return NextResponse.json(mapTicket(data), { status: 201 })
}
