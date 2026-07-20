import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser } from '@/lib/rbac'

export const PUT = withErrorHandler('admin/users/[id] PUT', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const result = validate(body, {
    name:  { type: 'string', maxLength: 200 },
    email: { type: 'string', pattern: EMAIL_PATTERN },
    role:  { type: 'string' },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.name !== undefined)            update.name = body.name
  if (body.email !== undefined)           update.email = body.email
  if (body.role !== undefined)            update.role = body.role
  if (body.unit !== undefined)            update.unit = body.unit
  if (body.status !== undefined)          update.status = body.status
  if (body.isAdmin !== undefined)         update.is_admin = body.isAdmin
  if (body.suspendedAt !== undefined)     update.suspended_at = body.suspendedAt
  if (body.suspendedUntil !== undefined)  update.suspended_until = body.suspendedUntil
  if (body.suspendedReason !== undefined) update.suspended_reason = body.suspendedReason
  if (body.accessSchedule !== undefined)  update.access_schedule = body.accessSchedule
  if (body.deletedAt !== undefined)       update.deleted_at = body.deletedAt
  const { data, error } = await db.from('team_members').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update user')
  }
  logAudit({ userName: actor?.name || actor?.email || 'system', action: `updated_user_${body.status ?? 'info'}`, module: 'admin', type: 'action', metadata: { userId: id } })
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('admin/users/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('team_members')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to deactivate user')
  }
  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'deleted_user', module: 'admin', type: 'warning', metadata: { userId: id } })
  return NextResponse.json(data)
})
