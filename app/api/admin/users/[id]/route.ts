import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const db = createServiceClient()

  // Try to get token from cookie or header
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  // Get user from Supabase
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if admin
  const { data: member } = await db
    .from('team_members')
    .select('is_admin')
    .eq('email', user.email)
    .single()

  if (!member?.is_admin) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  return null // Authorized
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const { id } = await params
  const body = await req.json()
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
