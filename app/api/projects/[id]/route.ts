import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, PROJECT_STATUSES } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'
import { fireAutomations } from '@/lib/automations-engine'
import { logActivity } from '@/lib/activity-log'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(row: any) {
  return {
    id:                   row.id,
    contractId:           row.contract_id ?? '',
    company:              row.company,
    companyId:            row.company_id || null,
    serviceType:          row.service_type,
    serviceTypes:         row.service_types ?? [],
    status:               row.status,
    startDate:            row.start_date ?? '',
    launchDate:           row.launch_date ?? '',
    maintenanceStartDate: row.maintenance_start_date ?? undefined,
    assignedTeam:         row.assigned_team ?? [],
    progress:             row.progress ?? 0,
    milestones:           row.milestones ?? [],
    tasks:                row.tasks ?? [],
    notes:                row.notes ?? [],
    overview:             row.overview ?? '',
    sections:             row.sections ?? ['To Do', 'In Progress', 'Done'],
    color:                row.color ?? '#015035',
    description:          row.description ?? '',
  }
}

export const GET = withErrorHandler('projects/[id] GET', async (req, ctx) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await ctx!.params
  const db = createServiceClient()
  const { data, error } = await db.from('projects').select('*').eq('id', id).maybeSingle()
  if (error) {
    throw new Error(error?.message || 'Failed to fetch project')
  }
  if (!data) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  return NextResponse.json(mapProject(data))
})

export const PATCH = withErrorHandler('projects/[id] PATCH', async (req, ctx) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await ctx!.params
  const body = await req.json()
  const result = validate(body, {
    status: { type: 'string', enum: [...PROJECT_STATUSES] },
    overview: { type: 'string', maxLength: 5000 },
    contractId: { type: 'string', maxLength: 100 },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()

  // AUDIT.md #400/#137 — contractId was a fully persisted, mapped column
  // with no code path that ever set it (not even here: this PATCH silently
  // dropped it if a caller sent it). "Convert to Project" and "Link
  // Existing Project" (app/contracts/page.tsx) both PATCH this field now,
  // so verify the target contract is real before linking — an unchecked
  // string would let a project silently point at a nonexistent contract.
  if (body.contractId !== undefined && body.contractId !== '') {
    const { data: contract, error: cErr } = await db.from('contracts').select('id').eq('id', body.contractId).single()
    if (cErr || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
  }

  // Read the pre-update status so the automation trigger below only fires
  // on a real status transition, not on every unrelated field edit.
  const { data: current } = body.status !== undefined
    ? await db.from('projects').select('status').eq('id', id).maybeSingle()
    : { data: null }
  const actor = body.status !== undefined ? await getAuthUser(req) : null

  const update: Record<string, unknown> = {}
  if (body.contractId !== undefined)           update.contract_id = body.contractId || null
  if (body.status !== undefined)               update.status = body.status
  if (body.progress !== undefined)             update.progress = body.progress
  if (body.milestones !== undefined)           update.milestones = body.milestones
  if (body.tasks !== undefined)                update.tasks = body.tasks
  if (body.assignedTeam !== undefined)         update.assigned_team = body.assignedTeam
  if (body.notes !== undefined)               update.notes = body.notes
  if (body.overview !== undefined)            update.overview = body.overview
  if (body.launchDate !== undefined)           update.launch_date = body.launchDate
  if (body.maintenanceStartDate !== undefined) update.maintenance_start_date = body.maintenanceStartDate
  if (body.sections !== undefined)             update.sections = body.sections
  if (body.color !== undefined)                update.color = body.color
  if (body.description !== undefined)          update.description = body.description
  if (body.startDate !== undefined)            update.start_date = body.startDate
  if (body.serviceType !== undefined)          update.service_type = body.serviceType
  if (body.serviceTypes !== undefined) {
    update.service_types = body.serviceTypes
    update.service_type = body.serviceTypes[0] ?? body.serviceType ?? 'General'
  }
  if (body.company !== undefined)              update.company = body.company
  if (body.companyId !== undefined)            update.company_id = body.companyId
  const { data, error } = await db.from('projects').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update project')
  }

  // Delivery/Operations previously could not trigger any automation — the
  // one project trigger that existed ('project_launched') was only ever
  // fired by a dead endpoint with zero callers. Only fires on a real status
  // transition, not on every field edit.
  if (body.status !== undefined && body.status !== current?.status) {
    const projectContext = {
      projectId: id,
      status: data.status,
      previousStatus: current?.status ?? null,
      company: data.company,
      companyId: data.company_id,
      contractId: data.contract_id,
      service_type: data.service_type,
    }
    fireAutomations('project_status_changed', projectContext)
    if (data.status === 'Completed') fireAutomations('project_completed', projectContext)

    // Operations previously never wrote to crm_activities, so a project
    // moving through its lifecycle never showed on the client's timeline.
    logActivity({
      type: 'project',
      title: `Project ${data.status} — ${data.service_type ?? 'General'}`,
      body: current?.status ? `Moved from ${current.status} to ${data.status}` : undefined,
      companyId: data.company_id,
      companyName: data.company,
      userName: actor?.name || actor?.email || 'System',
    })
  }

  return NextResponse.json(mapProject(data))
})

export const DELETE = withErrorHandler('projects/[id] DELETE', async (req, ctx) => {
  const { id } = await ctx!.params
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)
  const db = createServiceClient()
  const { error } = await db.from('projects').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete project')
  }
  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'deleted_project', module: 'projects', type: 'warning', metadata: { projectId: id } })
  return NextResponse.json({ deleted: id })
})
