import { createServiceClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActivityType } from '@/lib/types'

/**
 * Cross-module CRM activity logging.
 *
 * Before this existed, `crm_activities` was only ever written by the email/
 * Gmail paths, sequence execution, and a handful of opt-in automation
 * actions — Finance (invoices), Operations (projects), and Support (tickets)
 * never wrote to it at all. That made a company's "Activity" tab an
 * email-and-proposal log wearing a unified-timeline label: an invoice could
 * be raised and paid, a project could run start to finish, and a client
 * could open and resolve three tickets, and none of it appeared on the one
 * screen staff open to answer "what's been happening with this client?"
 *
 * Every call here is best-effort and never throws — an activity-log write
 * failing must never turn a successful invoice/project/ticket mutation into
 * an error response, the same posture as lib/portal-notify.ts and the
 * automations engine's push-notification call sites.
 */

export interface LogActivityInput {
  type: ActivityType
  title: string
  body?: string
  companyId?: string | null
  companyName?: string | null
  contactId?: string | null
  contactName?: string | null
  dealId?: string | null
  /** Defaults to 'System' — pass a real actor name when one is known. */
  userName?: string
  outcome?: string | null
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function logActivity(input: LogActivityInput, client?: SupabaseClient): Promise<void> {
  try {
    // company_id is a real FK to crm_companies; a stale/blank string would
    // fail the constraint and lose the row, so normalize empties to null.
    const companyId = input.companyId || null
    const db = client ?? createServiceClient()
    const { error } = await db.from('crm_activities').insert({
      id: `act-${uid()}`,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      company_id: companyId,
      company_name: input.companyName ?? null,
      contact_id: input.contactId || null,
      contact_name: input.contactName ?? null,
      deal_id: input.dealId || null,
      user_name: input.userName || 'System',
      timestamp: new Date().toISOString(),
      outcome: input.outcome ?? null,
    })
    if (error) {
      console.error('[activity-log] insert failed:', error.message)
    }
  } catch (err) {
    console.error('[activity-log] unexpected failure:', err instanceof Error ? err.message : err)
  }
}
