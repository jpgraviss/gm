import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
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

export const GET = withErrorHandler('audit-logs GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)
  const db = createServiceClient()
  const { data, error } = await db
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    throw new Error(error?.message || 'Failed to fetch audit logs')
  }
  return NextResponse.json((data ?? []).map(mapLog))
})

export const POST = withErrorHandler('audit-logs POST', async (req) => {
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
    throw new Error(error?.message || 'Failed to create audit log')
  }
  return NextResponse.json(mapLog(data), { status: 201 })
})
