import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDeal(row: any) {
  return {
    id:           row.id,
    company:      row.company,
    contact:      row.contact ?? { id: '', name: '', email: '', phone: '', title: '' },
    stage:        row.stage,
    value:        row.value,
    serviceType:  row.service_type,
    closeDate:    row.close_date ?? '',
    assignedRep:  row.assigned_rep,
    probability:  row.probability,
    notes:        row.notes ?? [],
    lastActivity: row.last_activity ?? '',
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')
  const db = createServiceClient()
  let query = db.from('deals').select('*').order('created_at', { ascending: false })
  if (stage) query = query.eq('stage', stage)
  const { data, error } = await query
  if (error) {
    console.error('[deals GET]', error)
    return NextResponse.json({ error: 'Failed to fetch deals' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapDeal))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from('deals')
    .insert({
      id:           `deal-${Date.now()}`,
      company:      body.company,
      contact:      body.contact ?? null,
      stage:        body.stage ?? 'Lead',
      value:        body.value ?? 0,
      service_type: body.serviceType ?? 'General',
      close_date:   body.closeDate ?? null,
      assigned_rep: body.assignedRep ?? '',
      probability:  body.probability ?? 0,
      notes:        body.notes ?? [],
      last_activity: new Date().toISOString().split('T')[0],
    })
    .select()
    .single()
  if (error) {
    console.error('[deals POST]', error)
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }
  return NextResponse.json(mapDeal(data), { status: 201 })
}
