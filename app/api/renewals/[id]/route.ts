import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

export const PATCH = withErrorHandler('renewals/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const body = await req.json()
  const result = validate(body, {
    company: { type: 'string', maxLength: 200 },
    renewalValue: { type: 'number', min: 0 },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.status !== undefined)          update.status = body.status
  if (body.renewalValue !== undefined)    update.renewal_value = body.renewalValue
  if (body.expirationDate !== undefined)  update.expiration_date = body.expirationDate
  if (body.daysUntilExpiry !== undefined) update.days_until_expiry = body.daysUntilExpiry
  if (body.assignedRep !== undefined)     update.assigned_rep = body.assignedRep
  if (body.proposalData !== undefined)   update.proposal_data = body.proposalData
  if (body.companyId !== undefined)     update.company_id = body.companyId
  if (body.company !== undefined)       update.company = body.company
  const { data, error } = await db.from('renewals').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update renewal')
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('renewals/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const db = createServiceClient()
  const { error } = await db.from('renewals').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete renewal')
  }
  logAudit({ userName: 'system', action: 'deleted_renewal', module: 'renewals', type: 'warning', metadata: { renewalId: id } })
  return NextResponse.json({ deleted: id })
})
