import { createServiceClient } from '@/lib/supabase'

// Rule-based "what should I do today" suggestions for a rep, deliberately
// not LLM-generated — every suggestion here is a direct readout of real
// data (stale deals, recently active contacts, close dates, meetings),
// matching the anti-fabrication pattern established elsewhere this session
// (report recommendations, deal score).

export interface GuidedAction {
  id: string
  title: string
  detail: string
  href: string
  urgent: boolean
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}

export async function getGuidedActions(repName: string, repEmail: string, ownerId: string): Promise<GuidedAction[]> {
  const db = createServiceClient()
  const actions: GuidedAction[] = []
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
  const sevenDaysAhead = new Date(now.getTime() + 7 * 86400000)

  // 1 & 2. Stale open deals + deals closing this week — deals.assigned_rep is
  // a free-text name (no FK, unlike crm_contacts.owner_id), so this matches
  // by name. Stage is filtered client-side rather than via a string-built
  // "not in" query filter, since that syntax can't be verified against a
  // live DB from this environment.
  const { data: allRepDeals } = await db
    .from('deals')
    .select('id, company, last_activity, close_date, stage')
    .eq('assigned_rep', repName)

  const openDeals = (allRepDeals ?? []).filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost')

  const staleDeals = openDeals.filter(d => !d.last_activity || new Date(d.last_activity) < sevenDaysAgo)
  if (staleDeals.length > 0) {
    actions.push({
      id: 'stale-deals',
      title: `Follow up on ${staleDeals.length} stale deal${staleDeals.length === 1 ? '' : 's'}`,
      detail: `No activity logged in 7+ days: ${staleDeals.slice(0, 3).map(d => d.company).join(', ')}${staleDeals.length > 3 ? '…' : ''}`,
      href: '/crm/pipeline',
      urgent: true,
    })
  }

  const closingDeals = openDeals.filter(d => d.close_date && new Date(d.close_date) >= now && new Date(d.close_date) <= sevenDaysAhead)
  if (closingDeals.length > 0) {
    actions.push({
      id: 'closing-soon',
      title: `${closingDeals.length} deal${closingDeals.length === 1 ? '' : 's'} closing this week`,
      detail: closingDeals.slice(0, 3).map(d => d.company).join(', ') + (closingDeals.length > 3 ? '…' : ''),
      href: '/crm/pipeline',
      urgent: false,
    })
  }

  // 3. Contacts owned by this rep who engaged recently (real FK — Phase 0)
  if (ownerId) {
    const { data: contacts } = await db
      .from('crm_contacts')
      .select('id, full_name, company_name, last_activity')
      .eq('owner_id', ownerId)
      .gte('last_activity', sevenDaysAgo.toISOString().split('T')[0])

    if (contacts && contacts.length > 0) {
      actions.push({
        id: 'recently-engaged',
        title: `${contacts.length} lead${contacts.length === 1 ? '' : 's'} recently engaged`,
        detail: `Active in the last 7 days: ${contacts.slice(0, 3).map(c => c.full_name).join(', ')}${contacts.length > 3 ? '…' : ''}`,
        href: '/crm/contacts',
        urgent: false,
      })
    }
  }

  // 4. Meetings in the past week — a count, not a claim about whether
  // follow-up already happened (no data exists to verify that).
  if (repEmail) {
    const { data: calSettings } = await db
      .from('calendar_settings')
      .select('slug')
      .eq('user_email', repEmail)
      .maybeSingle()

    if (calSettings?.slug) {
      const { data: bookings } = await db
        .from('bookings')
        .select('id')
        .eq('calendar_slug', calSettings.slug)
        .eq('status', 'confirmed')
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .lt('date', now.toISOString().split('T')[0])

      if (bookings && bookings.length > 0) {
        actions.push({
          id: 'recent-meetings',
          title: `${bookings.length} meeting${bookings.length === 1 ? '' : 's'} in the past week`,
          detail: 'Worth checking whether any need a follow-up.',
          href: '/calendar',
          urgent: false,
        })
      }
    }
  }

  return actions
}

export function daysSinceLabel(dateStr: string): string {
  const days = daysBetween(new Date(), new Date(dateStr))
  return days <= 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`
}
