import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAutomation(row: any, runStats?: { total: number; succeeded: number; failed: number; lastRunAt: string | null }) {
  return {
    id:          row.id,
    name:        row.name,
    trigger:     row.trigger,
    actions:     row.actions ?? [],
    status:      row.status,
    runs:        runStats?.total ?? row.runs ?? 0,
    lastRun:     runStats?.lastRunAt ?? row.last_run ?? 'Never',
    successRate: runStats && runStats.total > 0
      ? Math.round((runStats.succeeded / runStats.total) * 100)
      : null,
    failedRuns:  runStats?.failed ?? 0,
  }
}

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[automations GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch automations' }, { status: 500 })
  }

  const automationIds = (data ?? []).map((a: { id: string }) => a.id)
  const statsMap = new Map<string, { total: number; succeeded: number; failed: number; lastRunAt: string | null }>()

  if (automationIds.length > 0) {
    const { data: runs } = await db
      .from('automation_runs')
      .select('automation_id, status, started_at')
      .in('automation_id', automationIds)
      .order('started_at', { ascending: false })

    for (const run of (runs ?? []) as Array<{ automation_id: string; status: string; started_at: string }>) {
      const existing = statsMap.get(run.automation_id) ?? { total: 0, succeeded: 0, failed: 0, lastRunAt: null }
      existing.total++
      if (run.status === 'completed') existing.succeeded++
      if (run.status === 'failed') existing.failed++
      if (!existing.lastRunAt) existing.lastRunAt = run.started_at
      statsMap.set(run.automation_id, existing)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json((data ?? []).map((row: any) => mapAutomation(row, statsMap.get(row.id))))
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const result = validate(body, {
    name:    { required: true, type: 'string', maxLength: 200 },
    trigger: { required: true, type: 'string', maxLength: 100 },
    actions: { required: true, type: 'array' },
  })
  if (!result.valid) return validationError(result.error)

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
  if (error) {
    console.error('[automations POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create automation' }, { status: 500 })
  }
  return NextResponse.json(mapAutomation(data), { status: 201 })
}
