import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

export const PUT = withErrorHandler('team-members/[id] PUT', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const denied = await requireRole(req, 'Super Admin')
  if (denied) return denied
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const result = validate(body, {
    name:  { type: 'string', maxLength: 200 },
    email: { type: 'string', pattern: EMAIL_PATTERN },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.name !== undefined)     update.name = body.name
  if (body.email !== undefined)    update.email = body.email
  if (body.role !== undefined)     update.role = body.role
  if (body.unit !== undefined)     update.unit = body.unit
  if (body.status !== undefined)   update.status = body.status
  if (body.isAdmin !== undefined)  update.is_admin = body.isAdmin
  if (body.initials !== undefined) update.initials = body.initials
  if (body.emailSignature !== undefined) update.email_signature = body.emailSignature
  const { data, error } = await db.from('team_members').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update team member')
  }

  // AUDIT.md #178 — role/is_admin promotions on existing members went
  // through this route with zero audit trail, unlike POST/PATCH which
  // already log. This is the actual "promote to Super Admin" path.
  const actor = await getAuthUser(req)
  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action:   'team_member_updated',
    module:   'team',
    type:     (body.role !== undefined || body.isAdmin !== undefined) ? 'warning' : 'action',
    metadata: { targetId: id, targetEmail: data.email, changes: Object.keys(update) },
  })

  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('team-members/[id] DELETE', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const denied = await requireRole(req, 'Super Admin')
  if (denied) return denied
  const actor = await getAuthUser(req)
  const db = createServiceClient()
  const { error } = await db.from('team_members').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete team member')
  }
  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'deleted_team_member', module: 'admin', type: 'warning', metadata: { memberId: id } })
  return NextResponse.json({ deleted: id })
})
