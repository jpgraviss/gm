import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'

export const POST = withErrorHandler('delivery/add-deliverable POST', async (req) => {
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
    if (fetchErr.code === 'PGRST116') {
      return NextResponse.json({ error: fetchErr.message }, { status: 404 })
    }
    throw new Error(fetchErr.message)
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
    throw new Error(error.message)
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
})
