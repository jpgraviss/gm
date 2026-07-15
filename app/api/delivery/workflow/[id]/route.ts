import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('delivery/workflow/[id] GET', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing workflow id' }, { status: 400 })

  const db = createServiceClient()

  const [workflowRes, eventsRes] = await Promise.all([
    db.from('delivery_workflows').select('*').eq('id', id).single(),
    db.from('delivery_events').select('*').eq('workflow_id', id).order('created_at', { ascending: false }),
  ])

  if (workflowRes.error) {
    if (workflowRes.error.code === 'PGRST116') {
      return NextResponse.json({ error: workflowRes.error.message }, { status: 404 })
    }
    throw new Error(workflowRes.error.message || 'Failed to fetch workflow')
  }

  return NextResponse.json({
    ...workflowRes.data,
    events: eventsRes.data ?? [],
  })
})

export const DELETE = withErrorHandler('delivery/workflow/[id] DELETE', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing workflow id' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from('delivery_workflows').delete().eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete workflow')
  }

  return NextResponse.json({ deleted: true })
})
