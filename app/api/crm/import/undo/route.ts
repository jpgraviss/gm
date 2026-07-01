import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'

const TABLE_MAP: Record<string, string> = {
  contacts: 'crm_contacts',
  companies: 'crm_companies',
  deals: 'deals',
}

export async function POST(req: NextRequest) {
  const denied = await requireRole(req, 'Dept Manager')
  if (denied) return denied

  const { importId } = await req.json() as { importId: string }

  if (!importId) {
    return NextResponse.json({ error: 'importId is required' }, { status: 400 })
  }

  const db = createServiceClient()
  let totalDeleted = 0

  for (const [, table] of Object.entries(TABLE_MAP)) {
    const { count } = await db
      .from(table)
      .delete({ count: 'exact' })
      .eq('import_batch_id', importId)
    totalDeleted += count ?? 0
  }

  return NextResponse.json({ deleted: totalDeleted, importId })
}
