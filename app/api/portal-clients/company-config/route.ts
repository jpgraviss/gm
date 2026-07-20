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

  const { company, portalConfig } = await req.json()
  if (!company || typeof company !== 'string') {
    return NextResponse.json({ error: 'company is required' }, { status: 400 })
  }
  if (!portalConfig || typeof portalConfig !== 'object') {
    return NextResponse.json({ error: 'portalConfig is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const update: Record<string, unknown> = { portal_config: portalConfig }
  if (Array.isArray(portalConfig.services)) {
    update.services = portalConfig.services
  }

  const { error } = await db
    .from('portal_clients')
    .update(update)
    .eq('company', company)

  if (error) {
    throw new Error(error?.message || 'Failed to update company config')
  }

  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'portal_config_updated', module: 'portal', type: 'action', metadata: { company } })
  return NextResponse.json({ success: true })
})
