import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTicket(row: any) {
  return {
    id:            row.id,
    subject:       row.subject,
    company:       row.company,
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
  const db = createServiceClient()
  let query = db.from('tickets').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(mapTicket))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const today = new Date().toISOString().split('T')[0]
  const db = createServiceClient()
  const { data, error } = await db
    .from('tickets')
    .insert({
      id:            `tkt-${Date.now()}`,
      subject:       body.subject,
      company:       body.company ?? '',
      contact_name:  body.contactName ?? null,
      contact_email: body.contactEmail ?? null,
      status:        body.status ?? 'Open',
      priority:      body.priority ?? 'Medium',
      source:        body.source ?? 'Email',
      service_type:  body.serviceType ?? 'General',
      project_id:    body.projectId ?? null,
      assigned_to:   body.assignedTo ?? null,
      tags:          body.tags ?? [],
      messages:      body.messages ?? [],
      created_date:  today,
      updated_date:  today,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapTicket(data), { status: 201 })
}
