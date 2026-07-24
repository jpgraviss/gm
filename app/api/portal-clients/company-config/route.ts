import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { requireAdmin } from '@/lib/admin-auth'
import { getAuthUser } from '@/lib/rbac'

export const PATCH = withErrorHandler('portal-clients/company-config PATCH', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { company, companyId, portalConfig } = await req.json()
  if (!company || typeof company !== 'string') {
    return NextResponse.json({ error: 'company is required' }, { status: 400 })
  }
  if (!portalConfig || typeof portalConfig !== 'object') {
    return NextResponse.json({ error: 'portalConfig is required' }, { status: 400 })
  }
  if (companyId !== undefined && companyId !== null && typeof companyId !== 'string') {
    return NextResponse.json({ error: 'companyId must be a string' }, { status: 400 })
  }

  const db = createServiceClient()

  const update: Record<string, unknown> = { portal_config: portalConfig }
  if (Array.isArray(portalConfig.services)) {
    update.services = portalConfig.services
  }

  // AUDIT #187 — updating purely by `company` name pushes the same config
  // write onto every row matching that name, even a different, unrelated
  // company that happens to share it. Prefer the precise, collision-proof
  // `company_id` scope when supplied; otherwise fall back to the legacy
  // name match, but restricted to rows never linked to a real CRM company
  // so a linked company's config can never be overwritten via a same-named
  // unlinked (or differently-linked) row.
  let query = db.from('portal_clients').update(update)
  query = companyId
    ? query.eq('company_id', companyId)
    : query.eq('company', company).is('company_id', null)

  const { error } = await query

  if (error) {
    throw new Error(error?.message || 'Failed to update company config')
  }

  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'portal_config_updated', module: 'portal', type: 'action', metadata: { company, companyId } })
  return NextResponse.json({ success: true })
})
