import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const TABLE_MAP: Record<string, string> = {
  contacts: 'crm_contacts',
  companies: 'crm_companies',
  deals: 'deals',
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createServiceClient()
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: member } = await db.from('team_members').select('is_admin').eq('email', user.email).single()
  if (!member?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { importId } = await req.json() as { importId: string }

  if (!importId) {
    return NextResponse.json({ error: 'importId is required' }, { status: 400 })
  }
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
