import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { DELIVERY_STEP_NAMES, DELIVERY_STEP_COLUMNS } from '@/lib/delivery-steps'
import { requireRole } from '@/lib/rbac'
import { mapWorkflow } from '../../route'

const STEP_STATUSES = ['Pending', 'In Progress', 'Completed', 'Skipped']

// Shared with lib/delivery-sync.ts, which writes the same columns from
// Contracts / Finance / Portal events — two copies of this map would drift
// the first time a column is renamed.
const STEP_COLUMNS = DELIVERY_STEP_COLUMNS

const META_KEY_MAP: Record<string, string> = {
  contractId: 'step_01_contract_id',
  completedAt: 'completed_at',
  invoiceId: 'step_02_invoice_id',
  emailSentAt: 'email_sent_at',
  openedAt: 'opened_at',
  firstLogin: 'step_04_first_login',
  bookingId: 'step_05_booking_id',
  notes: 'step_05_notes',
  deliverables: 'step_07_deliverables',
  lastSentAt: 'step_08_last_sent_at',
  sendDay: 'step_08_send_day',
}

function resolveMetaColumn(step: number, camelKey: string): string | null {
  const mapped = META_KEY_MAP[camelKey]
  if (!mapped) return null
  const stepDef = STEP_COLUMNS[step]
  if (!stepDef) return null
  const prefix = `step_0${step}_`
  if (mapped.startsWith('step_')) {
    return stepDef.meta.includes(mapped) ? mapped : null
  }
  const col = prefix + mapped
  return stepDef.meta.includes(col) ? col : null
}

export const PATCH = withErrorHandler('delivery/workflow/[id]/step PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing workflow id' }, { status: 400 })

  const body = await req.json()
  const result = validate(body, {
    step: { required: true, type: 'number', min: 1, max: DELIVERY_STEP_NAMES.length },
    status: { required: true, type: 'string', enum: STEP_STATUSES },
  })
  if (!result.valid) return validationError(result.error)

  const step = body.step as number
  const status = body.status as string
  const stepDef = STEP_COLUMNS[step]
  if (!stepDef) return NextResponse.json({ error: 'Invalid step' }, { status: 400 })

  const update: Record<string, unknown> = {
    [stepDef.status]: status,
    updated_at: new Date().toISOString(),
  }

  for (const [key, value] of Object.entries(body)) {
    if (key === 'step' || key === 'status') continue
    const col = resolveMetaColumn(step, key)
    if (col) update[col] = value
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('delivery_workflows')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update workflow step')
  }

  await db.from('delivery_events').insert({
    id: crypto.randomUUID(),
    workflow_id: id,
    company_id: data.company_id,
    step,
    event_type: 'step_updated',
    description: `Step ${step} set to ${status}`,
    metadata: body,
  })

  // AUDIT #645 — this used to return the raw DB row instead of routing
  // through the sibling list route's mapWorkflow(), the same shape-mismatch
  // class #8 already fixed once.
  return NextResponse.json(mapWorkflow(data))
})
