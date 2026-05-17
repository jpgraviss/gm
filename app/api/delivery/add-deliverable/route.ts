import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = validate(body, {
    workflowId: { required: true, type: 'string', maxLength: 100 },
    name: { required: true, type: 'string', maxLength: 200 },
    type: { required: true, type: 'string', maxLength: 100 },
    fileUrl: { type: 'string', maxLength: 2000 },
    description: { type: 'string', maxLength: 1000 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  const { data: workflow, error: fetchErr } = await db
    .from('delivery_workflows')
    .select('step_07_deliverables, company_id')
    .eq('id', body.workflowId)
    .single()

  if (fetchErr) {
    console.error('[delivery/add-deliverable POST]', fetchErr)
    const status = fetchErr.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: fetchErr.message }, { status })
  }

  const existing = (workflow.step_07_deliverables ?? []) as Record<string, unknown>[]
  const deliverable = {
    id: crypto.randomUUID(),
    name: body.name,
    type: body.type,
    fileUrl: body.fileUrl ?? null,
    description: body.description ?? null,
    addedAt: new Date().toISOString(),
  }
  const updated = [...existing, deliverable]

  const { data, error } = await db
    .from('delivery_workflows')
    .update({
      step_07_deliverables: updated,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.workflowId)
    .select()
    .single()

  if (error) {
    console.error('[delivery/add-deliverable POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await db.from('delivery_events').insert({
    id: crypto.randomUUID(),
    workflow_id: body.workflowId,
    company_id: workflow.company_id,
    step: 7,
    event_type: 'deliverable_added',
    description: `Deliverable "${body.name}" added`,
    metadata: deliverable,
  })

  return NextResponse.json(data, { status: 201 })
}
