import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req)
  if (denied) return denied

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
  if (body.name !== undefined)    update.name = body.name
  if (body.email !== undefined)   update.email = body.email
  if (body.role !== undefined)    update.role = body.role
  if (body.unit !== undefined)    update.unit = body.unit
  if (body.status !== undefined)  update.status = body.status
  if (body.isAdmin !== undefined) update.is_admin = body.isAdmin
  const { data, error } = await db.from('team_members').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[admin/users/:id PUT]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update user' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  // Deactivate rather than hard delete
  const { data, error } = await db
    .from('team_members')
    .update({ status: 'Inactive' })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('[admin/users/:id DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to deactivate user' }, { status: 500 })
  }
  logAudit({ userName: 'admin', action: 'deleted_user', module: 'admin', type: 'warning', metadata: { userId: id } })
  return NextResponse.json(data)
}
