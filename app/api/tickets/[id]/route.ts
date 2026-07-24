import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, TICKET_STATUSES, TASK_PRIORITIES } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { requirePortalClient, isStaffCaller } from '@/lib/portal-auth'
import { withErrorHandler } from '@/lib/api-handler'
import { mapTicket } from '@/lib/tickets'

// Portal clients can only reply to their own ticket (Tickets page's Reply
// box) — status/priority/assignedTo/tags/companyId are staff-only.
const PORTAL_CLIENT_EDITABLE_FIELDS = new Set(['messages'])

export const PATCH = withErrorHandler('tickets/[id] PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const body = await req.json()
  const result = validate(body, {
    status: { type: 'string', enum: [...TICKET_STATUSES] },
    priority: { type: 'string', enum: [...TASK_PRIORITIES] },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  const { data: current, error: fetchErr } = await db
    .from('tickets')
    .select('company')
    .eq('id', id)
    .single()
  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  const denied = await requirePortalClient(req, current.company)
  if (denied) return denied

  const staffCaller = await isStaffCaller(req)
  if (!staffCaller) {
    const disallowed = Object.keys(body).filter(k => !PORTAL_CLIENT_EDITABLE_FIELDS.has(k))
    if (disallowed.length > 0) {
      return NextResponse.json({ error: `Not permitted to update: ${disallowed.join(', ')}` }, { status: 403 })
    }
  }

  const update: Record<string, unknown> = {
    updated_date: new Date().toISOString().split('T')[0],
  }
  if (body.status !== undefined)     update.status = body.status
  if (body.priority !== undefined)   update.priority = body.priority
  if (body.assignedTo !== undefined) update.assigned_to = body.assignedTo
  if (body.tags !== undefined)       update.tags = body.tags
  if (body.messages !== undefined) {
    if (staffCaller) {
      // Previously a blind full-array overwrite with no concurrency
      // protection — two staff members (or two browser tabs) replying to
      // the same ticket within the same round trip could have one reply
      // silently overwritten and permanently lost. Staff only ever append
      // (see app/tickets/page.tsx's sendReply — always `[...t.messages,
      // newMsg]`, never edits existing message content), so the same
      // append-only prefix-check pattern the portal-client branch below
      // already uses transfers directly, minus the isInternal
      // filter/stripping (staff already see and can add internal notes).
      const { data: currentFull } = await db.from('tickets').select('messages').eq('id', id).single()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (currentFull?.messages ?? []) as any[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const incoming = (body.messages ?? []) as any[]

      const prefixUnchanged =
        incoming.length >= existing.length &&
        existing.every((m, i) => JSON.stringify(m) === JSON.stringify(incoming[i]))

      if (!prefixUnchanged) {
        return NextResponse.json({ error: 'Cannot modify or remove existing messages' }, { status: 403 })
      }

      update.messages = [...existing, ...incoming.slice(existing.length)]
    } else {
      // The client-supplied `messages` field is a full-array replace with
      // no server-side check it's actually an append — previously trusted
      // outright, so a tampered array could silently edit or delete prior
      // messages (including staff internal notes). Portal callers only see
      // non-internal messages (the list route filters those out), so their
      // local array never contained internal ones to begin with — compare
      // against the visible subset of the real array, then append whatever
      // is new on top of the real (unfiltered) array so internal notes are
      // never touched.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: currentFull } = await db.from('tickets').select('messages').eq('id', id).single()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (currentFull?.messages ?? []) as any[]
      const existingVisible = existing.filter(m => !m?.isInternal)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const incoming = (body.messages ?? []) as any[]

      const prefixUnchanged =
        incoming.length >= existingVisible.length &&
        existingVisible.every((m, i) => JSON.stringify(m) === JSON.stringify(incoming[i]))

      if (!prefixUnchanged) {
        return NextResponse.json({ error: 'Cannot modify or remove existing messages' }, { status: 403 })
      }

      const appended = incoming.slice(existingVisible.length).map(m => ({ ...m, isInternal: false }))
      update.messages = [...existing, ...appended]
    }
  }
  if (body.linkedTaskId !== undefined) update.linked_task_id = body.linkedTaskId
  if (body.companyId !== undefined)    update.company_id = body.companyId
  const { data, error } = await db.from('tickets').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update ticket')
  }
  // AUDIT.md #202 — this used to return the raw DB row, unlike GET/POST
  // which both correctly filter isInternal messages via mapTicket(). A
  // portal client replying to their own ticket got every internal-only
  // staff note back in the response body, even though the UI never
  // rendered it.
  return NextResponse.json(mapTicket(data, staffCaller))
})

export const DELETE = withErrorHandler('tickets/[id] DELETE', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)
  const db = createServiceClient()
  const { error } = await db.from('tickets').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete ticket')
  }
  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'deleted_ticket', module: 'tickets', type: 'warning', metadata: { ticketId: id } })
  return NextResponse.json({ deleted: id })
})
