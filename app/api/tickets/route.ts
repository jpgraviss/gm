import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, TICKET_STATUSES, TICKET_PRIORITIES } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { requireRole } from '@/lib/rbac'
import { requirePortalClient, isStaffCaller } from '@/lib/portal-auth'
import { withErrorHandler } from '@/lib/api-handler'
import { mapTicket } from '@/lib/tickets'
import { sendPushNotification } from '@/lib/push-notifications'
import { shouldSendPushForEvent } from '@/lib/notification-preferences'

export const GET = withErrorHandler('tickets GET', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const company = searchParams.get('company')

  // Portal clients (Tickets page) legitimately call this scoped to their
  // own company — see matching comment in app/api/proposals/route.ts. This
  // also closes a real cross-company leak: without company scoping, GET
  // returned internal-only ticket notes for every company to any caller.
  const denied = company
    ? await requirePortalClient(req, company)
    : await requireRole(req, 'Team Member')
  if (denied) return denied

  const includeInternal = await isStaffCaller(req)

  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('tickets')
    .select('*')
  if (status) query = query.eq('status', status)
  if (company) query = query.eq('company', company)
  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch tickets')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(row => mapTicket(row, includeInternal)), nextCursor)
})

// AUDIT.md #486 — result now also says *why* someone was assigned, so the
// POST handler below can tell a plain routing assignment apart from the
// Urgent/High → Leadership escalation and title the push notification
// accordingly. Callers that only care about the name can keep using
// `?.name` as before.
type RoutingResult = { name: string; escalated: boolean }

async function applyRoutingRules(
  db: ReturnType<typeof createServiceClient>,
  company: string,
  priority: string,
  serviceType: string,
): Promise<RoutingResult | null> {
  if (priority === 'Urgent' || priority === 'High') {
    const { data: leader } = await db
      .from('team_members')
      .select('name')
      .eq('unit', 'Leadership')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (leader) return { name: leader.name, escalated: true }
  }

  const { data: rep } = await db
    .from('deals')
    .select('assigned_rep')
    .eq('company', company)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (rep?.assigned_rep) return { name: rep.assigned_rep, escalated: false }

  const unitMap: Record<string, string> = {
    'SEO': 'Delivery/Operations',
    'Web Design': 'Delivery/Operations',
    'Social Media': 'Delivery/Operations',
    'PPC': 'Delivery/Operations',
    'Billing': 'Billing/Finance',
    'General': 'Sales',
  }
  const unit = unitMap[serviceType]
  if (unit) {
    const { data: member } = await db
      .from('team_members')
      .select('name')
      .eq('unit', unit)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (member) return { name: member.name, escalated: false }
  }

  return null
}

export const POST = withErrorHandler('tickets POST', async (req: NextRequest) => {
  const body = await req.json()
  const result = validate(body, {
    subject: { required: true, type: 'string', maxLength: 500 },
    company: { required: true, type: 'string', maxLength: 200 },
    status: { type: 'string', enum: [...TICKET_STATUSES] },
    priority: { type: 'string', enum: [...TICKET_PRIORITIES] },
  })
  if (!result.valid) return validationError(result.error)

  // Portal clients (Tickets page's "New Ticket" form, source: 'Portal')
  // legitimately create their own tickets — requirePortalClient lets staff
  // through unconditionally and restricts portal clients to their own
  // company. This was previously blanket staff-only, which meant portal
  // clients could never actually submit a ticket through this route.
  const denied = await requirePortalClient(req, body.company)
  if (denied) return denied
  const today = new Date().toISOString().split('T')[0]
  const db = createServiceClient()

  let assignedTo: string | null = body.assignedTo ?? null
  // Only set when applyRoutingRules() actually auto-assigned the ticket
  // (not when the caller explicitly passed assignedTo) — that's the one
  // case AUDIT.md #486 asks for a push notification, and it's the only
  // case where we know whether this was a plain routing assignment or the
  // Urgent/High → Leadership escalation.
  let routing: RoutingResult | null = null
  if (!assignedTo) {
    routing = await applyRoutingRules(
      db,
      body.company ?? '',
      body.priority ?? 'Medium',
      body.serviceType ?? 'General',
    )
    assignedTo = routing?.name ?? null
  }

  const { data, error } = await db
    .from('tickets')
    .insert({
      id:            `tkt-${Date.now()}`,
      subject:       body.subject,
      company:       body.company ?? '',
      company_id:    body.companyId ?? null,
      contact_name:  body.contactName ?? null,
      contact_email: body.contactEmail ?? null,
      status:        body.status ?? 'Open',
      priority:      body.priority ?? 'Medium',
      source:        body.source ?? 'Email',
      service_type:  body.serviceType ?? 'General',
      project_id:    body.projectId ?? null,
      assigned_to:   assignedTo,
      tags:          body.tags ?? [],
      messages:      body.messages ?? [],
      created_date:  today,
      updated_date:  today,
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create ticket')
  }

  // AUDIT.md #486 — auto-assignment (including the Urgent/High →
  // Leadership escalation) never told the assignee. Best-effort: a push
  // failure must never turn a successful ticket creation into an error
  // response, same posture as lib/portal-notify.ts and the automations
  // engine's own push call sites.
  if (routing?.name) {
    try {
      const { data: assignee } = await db
        .from('team_members')
        .select('id')
        .eq('name', routing.name)
        .eq('status', 'active')
        .maybeSingle()
      if (assignee?.id && await shouldSendPushForEvent('ticket_created')) {
        await sendPushNotification({
          userId: assignee.id,
          title: routing.escalated ? 'Urgent ticket escalated to you' : 'New ticket assigned to you',
          body: `${body.subject} — ${body.company ?? ''}`,
          url: '/tickets',
        }).catch(() => {})
      }
    } catch (err) {
      console.error('[tickets] assignee push notification failed:', err)
    }
  }

  return NextResponse.json(mapTicket(data, true), { status: 201 })
})
