import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, RENEWAL_STATUSES } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

export const PATCH = withErrorHandler('renewals/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const body = await req.json()
  const result = validate(body, {
    company: { type: 'string', maxLength: 200 },
    renewalValue: { type: 'number', min: 0 },
    // AUDIT — status was previously accepted as any string; renewalStatusColors
    // (lib/utils.ts) has no fallback for an unknown value and every tab filter
    // checks exact equality against the 4 real statuses, so a bad value would
    // silently render unstyled and drop the row out of every tab.
    status: { type: 'string', enum: [...RENEWAL_STATUSES] },
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
  const actor = await getAuthUser(req)
  const db = createServiceClient()
  const { error } = await db.from('renewals').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete renewal')
  }
  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'deleted_renewal', module: 'renewals', type: 'warning', metadata: { renewalId: id } })
  return NextResponse.json({ deleted: id })
})
