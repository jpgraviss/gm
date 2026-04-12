import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { logAudit } from '@/lib/audit'

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.stage !== undefined)       update.stage = body.stage
  if (body.value !== undefined)       update.value = body.value
  if (body.probability !== undefined) update.probability = body.probability
  if (body.assignedRep !== undefined) update.assigned_rep = body.assignedRep
  if (body.closeDate !== undefined)   update.close_date = body.closeDate
  if (body.notes !== undefined)       update.notes = body.notes
  if (body.contact !== undefined)     update.contact = body.contact
  if (body.serviceType !== undefined) update.service_type = body.serviceType
  update.last_activity = new Date().toISOString().split('T')[0]
  const { data, error } = await db.from('deals').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[deals/:id PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update deal' }, { status: 500 })
  }

  if (body.stage !== undefined) {
    fireAutomations('deal_stage_changed', { dealId: id, stage: body.stage, ...data })
  }

  return NextResponse.json(mapDeal(data))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('deals').delete().eq('id', id)
  if (error) {
    console.error('[deals/:id DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete deal' }, { status: 500 })
  }
  logAudit({ userName: 'system', action: 'deleted_deal', module: 'crm', type: 'warning', metadata: { dealId: id } })
  return NextResponse.json({ deleted: id })
}
