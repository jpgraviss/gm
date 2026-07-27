import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthenticatedEmail, requireAdmin } from '@/lib/admin-auth'

// Fields a portal client is allowed to set on their OWN record without
// staff privileges — matches the one legitimate self-service call site
// (contexts/AuthContext.tsx marks itself Active + stamps lastLogin on
// session restore). Anything else — company, companyId, access beyond
// "Active", portalRole, email, services — must go through staff, otherwise
// a client could self-escalate or hop into another company's portal scope.
const SELF_SERVICE_FIELDS = new Set(['lastLogin', 'access'])

export const PATCH = withErrorHandler('portal-clients/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()

  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // getAuthenticatedEmail() only verifies the caller HOLDS a valid session
  // — it never checks status, so existence alone would let a suspended
  // employee's still-valid session (suspending someone doesn't revoke it)
  // retain full staff-level write access to any portal client record,
  // not just the restricted self-service field set below.
  const { data: staffRow } = await db.from('team_members').select('id, status').ilike('email', email).maybeSingle()
  const isStaff = !!staffRow && staffRow.status === 'active'

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  if (!isStaff) {
    const { data: ownRow } = await db.from('portal_clients').select('id, email, access').eq('id', id).maybeSingle()
    if (!ownRow || ownRow.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    // AUDIT.md #204 — `access` was in SELF_SERVICE_FIELDS with no
    // value-level check, only a field-name check — a client whose access
    // is currently 'Disabled' could self-PATCH it back to 'Active' (exactly
    // what AuthContext's session-restore touch sends unconditionally on
    // every page reload), silently reinstating themselves after an admin
    // disabled the account. A disabled client's self-service touch is now
    // rejected outright, not just filtered by field name.
    if (ownRow.access === 'Disabled') {
      return NextResponse.json({ error: 'Portal access disabled' }, { status: 403 })
    }
    const disallowed = Object.keys(body).filter(k => !SELF_SERVICE_FIELDS.has(k))
    if (disallowed.length > 0) {
      return NextResponse.json({ error: `Cannot self-update: ${disallowed.join(', ')}` }, { status: 403 })
    }
  } else {
    // AUDIT #235 — any active staff member (no role-tier floor) could
    // reassign a portal client's company/portal_role/services, inconsistent
    // with this page's sibling actions (invite, company-config, list GET),
    // which all correctly require requireAdmin.
    const denied = await requireAdmin(req)
    if (denied) return denied
  }

  const result = validate(body, {
    company: { type: 'string', maxLength: 200 },
    email:   { type: 'string', pattern: EMAIL_PATTERN },
    contact: { type: 'string', maxLength: 200 },
  })
  if (!result.valid) return validationError(result.error)

  const update: Record<string, unknown> = {}
  if (body.company      !== undefined) update.company       = body.company
  if (body.service      !== undefined) update.service       = body.service
  if (body.access       !== undefined) update.access        = body.access
  if (body.lastLogin    !== undefined) update.last_login    = body.lastLogin
  if (body.contact      !== undefined) update.contact       = body.contact
  if (body.email        !== undefined) update.email         = body.email
  if (body.portalRole   !== undefined) update.portal_role   = body.portalRole
  if (body.portalConfig !== undefined) {
    if (body.mergePortalConfig === true) {
      const existing = await db.from('portal_clients').select('portal_config').eq('id', id).single()
      const existingConfig = (existing.data?.portal_config as Record<string, unknown>) ?? {}
      update.portal_config = { ...existingConfig, ...(body.portalConfig as Record<string, unknown>) }
    } else {
      update.portal_config = body.portalConfig
    }
  }
  if (body.services     !== undefined) update.services      = body.services
  if (body.companyId    !== undefined) update.company_id    = body.companyId
  const { data, error } = await db.from('portal_clients').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update portal client')
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('portal-clients/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  // AUDIT #237 — removeMember (app/admin/portal-management/page.tsx) is the
  // only caller of this route, and every sibling action on that admin-only
  // page requires requireAdmin; this one only required the lowest staff
  // tier, letting any non-admin staff member remove a client's portal access.
  const denied = await requireAdmin(req)
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('portal_clients').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete portal client')
  }
  return NextResponse.json({ deleted: id })
})
