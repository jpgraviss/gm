import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { validate, validationError, INVOICE_STATUSES } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

// PATCH updates invoice status/payment data
export const PATCH = withErrorHandler('invoices/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const actor = await getAuthUser(req)

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
  if (body.paidDate !== undefined)  update.paid_date = body.paidDate
  if (body.companyId !== undefined) update.company_id = body.companyId

  if (Object.keys(update).length === 0) {
    return validationError('No valid fields to update')
  }

  // AUDIT — status/amount edits on recognized-revenue records previously
  // left zero trace of who changed what from what value, unlike the
  // sibling contracts route (logAudit on every status change). Read the
  // pre-update row so the log entry can show the real before/after, not
  // just the new value.
  const { data: before } = await db.from('invoices').select('status, amount').eq('id', id).single()

  const { data, error } = await db.from('invoices').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update invoice')
  }

  if (body.status !== undefined || body.amount !== undefined) {
    logAudit({
      userName: actor?.name || actor?.email || 'system',
      action: 'invoice_updated',
      module: 'billing',
      type: 'action',
      metadata: {
        invoiceId: id,
        ...(body.status !== undefined ? { statusFrom: before?.status, statusTo: body.status } : {}),
        ...(body.amount !== undefined ? { amountFrom: before?.amount, amountTo: body.amount } : {}),
      },
    })
  }

  if (body.status === 'Paid') {
    fireAutomations('invoice_paid', { invoiceId: id, ...data })
  } else if (body.status === 'Overdue') {
    fireAutomations('invoice_overdue', { invoiceId: id, ...data })
  }

  return NextResponse.json(data)
})
