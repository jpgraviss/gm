import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { validate, validationError, INVOICE_STATUSES } from '@/lib/validation'

// PATCH is used by QuickBooks sync to update invoice status/payment data
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return validationError('Request body must be a JSON object')
  }

  const result = validate(body, {
    status:   { type: 'string', enum: [...INVOICE_STATUSES] },
    amount:   { type: 'number', min: 0 },
    paidDate: { type: 'string', maxLength: 30 },
    dueDate:  { type: 'string', maxLength: 30 },
  })

  if (!result.valid) {
    return validationError(result.error)
  }

  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.status !== undefined)   update.status = body.status
  if (body.amount !== undefined)   update.amount = body.amount
  if (body.dueDate !== undefined)  update.due_date = body.dueDate
  if (body.paidDate !== undefined) update.paid_date = body.paidDate

  if (Object.keys(update).length === 0) {
    return validationError('No valid fields to update')
  }

  const { data, error } = await db.from('invoices').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[invoices/:id PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update invoice' }, { status: 500 })
  }

  if (body.status === 'Paid') {
    fireAutomations('invoice_paid', { invoiceId: id, ...data })
  } else if (body.status === 'Overdue') {
    fireAutomations('invoice_overdue', { invoiceId: id, ...data })
  }

  return NextResponse.json(data)
}
