import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'

const TABLE_MAP: Record<string, string> = {
  companies: 'crm_companies',
  contacts: 'crm_contacts',
  deals: 'deals',
  proposals: 'proposals',
  contracts: 'contracts',
  tickets: 'tickets',
}

export async function POST(req: NextRequest) {
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

  if (type === 'companies') {
    const companyNames: string[] = []
    const { data: companies } = await db.from('crm_companies').select('id, name').in('id', ids)
    if (companies) {
      companyNames.push(...companies.map(c => c.name))
    }

    const { error, count } = await db.from('crm_companies').delete({ count: 'exact' }).in('id', ids)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    deleted = count ?? 0

    if (companyNames.length > 0) {
      await db.from('crm_contacts').delete().in('company_name', companyNames)
      await db.from('deals').delete().in('company', companyNames)
      await db.from('contracts').delete().in('company', companyNames)
    }
  } else {
    const { error, count } = await db.from(table).delete({ count: 'exact' }).in('id', ids)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    deleted = count ?? 0
  }

  await db.from('audit_log').insert({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action: 'bulk_delete',
    entity_type: type,
    entity_ids: ids,
    count: deleted,
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})

  return NextResponse.json({ deleted })
}
