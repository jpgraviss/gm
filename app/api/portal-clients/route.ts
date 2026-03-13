import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

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
  if (error) {
    console.error('[portal-clients GET]', error)
    return NextResponse.json({ error: 'Failed to fetch portal clients' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapClient))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()

  // Generate a cryptographically secure temp password for client login
  const tempPassword = crypto.randomBytes(16).toString('base64url')
  if (body.email) {
    const { error: authError } = await db.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true,
    })
    // If user already exists in auth (e.g. re-adding), ignore the conflict error
    if (authError && !authError.message.includes('already')) {
      console.error('[portal-clients POST] auth error:', authError)
      return NextResponse.json({ error: 'Failed to create client auth account' }, { status: 500 })
    }
  }

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
  if (error) {
    console.error('[portal-clients POST]', error)
    return NextResponse.json({ error: 'Failed to create portal client' }, { status: 500 })
  }
  logAudit({ userName: 'admin', action: 'created_portal_client', module: 'portal', type: 'action', metadata: { email: body.email, company: body.company } })
  return NextResponse.json({ ...mapClient(data), tempPassword }, { status: 201 })
}
