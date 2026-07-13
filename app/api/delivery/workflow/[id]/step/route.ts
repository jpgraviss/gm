import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { DELIVERY_STEP_NAMES } from '@/lib/delivery-steps'

const STEP_STATUSES = ['Pending', 'In Progress', 'Completed', 'Skipped']

const STEP_COLUMNS: Record<number, { status: string; meta: string[] }> = {
  1: { status: 'step_01_agreement', meta: ['step_01_contract_id', 'step_01_completed_at'] },
  2: { status: 'step_02_invoice', meta: ['step_02_invoice_id', 'step_02_completed_at'] },
  3: { status: 'step_03_welcome', meta: ['step_03_email_sent_at', 'step_03_opened_at'] },
  4: { status: 'step_04_portal', meta: ['step_04_first_login'] },
  5: { status: 'step_05_strategy_call', meta: ['step_05_booking_id', 'step_05_completed_at', 'step_05_notes'] },
  6: { status: 'step_06_usage_guide', meta: ['step_06_email_sent_at', 'step_06_opened_at'] },
  7: { status: 'step_07_fulfillment', meta: ['step_07_deliverables', 'step_07_completed_at'] },
  8: { status: 'step_08_monthly_report', meta: ['step_08_last_sent_at', 'step_08_send_day'] },
}

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

  return NextResponse.json(data)
})
