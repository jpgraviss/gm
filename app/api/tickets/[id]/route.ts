import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, TICKET_STATUSES, TICKET_PRIORITIES } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { requirePortalClient, isStaffCaller } from '@/lib/portal-auth'
import { withErrorHandler } from '@/lib/api-handler'
import { mapTicket } from '@/lib/tickets'
import { stableStringify } from '@/lib/stable-json'
import { notifyPortalClient } from '@/lib/portal-notify'

// Portal clients can only reply to their own ticket (Tickets page's Reply
// box) — status/priority/assignedTo/tags/companyId are staff-only.
const PORTAL_CLIENT_EDITABLE_FIELDS = new Set(['messages'])

// AUDIT.md #486 — tickets don't store a direct portal_client_id FK, so the
// specific portal contact for a reply notification has to be resolved the
// same way the rest of the app already infers portal-client identity:
// prefer an exact email match (contact_email is the ticket's own submitter,
// same lookup shape as app/api/auth/profile/route.ts's ilike email match),
// then fall back to company_id (app/api/portal/dashboard/route.ts's own
// join key), then plain company name as a last resort for older tickets
// that predate company_id backfill.
async function resolvePortalClientId(
  db: ReturnType<typeof createServiceClient>,
  ticket: { company: string; companyId?: string | null; contactEmail?: string | null },
): Promise<string | null> {
  if (ticket.contactEmail) {
    const { data } = await db.from('portal_clients').select('id').ilike('email', ticket.contactEmail).maybeSingle()
    if (data?.id) return data.id
  }
  if (ticket.companyId) {
    const { data } = await db.from('portal_clients').select('id').eq('company_id', ticket.companyId).limit(1).maybeSingle()
    if (data?.id) return data.id
  }
  const { data } = await db.from('portal_clients').select('id').eq('company', ticket.company).limit(1).maybeSingle()
  return data?.id ?? null
}

export const PATCH = withErrorHandler('tickets/[id] PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const body = await req.json()
  const result = validate(body, {
    status: { type: 'string', enum: [...TICKET_STATUSES] },
    priority: { type: 'string', enum: [...TICKET_PRIORITIES] },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  const { data: current, error: fetchErr } = await db
    .from('tickets')
    .select('company, company_id, contact_email, subject')
    .eq('id', id)
    .single()
  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  // AUDIT.md #469 — pass the ticket's own company_id so requirePortalClient
  // can do the collision-proof company_id comparison instead of only a name
  // match when the caller's own portal_clients row is linked.
  const denied = await requirePortalClient(req, current.company, current.company_id)
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
  // AUDIT.md #486 — the newly appended messages from a staff reply, kept
  // around (only in the staffCaller branch below) so a client-visible one
  // can trigger notifyPortalClient() after the update succeeds. Portal
  // clients replying to their own ticket never need to notify themselves,
  // so this stays empty on that branch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let newStaffMessages: any[] = []
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

      // AUDIT — plain JSON.stringify is key-order-sensitive, but `existing`
      // just came back through a jsonb column, which does NOT preserve
      // insertion order (Postgres normalizes it) — so an unmodified prefix
      // could still fail this comparison purely from key reordering,
      // rejecting a legitimate second reply in the same session. Compare
      // with sorted keys so only real content changes trigger a mismatch.
      const prefixUnchanged =
        incoming.length >= existing.length &&
        existing.every((m, i) => stableStringify(m) === stableStringify(incoming[i]))

      if (!prefixUnchanged) {
        return NextResponse.json({ error: 'Cannot modify or remove existing messages' }, { status: 403 })
      }

      newStaffMessages = incoming.slice(existing.length)
      update.messages = [...existing, ...newStaffMessages]
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

      // Same jsonb key-order caveat as the staff branch above.
      const prefixUnchanged =
        incoming.length >= existingVisible.length &&
        existingVisible.every((m, i) => stableStringify(m) === stableStringify(incoming[i]))

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

  // AUDIT.md #486 — notify the portal client that a staff member replied.
  // Skip isInternal-only messages (internal notes aren't meant for the
  // client to see at all, so there's nothing to notify them about) and
  // skip entirely when the reply came from the portal client themselves
  // (newStaffMessages is only ever populated on the staffCaller branch).
  const clientVisibleReplies = newStaffMessages.filter(m => !m?.isInternal)
  if (clientVisibleReplies.length > 0) {
    try {
      const portalClientId = await resolvePortalClientId(db, {
        company: current.company,
        companyId: current.company_id,
        contactEmail: current.contact_email,
      })
      if (portalClientId) {
        const lastReply = clientVisibleReplies[clientVisibleReplies.length - 1]
        const preview = typeof lastReply?.body === 'string' ? lastReply.body.slice(0, 200) : ''
        await notifyPortalClient(
          portalClientId,
          'ticket_reply',
          `New reply on your ticket: ${current.subject ?? ''}`,
          preview || 'A team member replied to your support ticket.',
          '/client',
        )
      }
    } catch (err) {
      console.error('[tickets/[id]] portal-client notify failed:', err)
    }
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
