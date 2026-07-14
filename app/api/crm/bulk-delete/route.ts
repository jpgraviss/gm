import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'
import { getCompanyRelatedCounts, hasBlockingRelatedRecords, describeRelatedCounts, deleteCompanyActivities } from '@/lib/crm-cascade'

const TABLE_MAP: Record<string, string> = {
  companies: 'crm_companies',
  contacts: 'crm_contacts',
  deals: 'deals',
  proposals: 'proposals',
  contracts: 'contracts',
  tickets: 'tickets',
}

export const POST = withErrorHandler('crm/bulk-delete POST', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { type, ids } = await req.json() as { type: string; ids: string[] }

  if (!type || !ids?.length) {
    return NextResponse.json({ error: 'type and ids are required' }, { status: 400 })
  }

  const table = TABLE_MAP[type]
  if (!table) {
    return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 })
  }

  const db = createServiceClient()
  let deleted = 0
  const skipped: { id: string; name: string; reason: string }[] = []

  if (type === 'companies') {
    const { data: companies } = await db.from('crm_companies').select('id, name').in('id', ids)

    // AUDIT #96: block per-company rather than cascade-destroy real
    // business records — partial success, so one company with real data
    // attached doesn't stop a legitimate cleanup of the rest of the batch.
    const deletableIds: string[] = []
    for (const c of companies ?? []) {
      const counts = await getCompanyRelatedCounts(db, c.id, c.name)
      if (hasBlockingRelatedRecords(counts)) {
        skipped.push({ id: c.id, name: c.name, reason: `still has ${describeRelatedCounts(counts)}` })
      } else {
        deletableIds.push(c.id)
      }
    }

    if (deletableIds.length > 0) {
      for (const c of companies ?? []) {
        if (deletableIds.includes(c.id)) await deleteCompanyActivities(db, c.id, c.name)
      }
      const { error, count } = await db.from('crm_companies').delete({ count: 'exact' }).in('id', deletableIds)
      if (error) {
        throw new Error(error.message)
      }
      deleted = count ?? 0
    }
  } else {
    const { error, count } = await db.from(table).delete({ count: 'exact' }).in('id', ids)
    if (error) {
      throw new Error(error.message)
    }
    deleted = count ?? 0
  }

  await db.from('audit_logs').insert({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action: 'bulk_delete',
    module: type,
    type: 'action',
    metadata: { entity_type: type, entity_ids: ids, count: deleted, skipped: skipped.length },
  }).then(() => {}, () => {})

  return NextResponse.json({ deleted, skipped })
})
