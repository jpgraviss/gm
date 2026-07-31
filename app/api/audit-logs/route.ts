import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { getAuthUser } from '@/lib/rbac'
import { getSecuritySettings } from '@/lib/settings'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLog(row: any) {
  return {
    id:        row.id,
    user:      row.user_name,
    action:    row.action,
    module:    row.module,
    type:      row.type,
    metadata:  row.metadata ?? undefined,
    createdAt: row.created_at,
  }
}

export const GET = withErrorHandler('audit-logs GET', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  // AUDIT.md #176 — this previously did a single fetch(limit=5000) with no
  // cursor, so the pager, filter dropdowns, search, and CSV export (which
  // exports whatever's in the page's in-memory `entries`) all silently
  // omitted anything past 5,000 rows. Cursor pagination matches every other
  // growing-table route (lib/pagination.ts); the frontend now follows it
  // via fetchAllPages() to load the complete log, same fix pattern already
  // applied to deals/contacts/proposals/tasks/tickets/projects (#48/#151).
  const pagination = parsePagination(req)
  const db = createServiceClient()
  const { data, error } = await applyCursor(
    db.from('audit_logs').select('*'),
    pagination,
  )
  if (error) {
    throw new Error(error?.message || 'Failed to fetch audit logs')
  }
  const { rows, nextCursor } = slicePage(data, pagination.limit, pagination.orderBy)
  return paginatedJson(rows.map(mapLog), nextCursor)
})

export const POST = withErrorHandler('audit-logs POST', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const body = await req.json()

  // AUDIT #564 — this previously took user_name straight from the request
  // body, so any authenticated admin caller could forge the internal audit
  // trail's own "who did this" field to attribute an action to someone
  // else, or plant a benign-looking entry to bury a real one. Every other
  // write to this table (lib/audit.ts's logAudit(), used by ~60+ real call
  // sites) derives attribution from the verified session instead — match
  // that here, and honor the same Audit Logging security-setting toggle
  // logAudit() already respects, since this raw insert path bypassed it too.
  const actor = await getAuthUser(req)
  const security = await getSecuritySettings()
  if (!security.auditLogging) {
    return NextResponse.json({ error: 'Audit logging is currently disabled' }, { status: 409 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('audit_logs')
    .insert({
      id:        `al-${Date.now()}`,
      user_name: actor?.name || actor?.email || 'system',
      action:    body.action,
      module:    body.module ?? '',
      type:      body.type ?? 'action',
      metadata:  body.metadata ?? null,
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create audit log')
  }
  return NextResponse.json(mapLog(data), { status: 201 })
})
