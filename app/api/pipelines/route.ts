import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

const DEFAULT_PIPELINES = [
  {
    id: 'client-acquisition',
    name: 'Client Acquisition',
    stages: [
      { id: 'ca-0', name: 'Lead', color: '#9ca3af', probability: 10 },
      { id: 'ca-1', name: 'Qualified', color: '#3b82f6', probability: 25 },
      { id: 'ca-2', name: 'Proposal Sent', color: '#f59e0b', probability: 50 },
      { id: 'ca-3', name: 'Contract Sent', color: '#f97316', probability: 75 },
      { id: 'ca-4', name: 'Closed Won', color: '#22c55e', probability: 100 },
      { id: 'ca-5', name: 'Closed Lost', color: '#ef4444', probability: 0 },
    ],
  },
  {
    id: 'clients',
    name: 'Clients',
    stages: [
      { id: 'cl-0', name: 'Onboarding', color: '#3b82f6', probability: 100 },
      { id: 'cl-1', name: 'Active', color: '#22c55e', probability: 100 },
      { id: 'cl-2', name: 'At Risk', color: '#f59e0b', probability: 50 },
      { id: 'cl-3', name: 'Churned', color: '#ef4444', probability: 0 },
    ],
  },
  {
    id: 'contract-archive',
    name: 'Contract Archive',
    stages: [
      { id: 'ar-0', name: 'Draft', color: '#9ca3af', probability: 0 },
      { id: 'ar-1', name: 'Sent', color: '#3b82f6', probability: 0 },
      { id: 'ar-2', name: 'Signed', color: '#22c55e', probability: 100 },
      { id: 'ar-3', name: 'Expired', color: '#ef4444', probability: 0 },
    ],
  },
]

interface PipelineStage {
  id: string
  name: string
  color: string
  probability?: number
}

interface Pipeline {
  id: string
  name: string
  stages: PipelineStage[]
}

export const GET = withErrorHandler('pipelines GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const db = createServiceClient()
  const { data } = await db
    .from('app_settings')
    .select('pipelines')
    .eq('id', 'global')
    .maybeSingle()

  const stored = data?.pipelines as Pipeline[] | null
  if (Array.isArray(stored) && stored.length > 0) {
    return NextResponse.json(stored)
  }

  return NextResponse.json(DEFAULT_PIPELINES)
})

export const POST = withErrorHandler('pipelines POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const body = await req.json()

  if (Array.isArray(body)) {
    const db = createServiceClient()

    // deals.stage stores the stage NAME, not its id (confirmed via
    // onDragEnd/handleAdvanceStage in app/crm/pipeline/page.tsx). Renaming
    // a stage here only edited the config, never the matching value on any
    // deal currently in it — those deals would silently vanish from every
    // pipeline view (Kanban filters by stage.name, and there's no stage
    // picker anywhere to recover one manually). Diff against what's
    // currently stored to detect same-id/different-name stages and carry
    // affected deals' stage value forward with the rename.
    const { data: before } = await db
      .from('app_settings')
      .select('pipelines')
      .eq('id', 'global')
      .maybeSingle()
    const prevPipelines = (before?.pipelines as Pipeline[] | null) ?? []

    for (const newPipeline of body as Pipeline[]) {
      const prevPipeline = prevPipelines.find(p => p.id === newPipeline.id)
      if (!prevPipeline) continue
      for (const newStage of newPipeline.stages ?? []) {
        const prevStage = prevPipeline.stages.find(s => s.id === newStage.id)
        if (!prevStage || prevStage.name === newStage.name) continue
        await db.from('deals').update({ stage: newStage.name }).eq('stage', prevStage.name).eq('pipeline_id', newPipeline.id)
        if (newPipeline.id === 'client-acquisition') {
          await db.from('deals').update({ stage: newStage.name }).eq('stage', prevStage.name).is('pipeline_id', null)
        }
      }
    }

    const { error } = await db
      .from('app_settings')
      .upsert({ id: 'global', pipelines: body, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) {
      throw new Error(error?.message || 'Failed to save pipelines')
    }
    return NextResponse.json(body, { status: 201 })
  }

  const { id, name, stages } = body
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: settings } = await db
    .from('app_settings')
    .select('pipelines')
    .eq('id', 'global')
    .maybeSingle()

  const existing = (settings?.pipelines as Pipeline[] | null) ?? DEFAULT_PIPELINES
  const pipelineId = id || `pipeline-${Date.now()}`
  const newPipeline: Pipeline = {
    id: pipelineId,
    name: name.trim(),
    stages: Array.isArray(stages) ? stages : [],
  }

  const idx = existing.findIndex(p => p.id === pipelineId)
  const updated = idx >= 0
    ? existing.map(p => p.id === pipelineId ? newPipeline : p)
    : [...existing, newPipeline]

  const { error } = await db
    .from('app_settings')
    .upsert({ id: 'global', pipelines: updated, updated_at: new Date().toISOString() }, { onConflict: 'id' })

  if (error) {
    throw new Error(error?.message || 'Failed to save pipeline')
  }

  return NextResponse.json({ id: pipelineId, name: name.trim() }, { status: 201 })
})
