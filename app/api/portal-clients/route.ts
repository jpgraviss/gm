import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapClient(row: any) {
  return {
    id:        row.id,
    company:   row.company,
    service:   row.service,
    access:    row.access,
    lastLogin: row.last_login,
    contact:   row.contact,
    email:     row.email,
  }
}

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('portal_clients')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(mapClient))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from('portal_clients')
    .insert({
      id:         body.id ?? `pc-${Date.now()}`,
      company:    body.company,
      service:    body.service ?? '',
      access:     body.access ?? 'Not Setup',
      last_login: body.lastLogin ?? 'Never',
      contact:    body.contact ?? '',
      email:      body.email ?? '',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapClient(data), { status: 201 })
}
