import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, TICKET_STATUSES, TASK_PRIORITIES } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

export const PATCH = withErrorHandler('tickets/[id] PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const body = await req.json()
  const result = validate(body, {
    status: { type: 'string', enum: [...TICKET_STATUSES] },
    priority: { type: 'string', enum: [...TASK_PRIORITIES] },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()
  const update: Record<string, unknown> = {
    updated_date: new Date().toISOString().split('T')[0],
  }
  if (body.status !== undefined)     update.status = body.status
  if (body.priority !== undefined)   update.priority = body.priority
  if (body.assignedTo !== undefined) update.assigned_to = body.assignedTo
  if (body.tags !== undefined)       update.tags = body.tags
  if (body.messages !== undefined)   update.messages = body.messages
  if (body.linkedTaskId !== undefined) update.linked_task_id = body.linkedTaskId
  if (body.companyId !== undefined)    update.company_id = body.companyId
  const { data, error } = await db.from('tickets').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update ticket')
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('tickets/[id] DELETE', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const db = createServiceClient()
  const { error } = await db.from('tickets').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete ticket')
  }
  logAudit({ userName: 'system', action: 'deleted_ticket', module: 'tickets', type: 'warning', metadata: { ticketId: id } })
  return NextResponse.json({ deleted: id })
})
