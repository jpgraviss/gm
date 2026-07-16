import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { requireAdmin } from '@/lib/admin-auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapClient(row: any) {
  return {
    id:           row.id,
    company:      row.company,
    service:      row.service,
    access:       row.access,
    lastLogin:    row.last_login,
    contact:      row.contact,
    email:        row.email,
    role:         row.portal_role ?? 'Viewer',
    portalConfig: row.portal_config ?? {},
    services:     row.services ?? [],
    companyId:    row.company_id ?? null,
  }
}

export const GET = withErrorHandler('portal-clients GET', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const db = createServiceClient()
  const companyFilter = req.nextUrl.searchParams.get('company')
  const pendingFilter = req.nextUrl.searchParams.get('pending_approval')

  let query = db
    .from('portal_clients')
    .select('*')
    .order('created_at', { ascending: true })

  if (companyFilter) {
    query = query.eq('company', companyFilter)
  }

  if (pendingFilter === 'true') {
    query = query.eq('pending_approval', true)
    const { data, error } = await query
    if (error) {
      throw new Error(error?.message || 'Failed to fetch pending portal clients')
    }
    return NextResponse.json(
      (data ?? []).map(row => ({
        id: row.id,
        contact: row.contact,
        email: row.email,
        company: row.company,
        created_at: row.created_at,
      }))
    )
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch portal clients')
  }
  return NextResponse.json((data ?? []).map(mapClient))
})

export const POST = withErrorHandler('portal-clients POST', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const result = validate(body, {
    company: { required: true, type: 'string', maxLength: 200 },
    email:   { required: false, type: 'string', pattern: EMAIL_PATTERN },
    contact: { required: false, type: 'string', maxLength: 200 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  const tempPassword = crypto.randomBytes(16).toString('base64url')
  if (body.email) {
    const { error: authError } = await db.auth.admin.createUser({
      email: body.email as string,
      password: tempPassword,
      email_confirm: true,
    })
    if (authError && !authError.message.includes('already')) {
      throw new Error(authError?.message || 'Failed to create client auth account')
    }
  }

  // If company already has portal users, inherit their portal_config
  let portalConfig = body.portalConfig ?? null
  if (!portalConfig) {
    const { data: existing } = await db
      .from('portal_clients')
      .select('portal_config')
      .eq('company', body.company as string)
      .not('portal_config', 'is', null)
      .limit(1)
    if (existing && existing.length > 0) {
      portalConfig = existing[0].portal_config
    }
  }

  const { data, error } = await db
    .from('portal_clients')
    .insert({
      id:            body.id ?? `pc-${Date.now()}`,
      company:       body.company,
      service:       body.service ?? '',
      access:        body.access ?? 'Not Setup',
      last_login:    body.lastLogin ?? 'Never',
      contact:       body.contact ?? '',
      email:         body.email ?? '',
      portal_role:   body.role ?? 'Viewer',
      portal_config: portalConfig,
      services:      body.services ?? [],
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create portal client')
  }
  logAudit({ userName: 'admin', action: 'created_portal_client', module: 'portal', type: 'action', metadata: { email: body.email, company: body.company } })
  return NextResponse.json({ ...mapClient(data), tempPassword }, { status: 201 })
})

// DELETE /api/portal-clients?company=... — delete all portal clients for a company
export const DELETE = withErrorHandler('portal-clients DELETE', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const company = req.nextUrl.searchParams.get('company')
  if (!company) {
    return NextResponse.json({ error: 'company query parameter is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: deleted, error } = await db
    .from('portal_clients')
    .delete()
    .eq('company', company)
    .select('id, email')

  if (error) {
    throw new Error(error?.message || 'Failed to delete portal')
  }

  logAudit({ userName: 'admin', action: 'deleted_portal_company', module: 'portal', type: 'action', metadata: { company, deletedCount: deleted?.length ?? 0 } })
  return NextResponse.json({ deleted: deleted?.length ?? 0, company })
})
