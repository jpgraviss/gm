import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'

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
    return NextResponse.json({ error: error?.message || 'Failed to fetch portal clients' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapClient))
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const result = validate(body, {
    company: { required: true, type: 'string', maxLength: 200 },
    email:   { required: true, type: 'string', pattern: EMAIL_PATTERN },
    contact: { required: true, type: 'string', maxLength: 200 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  // Generate a cryptographically secure temp password for client login
  const tempPassword = crypto.randomBytes(16).toString('base64url')
  if (body.email) {
    const { error: authError } = await db.auth.admin.createUser({
      email: body.email as string,
      password: tempPassword,
      email_confirm: true,
    })
    // If user already exists in auth (e.g. re-adding), ignore the conflict error
    if (authError && !authError.message.includes('already')) {
      console.error('[portal-clients POST] auth error:', authError)
      return NextResponse.json({ error: authError?.message || 'Failed to create client auth account' }, { status: 500 })
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
    return NextResponse.json({ error: error?.message || 'Failed to create portal client' }, { status: 500 })
  }
  logAudit({ userName: 'admin', action: 'created_portal_client', module: 'portal', type: 'action', metadata: { email: body.email, company: body.company } })
  return NextResponse.json({ ...mapClient(data), tempPassword }, { status: 201 })
}
