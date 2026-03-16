import { createServiceClient } from '@/lib/supabase'

/**
 * Automation execution engine.
 * Call fireAutomations() from API routes after data mutations.
 * Execution is async and non-blocking — call without await.
 */

// Map UI trigger names to the event strings we fire
const TRIGGER_MAP: Record<string, string> = {
  'proposal_accepted':    'Proposal Accepted',
  'proposal_declined':    'Proposal Declined',
  'contract_executed':    'Contract Fully Executed',
  'contract_sent':        'Contract Sent',
  'invoice_paid':         'Invoice Paid',
  'invoice_overdue':      'Invoice Overdue',
  'project_launched':     'Project Status = Launched',
  'deal_stage_changed':   'Deal Stage Changed',
  'contact_created':      'Contact Created',
  'renewal_90':           'Renewal Date Within 90 Days',
  'renewal_30':           'Renewal Date Within 30 Days',
}

interface AutomationRow {
  id: string
  name: string
  trigger: string
  actions: string[]
  status: string
  runs: number
}

export function fireAutomations(event: string, context: Record<string, unknown>) {
  // Fire and forget — don't block the API response
  executeAutomations(event, context).catch(err => {
    console.error(`[automations-engine] Error executing automations for ${event}:`, err)
  })
}

async function executeAutomations(event: string, context: Record<string, unknown>) {
  const triggerLabel = TRIGGER_MAP[event]
  if (!triggerLabel) {
    console.warn(`[automations-engine] Unknown event: ${event}`)
    return
  }

  const db = createServiceClient()

  // Find active automations matching this trigger
  const { data: automations, error } = await db
    .from('automations')
    .select('*')
    .eq('trigger', triggerLabel)
    .eq('status', 'Active')

  if (error) {
    console.error('[automations-engine] Failed to fetch automations:', error)
    return
  }

  if (!automations || automations.length === 0) return

  for (const auto of automations as AutomationRow[]) {
    try {
      for (const action of auto.actions) {
        await executeAction(action, context, db)
      }

      // Update runs count and last_run
      await db
        .from('automations')
        .update({
          runs: (auto.runs ?? 0) + 1,
          last_run: new Date().toISOString(),
        })
        .eq('id', auto.id)

      console.log(`[automations-engine] Executed "${auto.name}" (${auto.id}) for ${triggerLabel}`)
    } catch (err) {
      console.error(`[automations-engine] Failed to execute "${auto.name}":`, err)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAction(action: string, context: Record<string, unknown>, db: any) {
  const company = (context.company as string) ?? ''
  const today = new Date().toISOString().split('T')[0]

  switch (action) {
    case 'Create Draft Contract': {
      await db.from('contracts').insert({
        id: `c-auto-${Date.now()}`,
        proposal_id: (context.proposalId as string) ?? null,
        company,
        status: 'Draft',
        value: (context.value as number) ?? 0,
        billing_structure: 'Monthly',
        start_date: today,
        duration: 12,
        renewal_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        assigned_rep: (context.assigned_rep as string) ?? '',
        service_type: (context.service_type as string) ?? 'General',
      })
      break
    }

    case 'Create Billing Task':
    case 'Create Renewal Task': {
      await db.from('app_tasks').insert({
        id: `task-auto-${Date.now()}`,
        title: `${action}: ${company}`,
        description: `Auto-created by automation for ${company}`,
        status: 'To Do',
        priority: 'High',
        assigned_to: (context.assigned_rep as string) ?? '',
        due_date: today,
        project_id: (context.project_id as string) ?? null,
      })
      break
    }

    case 'Create Project Record': {
      await db.from('projects').insert({
        id: `proj-auto-${Date.now()}`,
        company,
        service_type: (context.service_type as string) ?? 'General',
        status: 'Not Started',
        progress: 0,
        contract_id: (context.contractId as string) ?? null,
        milestones: [],
      })
      break
    }

    case 'Create Maintenance Record': {
      await db.from('maintenance_records').insert({
        id: `maint-auto-${Date.now()}`,
        company,
        service_type: (context.service_type as string) ?? 'General',
        status: 'Active',
        contract_id: (context.contractId as string) ?? null,
      })
      break
    }

    case 'Notify Sales Rep':
    case 'Notify Finance Team':
    case 'Notify Delivery Team':
    case 'Notify Assigned Rep': {
      // Log as an activity for now — email notifications can be added when team notification preferences exist
      await db.from('crm_activities').insert({
        id: `act-auto-${Date.now()}`,
        type: 'Notification',
        description: `[Auto] ${action}: ${context.trigger ?? 'Automation triggered'} for ${company}`,
        company_id: (context.companyId as string) ?? null,
        contact_id: (context.contactId as string) ?? null,
        timestamp: new Date().toISOString(),
        logged_by: 'System',
      })
      break
    }

    case 'Send Email Reminder':
    case 'Send Follow-up Email': {
      // These require a recipient — look up primary contact for the company
      if (!company) break
      const { data: contacts } = await db
        .from('crm_contacts')
        .select('emails, full_name')
        .eq('company_name', company)
        .order('is_primary', { ascending: false })
        .limit(1)
      const contact = contacts?.[0]
      if (!contact?.emails?.[0]) break

      // Use internal fetch to send via existing email infrastructure
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/email/send-proposal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId: context.proposalId }),
        })
      } catch {
        console.warn(`[automations-engine] Could not send ${action} email for ${company}`)
      }
      break
    }

    case 'Log Activity':
    case 'Log Touchpoint': {
      await db.from('crm_activities').insert({
        id: `act-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: action === 'Log Touchpoint' ? 'Touchpoint' : 'Note',
        description: `[Auto] ${context.trigger ?? 'Automation'} for ${company}`,
        company_id: (context.companyId as string) ?? null,
        contact_id: (context.contactId as string) ?? null,
        timestamp: new Date().toISOString(),
        logged_by: 'System',
      })
      break
    }

    case 'Flag in Dashboard':
    case 'Update Revenue Metrics':
    case 'Apply Service Template':
    case 'Update Client Portal':
    case 'Escalate if 7+ Days': {
      // These are informational — log as activity for audit trail
      await db.from('crm_activities').insert({
        id: `act-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'System',
        description: `[Auto] ${action} triggered for ${company}`,
        company_id: (context.companyId as string) ?? null,
        timestamp: new Date().toISOString(),
        logged_by: 'System',
      })
      break
    }

    default:
      console.warn(`[automations-engine] Unknown action: ${action}`)
  }
}
