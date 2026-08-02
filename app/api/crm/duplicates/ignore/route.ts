import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'

export const POST = withErrorHandler('crm/duplicates/ignore POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { type, groupKey } = body as { type?: string; groupKey?: string }
  if (!type || !groupKey) {
    return NextResponse.json({ error: 'type and groupKey are required' }, { status: 400 })
  }
  if (type !== 'contacts' && type !== 'companies') {
    return NextResponse.json({ error: 'type must be "contacts" or "companies"' }, { status: 400 })
  }

  const db = createServiceClient()

  // AUDIT #683 — this used to be a non-atomic read (SELECT), modify (push
  // groupKey into the array in application code), write (upsert the whole
  // row back) — two concurrent "Ignore" calls on different duplicate
  // groups could both read the same pre-update array, and the second
  // upsert silently clobbered the first's addition. dismiss_duplicate()
  // (supabase/migrations/add_dismiss_duplicate_rpc.sql) does the same
  // read-modify-write inside a single statement, under the row lock the
  // UPSERT already holds, same pattern as #43/#44/#45's RPCs.
  const { error } = await db.rpc('dismiss_duplicate', { p_type: type, p_group_key: groupKey })

  if (error) {
    throw new Error(error.message || 'Failed to ignore duplicate')
  }

  return NextResponse.json({ ok: true })
})
