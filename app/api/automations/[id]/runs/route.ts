import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('automations/[id]/runs GET', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()

  const { data: runs, error } = await db
    .from('automation_runs')
    .select('*')
    .eq('automation_id', id)
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[automation runs GET]', error)
    return NextResponse.json([], { status: 200 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (runs ?? []).map((run: any) => {
    const steps = (run.steps ?? []) as Array<{
      name: string
      status: string
      duration_ms: number
      error?: string
    }>
    const successCount = steps.filter(s => s.status === 'success').length
    const triggerData = (run.trigger_data ?? {}) as Record<string, unknown>

    return {
      id: run.id,
      automation_id: run.automation_id,
      timestamp: run.started_at,
      trigger_contact: {
        name: (triggerData.full_name as string) ?? (triggerData.contactName as string) ?? (triggerData.company as string) ?? 'Unknown',
        email: ((triggerData.emails as string[] | undefined)?.[0]) ?? (triggerData.contactEmail as string) ?? '',
      },
      status: run.status === 'completed' ? 'success' : (run.status as 'failed' | 'running' | 'waiting'),
      actions_completed: successCount,
      actions_total: steps.length,
      steps: steps.map(s => ({
        name: s.name,
        status: s.status as 'success' | 'failed' | 'running' | 'pending' | 'skipped',
        duration_ms: s.duration_ms ?? 0,
        error: s.error,
      })),
    }
  })

  return NextResponse.json(mapped)
})
