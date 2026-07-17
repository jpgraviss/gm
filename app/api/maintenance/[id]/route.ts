import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(row: any) {
  return {
    id:                 row.id,
    company:            row.company,
    serviceType:        row.service_type,
    startDate:          row.start_date ?? '',
    endDate:            row.end_date ?? undefined,
    monthlyFee:         row.monthly_fee,
    contractDuration:   row.contract_duration,
    cancellationWindow: row.cancellation_window,
    cancellationFee:    row.cancellation_fee ?? undefined,
    paymentTerms:       row.payment_terms ?? undefined,
    status:             row.status,
    nextBillingDate:    row.next_billing_date ?? '',
    documents:          row.documents ?? [],
  }
}

export const PATCH = withErrorHandler('maintenance/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const body = await req.json()
  const result = validate(body, {
    company: { type: 'string', maxLength: 200 },
    monthlyFee: { type: 'number', min: 0 },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.status !== undefined)             update.status = body.status
  if (body.monthlyFee !== undefined)         update.monthly_fee = body.monthlyFee
  if (body.nextBillingDate !== undefined)    update.next_billing_date = body.nextBillingDate
  if (body.documents !== undefined)          update.documents = body.documents
  if (body.cancellationWindow !== undefined) update.cancellation_window = body.cancellationWindow
  if (body.endDate !== undefined)            update.end_date = body.endDate
  if (body.cancellationFee !== undefined)    update.cancellation_fee = body.cancellationFee
  if (body.paymentTerms !== undefined)       update.payment_terms = body.paymentTerms
  if (body.contractDuration !== undefined)   update.contract_duration = body.contractDuration
  if (body.company !== undefined)            update.company = body.company
  if (body.serviceType !== undefined)        update.service_type = body.serviceType
  if (body.startDate !== undefined)          update.start_date = body.startDate
  const { data, error } = await db.from('maintenance_records').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update maintenance record')
  }
  return NextResponse.json(mapRecord(data))
})

export const DELETE = withErrorHandler('maintenance/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('maintenance_records').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete maintenance record')
  }
  return NextResponse.json({ deleted: id })
})
