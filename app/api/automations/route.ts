import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { normalizeActionsForStorage } from '@/lib/automation-actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAutomation(row: any, runStats?: { total: number; succeeded: number; failed: number; lastRunAt: string | null }) {
  return {
    id:          row.id,
    name:        row.name,
    trigger:     row.trigger,
    actions:     row.actions ?? [],
    config:      row.config ?? {},
    status:      row.status,
    runs:        runStats?.total ?? row.runs ?? 0,
    lastRun:     runStats?.lastRunAt ?? row.last_run ?? 'Never',
    successRate: runStats && runStats.total > 0
      ? Math.round((runStats.succeeded / runStats.total) * 100)
      : null,
    failedRuns:  runStats?.failed ?? 0,
  }
}

export const GET = withErrorHandler('automations GET', async () => {
  const db = createServiceClient()
  const { data, error } = await db
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(error?.message || 'Failed to fetch automations')
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
})

export const POST = withErrorHandler('automations POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
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
      actions:  normalizeActionsForStorage(body.actions ?? []),
      config:   body.config ?? {},
      status:   body.status ?? 'Active',
      runs:     body.runs ?? 0,
      last_run: body.lastRun ?? 'Never',
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create automation')
  }
  return NextResponse.json(mapAutomation(data), { status: 201 })
})
