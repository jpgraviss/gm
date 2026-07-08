import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'

export const POST = withErrorHandler('deals/reassign POST', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const { fromRep, toRep } = await req.json()

  if (!fromRep || !toRep) {
    return NextResponse.json({ error: 'fromRep and toRep are required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data, error } = await db
    .from('deals')
    .update({ assigned_rep: toRep })
    .eq('assigned_rep', fromRep)
    .select('id')

  if (error) {
    throw new Error(error.message)
  }

  logAudit({ userName: 'system', action: 'deals_reassigned', module: 'crm', type: 'warning', metadata: { fromRep, toRep, count: data?.length ?? 0 } })
  return NextResponse.json({ reassigned: data?.length ?? 0 })
})
