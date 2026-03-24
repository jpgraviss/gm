import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMember(row: any) {
  return {
    id:        row.id,
    name:      row.name,
    email:     row.email,
    role:      row.role,
    unit:      row.unit ?? 'Delivery/Operations',
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
    console.error('[team-members GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch team members' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapMember))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const initials = body.initials ?? body.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const { data, error } = await db
    .from('team_members')
    .insert({
      id:       `tm-${Date.now()}`,
      name:     body.name,
      email:    body.email,
      role:     body.role ?? 'Team Member',
      unit:     body.unit ?? 'Leadership/Admin',
      initials: initials,
      status:   body.status ?? 'Active',
      is_admin: body.isAdmin ?? false,
    })
    .select()
    .single()
  if (error) {
    console.error('[team-members POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create team member' }, { status: 500 })
  }
  return NextResponse.json(mapMember(data), { status: 201 })
}
