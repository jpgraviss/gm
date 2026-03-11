import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAutomation(row: any) {
  return {
    id:       row.id,
    name:     row.name,
    trigger:  row.trigger,
    actions:  row.actions ?? [],
    status:   row.status,
    runs:     row.runs,
    lastRun:  row.last_run,
  }
}

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(mapAutomation))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from('automations')
    .insert({
      id:       body.id ?? `auto-${Date.now()}`,
      name:     body.name,
      trigger:  body.trigger,
      actions:  body.actions ?? [],
      status:   body.status ?? 'Active',
      runs:     body.runs ?? 0,
      last_run: body.lastRun ?? 'Never',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapAutomation(data), { status: 201 })
}
