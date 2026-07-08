import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'
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
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('team-members/[id] DELETE', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const denied = await requireRole(req, 'Super Admin')
  if (denied) return denied
  const db = createServiceClient()
  const { error } = await db.from('team_members').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete team member')
  }
  logAudit({ userName: 'system', action: 'deleted_team_member', module: 'admin', type: 'warning', metadata: { memberId: id } })
  return NextResponse.json({ deleted: id })
})
