import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const { data, error } = await db.from('renewals').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[renewals/:id PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update renewal' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('renewals').delete().eq('id', id)
  if (error) {
    console.error('[renewals/:id DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete renewal' }, { status: 500 })
  }
  logAudit({ userName: 'system', action: 'deleted_renewal', module: 'renewals', type: 'warning', metadata: { renewalId: id } })
  return NextResponse.json({ deleted: id })
}
