import { createServiceClient } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push-notifications'
import { shouldSendPushForEvent } from '@/lib/notification-preferences'

// Shared by every ticket-creation path (staff/portal POST in
// app/api/tickets/route.ts, inbound-email creation in
// app/api/tickets/from-email/route.ts, AUDIT #518) so auto-assignment,
// Urgent/High escalation, and the #486 push notification behave identically
// regardless of how the ticket was created.

// AUDIT.md #486 — result also says *why* someone was assigned, so callers
// can tell a plain routing assignment apart from the Urgent/High →
// Leadership escalation and title the push notification accordingly.
export type RoutingResult = { name: string; escalated: boolean }

export async function applyRoutingRules(
  db: ReturnType<typeof createServiceClient>,
  company: string,
  priority: string,
  serviceType: string,
): Promise<RoutingResult | null> {
  if (priority === 'Urgent' || priority === 'High') {
    // AUDIT #618 — the real OccupationalUnit value is 'Leadership/Admin'
    // (lib/types.ts); 'Leadership' never matches any team member, so this
    // escalation silently never fired and every Urgent/High ticket fell
    // through to deal-rep/unitMap routing instead.
    const { data: leader } = await db
      .from('team_members')
      .select('name')
      .eq('unit', 'Leadership/Admin')
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

  // AUDIT #593 — keys must match lib/services.ts's real SERVICE_NAMES
  // catalog (NewTicketPanel.tsx's dropdown is built from the same list);
  // the old keys ('SEO', 'Web Design', 'PPC', 'Billing') drifted from it
  // and matched nothing, so most staff-created tickets fell through
  // unassigned. Marketing-lane services route to Delivery/Operations,
  // Sales-lane services to Sales, matching the org's real unit structure.
  const unitMap: Record<string, string> = {
    'Website Build': 'Delivery/Operations',
    'Website Management': 'Delivery/Operations',
    'SEO / AEO': 'Delivery/Operations',
    'Social Media': 'Delivery/Operations',
    'Email Marketing': 'Delivery/Operations',
    'Fractional CMO': 'Delivery/Operations',
    'Sales Training': 'Sales',
    'Sales Enablement': 'Sales',
    'Sales Coaching': 'Sales',
    'Sales Enablement Support': 'Sales',
    'Fractional Sales Lead / CRO': 'Sales',
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

// Best-effort: a push failure must never turn a successful ticket creation
// into an error response, same posture as lib/portal-notify.ts and the
// automations engine's own push call sites.
export async function notifyRoutedAssignee(
  db: ReturnType<typeof createServiceClient>,
  routing: RoutingResult | null,
  subject: string,
  company: string,
) {
  if (!routing?.name) return
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
        body: `${subject} — ${company ?? ''}`,
        url: '/tickets',
      }).catch(() => {})
    }
  } catch (err) {
    console.error('[tickets] assignee push notification failed:', err)
  }
}
