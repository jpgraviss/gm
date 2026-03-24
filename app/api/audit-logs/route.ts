import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)
  const db = createServiceClient()
  const { data, error } = await db
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[audit-logs GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch audit logs' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapLog))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from('audit_logs')
    .insert({
      id:        `al-${Date.now()}`,
      user_name: body.user ?? '',
      action:    body.action,
      module:    body.module ?? '',
      type:      body.type ?? 'action',
      metadata:  body.metadata ?? null,
    })
    .select()
    .single()
  if (error) {
    console.error('[audit-logs POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create audit log' }, { status: 500 })
  }
  return NextResponse.json(mapLog(data), { status: 201 })
}
