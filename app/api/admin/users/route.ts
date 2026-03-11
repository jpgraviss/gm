import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(mapUser))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const initials = body.initials ?? body.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  // Create Supabase Auth user with temporary password
  const tempPassword = body.tempPassword ?? Math.random().toString(36).slice(-10)
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: body.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: body.name, role: body.role, unit: body.unit },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...mapUser(data), tempPassword }, { status: 201 })
}
