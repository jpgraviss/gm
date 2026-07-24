import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { requireAdmin } from '@/lib/admin-auth'
import { getAuthUser } from '@/lib/rbac'

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
  const companyIdFilter = req.nextUrl.searchParams.get('companyId')
  const pendingFilter = req.nextUrl.searchParams.get('pending_approval')

  let query = db
    .from('portal_clients')
    .select('*')
    .order('created_at', { ascending: true })

  // AUDIT #187 — company names are not DB-unique, so matching solely by
  // `company` can silently span two unrelated companies that happen to
  // share a display name. When `companyId` is supplied, use the precise,
  // collision-proof `company_id` scope. The legacy `company` name filter is
  // kept working independently (other callers may still rely on it) but is
  // narrowed to rows never linked to a real CRM company (`company_id is
  // null`) so it can no longer match a row that belongs to a specific,
  // possibly different, company.
  if (companyIdFilter) {
    query = query.eq('company_id', companyIdFilter)
  } else if (companyFilter) {
    query = query.eq('company', companyFilter).is('company_id', null)
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
  const actor = await getAuthUser(req)

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

  // If company already has portal users, inherit their portal_config.
  // AUDIT #187 — matching purely on the `company` name could inherit a
  // DIFFERENT company's branding/config when two companies share a name.
  // Prefer the precise `company_id` scope when the caller supplied one;
  // otherwise fall back to name-matching restricted to other unlinked rows
  // only, so a linked company's config is never leaked to an unrelated
  // same-named company.
  const bodyCompanyId = (body.companyId as string | undefined) ?? undefined
  let portalConfig = body.portalConfig ?? null
  if (!portalConfig) {
    let inheritQuery = db
      .from('portal_clients')
      .select('portal_config')
      .not('portal_config', 'is', null)
      .limit(1)
    inheritQuery = bodyCompanyId
      ? inheritQuery.eq('company_id', bodyCompanyId)
      : inheritQuery.eq('company', body.company as string).is('company_id', null)
    const { data: existing } = await inheritQuery
    if (existing && existing.length > 0) {
      portalConfig = existing[0].portal_config
    }
  }

  const { data, error } = await db
    .from('portal_clients')
    .insert({
      id:            body.id ?? `pc-${Date.now()}`,
      company:       body.company,
      company_id:    bodyCompanyId ?? null,
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
  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'created_portal_client', module: 'portal', type: 'action', metadata: { email: body.email, company: body.company } })
  return NextResponse.json({ ...mapClient(data), tempPassword }, { status: 201 })
})

// DELETE /api/portal-clients?company=...&companyId=... — delete all portal
// clients for a company. Prefer companyId (precise, collision-proof); the
// legacy company name match is kept for backward compatibility but is
// DESTRUCTIVE, so it is restricted to unlinked rows only — see AUDIT #187.
export const DELETE = withErrorHandler('portal-clients DELETE', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const actor = await getAuthUser(req)

  const company = req.nextUrl.searchParams.get('company')
  const companyId = req.nextUrl.searchParams.get('companyId')
  if (!company && !companyId) {
    return NextResponse.json({ error: 'company or companyId query parameter is required' }, { status: 400 })
  }

  const db = createServiceClient()
  let deleteQuery = db.from('portal_clients').delete()
  // AUDIT #187 — deleting purely by `company` name is destructive: since
  // company names are not DB-unique, two genuinely distinct companies
  // sharing a name would both be wiped out. When companyId is supplied,
  // scope the delete to that exact company. Otherwise, restrict the
  // name-match fallback to rows never linked to a real CRM company so it
  // can never delete a row belonging to a different, linked company.
  deleteQuery = companyId
    ? deleteQuery.eq('company_id', companyId)
    : deleteQuery.eq('company', company as string).is('company_id', null)

  const { data: deleted, error } = await deleteQuery.select('id, email')

  if (error) {
    throw new Error(error?.message || 'Failed to delete portal')
  }

  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'deleted_portal_company', module: 'portal', type: 'action', metadata: { company, companyId, deletedCount: deleted?.length ?? 0 } })
  return NextResponse.json({ deleted: deleted?.length ?? 0, company, companyId })
})
