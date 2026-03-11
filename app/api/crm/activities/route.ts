import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivity(row: any) {
  return {
    id:          row.id,
    type:        row.type,
    title:       row.title,
    body:        row.body ?? undefined,
    companyId:   row.company_id ?? undefined,
    companyName: row.company_name ?? undefined,
    contactId:   row.contact_id ?? undefined,
    contactName: row.contact_name ?? undefined,
    dealId:      row.deal_id ?? undefined,
    user:        row.user_name,
    timestamp:   row.timestamp,
    duration:    row.duration ?? undefined,
    outcome:     row.outcome ?? undefined,
    nextStep:    row.next_step ?? undefined,
    pinned:      row.pinned ?? false,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')
  const contactId = searchParams.get('contactId')
  const db = createServiceClient()
  let query = db.from('crm_activities').select('*').order('timestamp', { ascending: false })
  if (companyId) query = query.eq('company_id', companyId)
  if (contactId) query = query.eq('contact_id', contactId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(mapActivity))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from('crm_activities')
    .insert({
      id:           `act-${Date.now()}`,
      type:         body.type,
      title:        body.title,
      body:         body.body ?? null,
      company_id:   body.companyId ?? null,
      company_name: body.companyName ?? null,
      contact_id:   body.contactId ?? null,
      contact_name: body.contactName ?? null,
      deal_id:      body.dealId ?? null,
      user_name:    body.user ?? '',
      timestamp:    body.timestamp ?? new Date().toISOString(),
      duration:     body.duration ?? null,
      outcome:      body.outcome ?? null,
      next_step:    body.nextStep ?? null,
      pinned:       body.pinned ?? false,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapActivity(data), { status: 201 })
}
