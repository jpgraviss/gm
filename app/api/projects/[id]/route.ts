import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, PROJECT_STATUSES } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

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

export const PATCH = withErrorHandler('projects/[id] PATCH', async (req, ctx) => {
  const { id } = await ctx!.params
  const body = await req.json()
  const result = validate(body, {
    status: { type: 'string', enum: [...PROJECT_STATUSES] },
    overview: { type: 'string', maxLength: 5000 },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
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
  return NextResponse.json(mapProject(data))
})

export const DELETE = withErrorHandler('projects/[id] DELETE', async (req, ctx) => {
  const { id } = await ctx!.params
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const db = createServiceClient()
  const { error } = await db.from('projects').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete project')
  }
  logAudit({ userName: 'system', action: 'deleted_project', module: 'projects', type: 'warning', metadata: { projectId: id } })
  return NextResponse.json({ deleted: id })
})
