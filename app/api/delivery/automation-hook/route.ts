import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'

const EVENT_TYPES = ['contract_signed', 'invoice_paid', 'project_launched', 'month_end']

const EVENT_STEP_MAP: Record<string, { step: number; statusCol: string; completedCol?: string; nextStep?: { col: string; value: string } }> = {
  contract_signed: {
    step: 1,
    statusCol: 'step_01_agreement',
    completedCol: 'step_01_completed_at',
    nextStep: { col: 'step_02_invoice', value: 'In Progress' },
  },
  invoice_paid: {
    step: 2,
    statusCol: 'step_02_invoice',
    completedCol: 'step_02_completed_at',
    nextStep: { col: 'step_03_welcome', value: 'In Progress' },
  },
  project_launched: {
    step: 7,
    statusCol: 'step_07_fulfillment',
    completedCol: 'step_07_completed_at',
    nextStep: { col: 'step_08_monthly_report', value: 'In Progress' },
  },
  month_end: {
    step: 8,
    statusCol: 'step_08_monthly_report',
  },
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = validate(body, {
    workflowId: { required: true, type: 'string', maxLength: 100 },
    event: { required: true, type: 'string', enum: EVENT_TYPES },
  })
  if (!result.valid) return validationError(result.error)

  const mapping = EVENT_STEP_MAP[body.event]
  if (!mapping) return NextResponse.json({ error: 'Unknown event' }, { status: 400 })

  const db = createServiceClient()

  const { data: workflow, error: fetchErr } = await db
    .from('delivery_workflows')
    .select('id, company_id')
    .eq('id', body.workflowId)
    .single()

  if (fetchErr) {
    console.error('[delivery/automation-hook POST]', fetchErr)
    const status = fetchErr.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: fetchErr.message }, { status })
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {
    [mapping.statusCol]: 'Completed',
    updated_at: now,
  }
  if (mapping.completedCol) update[mapping.completedCol] = now
  if (mapping.nextStep) update[mapping.nextStep.col] = mapping.nextStep.value

  if (body.event === 'month_end') {
    update[mapping.statusCol] = 'Completed'
    update.step_08_last_sent_at = now
  }

  const { data, error } = await db
    .from('delivery_workflows')
    .update(update)
    .eq('id', body.workflowId)
    .select()
    .single()

  if (error) {
    console.error('[delivery/automation-hook POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await db.from('delivery_events').insert({
    id: crypto.randomUUID(),
    workflow_id: workflow.id,
    company_id: workflow.company_id,
    step: mapping.step,
    event_type: body.event,
    description: `Automation: ${body.event} processed`,
    metadata: body.metadata ?? null,
  })

  return NextResponse.json(data)
}
