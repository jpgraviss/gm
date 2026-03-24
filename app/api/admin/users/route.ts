import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUser(row: any) {
  return {
    id:        row.id,
    name:      row.name,
    email:     row.email,
    role:      row.role,
    unit:      row.unit,
    initials:  row.initials ?? '',
    status:    row.status ?? 'Active',
    isAdmin:   row.is_admin ?? false,
    lastLogin: row.last_login ?? null,
  }
}

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('team_members')
    .select('*')
    .order('name')
  if (error) {
    console.error('[admin/users GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch users' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapUser))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const initials = body.initials ?? body.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  // Create Supabase Auth user with a random password (users sign in via magic link)
  const randomPassword = crypto.randomBytes(32).toString('base64url')
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: body.email,
    password: randomPassword,
    email_confirm: true,
    user_metadata: { name: body.name, role: body.role, unit: body.unit },
  })
  if (authError) {
    console.error('[admin/users POST] auth error:', authError)
    return NextResponse.json({ error: authError?.message || 'Failed to create auth user' }, { status: 500 })
  }

  const userId = authData.user?.id ?? `tm-${Date.now()}`

  const { data, error } = await db
    .from('team_members')
    .insert({
      id:       userId,
      name:     body.name,
      email:    body.email,
      role:     body.role ?? 'Team Member',
      unit:     body.unit ?? 'Leadership/Admin',
      initials: initials,
      status:   'Active',
      is_admin: body.isAdmin ?? false,
    })
    .select()
    .single()
  if (error) {
    console.error('[admin/users POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create team member profile' }, { status: 500 })
  }
  logAudit({ userName: 'admin', action: 'created_user', module: 'admin', type: 'action', metadata: { email: body.email, role: body.role } })
  return NextResponse.json(mapUser(data), { status: 201 })
}
