import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { validate, validationError, CONTRACT_STATUSES } from '@/lib/validation'

// Valid status transitions — keys are current status, values are allowed next statuses
const VALID_TRANSITIONS: Record<string, string[]> = {
  'Draft':              ['Sent', 'Expired'],
  'Sent':               ['Viewed', 'Signed by Client', 'Expired'],
  'Viewed':             ['Signed by Client', 'Expired'],
  'Signed by Client':   ['Countersign Needed', 'Fully Executed', 'Expired'],
  'Countersign Needed': ['Fully Executed', 'Expired'],
  'Fully Executed':     ['Expired'],
  'Expired':            ['Draft'],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContract(row: any) {
  return {
    id:               row.id,
    proposalId:       row.proposal_id ?? undefined,
    company:          row.company,
    status:           row.status,
    value:            row.value,
    billingStructure: row.billing_structure,
    startDate:        row.start_date ?? '',
    duration:         row.duration,
    renewalDate:      row.renewal_date ?? '',
    assignedRep:      row.assigned_rep,
    serviceType:      row.service_type,
    clientSigned:     row.client_signed ?? undefined,
    internalSigned:   row.internal_signed ?? undefined,
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid contract id' }, { status: 400 })
  }

  const body = await req.json()

  // Validate input fields
  const result = validate(body, {
    status:           { type: 'string', enum: [...CONTRACT_STATUSES] },
    value:            { type: 'number', min: 0, max: 100_000_000 },
    assignedRep:      { type: 'string', maxLength: 200 },
    billingStructure: { type: 'string', enum: ['Monthly', 'Quarterly', 'Annual', 'One-time', 'Custom'] },
    clientSigned:     { type: 'string', maxLength: 30 },
    internalSigned:   { type: 'string', maxLength: 30 },
    renewalDate:      { type: 'string', maxLength: 30 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  // If status is being changed, validate the transition
  if (body.status !== undefined) {
    const { data: current, error: fetchErr } = await db
      .from('contracts')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchErr || !current) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const allowed = VALID_TRANSITIONS[current.status]
    if (!allowed || !allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status transition: ${current.status} → ${body.status}` },
        { status: 400 }
      )
    }
  }

  const update: Record<string, unknown> = {}
  if (body.status !== undefined)            update.status = body.status
  if (body.value !== undefined)             update.value = body.value
  if (body.clientSigned !== undefined)      update.client_signed = body.clientSigned
  if (body.internalSigned !== undefined)    update.internal_signed = body.internalSigned
  if (body.assignedRep !== undefined)       update.assigned_rep = body.assignedRep
  if (body.billingStructure !== undefined)  update.billing_structure = body.billingStructure
  if (body.renewalDate !== undefined)       update.renewal_date = body.renewalDate

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await db.from('contracts').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[contracts/:id PATCH]', error)
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error?.message || 'Failed to update contract' }, { status: 500 })
  }

  if (body.status === 'Fully Executed') {
    fireAutomations('contract_executed', { contractId: id, ...data })
  } else if (body.status === 'Sent') {
    fireAutomations('contract_sent', { contractId: id, ...data })
  }

  return NextResponse.json(mapContract(data))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid contract id' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db.from('contracts').delete().eq('id', id)
  if (error) {
    console.error('[contracts/:id DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete contract' }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
