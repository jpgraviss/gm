/**
 * Shared pipeline/stage config + helpers.
 *
 * `DEFAULT_PIPELINES` mirrors the fallback baked into GET /api/pipelines —
 * kept here (rather than only in that route) so anything that needs a
 * pipeline's stages without going through the API (e.g. auto-creating a deal
 * from a form submission) reads the same source of truth an admin actually
 * configured, instead of hardcoding a stage name that could drift from it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PipelineStage {
  id: string
  name: string
  color: string
  probability?: number
}

export interface Pipeline {
  id: string
  name: string
  stages: PipelineStage[]
}

export const DEFAULT_PIPELINES: Pipeline[] = [
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

/**
 * Resolve the first stage's name in the "Client Acquisition" pipeline — the
 * pipeline new leads/deals land in by default (see POST /api/deals'
 * `pipelineId ?? 'client-acquisition'`) — reading whatever pipeline config
 * is actually active (a saved custom config if there is one, DEFAULT_PIPELINES
 * otherwise). deals.stage stores the stage NAME, not its id (confirmed via
 * the onDragEnd/handleAdvanceStage comment in app/api/pipelines/route.ts),
 * so that's what's returned here.
 */
export async function getFirstPipelineStageName(db: SupabaseClient): Promise<string> {
  const pipeline = await getClientAcquisitionPipeline(db)
  return pipeline?.stages?.[0]?.name ?? 'Lead'
}

async function getClientAcquisitionPipeline(db: SupabaseClient): Promise<Pipeline | undefined> {
  const { data } = await db
    .from('app_settings')
    .select('pipelines')
    .eq('id', 'global')
    .maybeSingle()

  const stored = data?.pipelines as Pipeline[] | null
  const pipelines = Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_PIPELINES

  return pipelines.find(p => p.id === 'client-acquisition') ?? pipelines[0]
}

// AUDIT #516 — the automation builder/generator used to hardcode a stage
// list (including 'Negotiation', which doesn't actually exist) instead of
// reading the real, saved pipeline config, the same drift-prone pattern
// #501 already fixed for the forms editor. Returns just the stage names, in
// order, for whatever "Create Deal"/"Deal Stage Changed" dropdowns need.
export async function getPipelineStageNames(db: SupabaseClient): Promise<string[]> {
  const pipeline = await getClientAcquisitionPipeline(db)
  return pipeline?.stages?.map(s => s.name) ?? []
}
