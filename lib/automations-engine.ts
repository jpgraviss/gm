import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { sendPushNotification } from '@/lib/push-notifications'
import { wrapBrandedEmail } from '@/lib/email-template'
import { contractMonthlyValue } from '@/lib/metrics'
import type { SupabaseClient } from '@supabase/supabase-js'

const TRIGGER_MAP: Record<string, string> = {
  'proposal_accepted':    'Proposal Accepted',
  'proposal_declined':    'Proposal Declined',
  'contract_executed':    'Contract Fully Executed',
  'contract_signed':      'Contract Fully Executed',
  'contract_sent':        'Contract Sent',
  'invoice_paid':         'Invoice Paid',
  'invoice_overdue':      'Invoice Overdue',
  'project_launched':     'Project Status = Launched',
  'deal_stage_changed':   'Deal Stage Changed',
  'contact_created':      'Contact Created',
  'form_submitted':       'Form Submitted',
  'renewal_90':           'Renewal Date Within 90 Days',
  'renewal_30':           'Renewal Date Within 30 Days',
  'sequence_reply':       'Sequence Contact Replied',
  'sequence_bounce':      'Sequence Contact Bounced',
  'sequence_completed':   'Sequence Completed',
  'meeting_booked':       'Meeting Booked',
}

// Post-migration every row stores objects; the bare-string variant is kept
// only as a defensive fallback for the migration window / any caller that
// hasn't been updated (normalizeAction() below handles both).
type RawAction = string | { type: string; config?: Record<string, unknown> }

interface AutomationRow {
  id: string
  name: string
  trigger: string
  actions: RawAction[]
  // Automation-level default config — merged in before each action's own
  // config, so a caller that never sets per-action config (e.g. the
  // sequence-level Automate tab, which only ever creates 1-2 actions) keeps
  // working unchanged. Real per-action config (AUDIT.md #12) lives on each
  // action object instead now — see ACTION_CONFIG_ADAPTERS.
  config?: Record<string, unknown>
  status: string
  runs: number
}

interface NormalizedAction {
  type: string
  config: Record<string, unknown>
}

function normalizeAction(action: RawAction): NormalizedAction {
  return typeof action === 'string' ? { type: action, config: {} } : { type: action.type, config: action.config ?? {} }
}

// Translates the automation builder's per-action config field names (what
// NodeConfigPanel in app/automation/builder/page.tsx actually collects)
// into the engine's own context keys (what each case in executeAction
// actually reads). These intentionally don't match 1:1 — the engine's
// verbose, prefixed names exist so a short generic key like `value` or
// `stage` in an action's own config can never collide with real trigger-
// event data spread into the same context later (deals/contracts/invoices
// all have real `value`/`stage` columns that are spread wholesale into
// triggerData; see AUDIT.md #12/#13 plan). Add a case here, not a context-
// key rename, if a new configurable action type is added.
const ACTION_CONFIG_ADAPTERS: Record<string, (cfg: Record<string, unknown>) => Record<string, unknown>> = {
  'Send Email Reminder': (cfg) => ({ emailSubject: cfg.subject, emailBody: cfg.body, fromName: cfg.fromName }),
  'Wait': (cfg) => ({ waitDuration: cfg.duration, waitUnit: cfg.unit }),
  'If/Else': (cfg) => ({ conditionField: cfg.field, conditionOperator: cfg.operator, conditionValue: cfg.value }),
  'Create Task': (cfg) => ({ taskTitle: cfg.title, taskAssignee: cfg.assignee, taskDueDateOffset: cfg.dueDateOffset }),
  'Update Contact': (cfg) => ({ updateField: cfg.field, updateValue: cfg.value }),
  'Create Deal': (cfg) => ({ dealName: cfg.dealName, dealStage: cfg.stage }),
  'Log Activity': (cfg) => ({ activityNote: cfg.note }),
  'Send Notification': (cfg) => ({ notifyTarget: cfg.target, notifyMessage: cfg.message }),
  'Add Tag': (cfg) => ({ tag: cfg.tag }),
  'Remove Tag': (cfg) => ({ tag: cfg.tag }),
}

function translateActionConfig(actionType: string, cfg: Record<string, unknown>): Record<string, unknown> {
  const adapter = ACTION_CONFIG_ADAPTERS[actionType]
  if (!adapter) return {}
  const translated = adapter(cfg)
  // Drop unset fields so they don't spread as `undefined`/`''` and clobber
  // a real default via `??` (which only falls back on null/undefined, not
  // on an empty string) — e.g. an unfilled Subject field must not silently
  // beat the engine's sensible default subject line.
  return Object.fromEntries(Object.entries(translated).filter(([, v]) => v !== undefined && v !== ''))
}

interface StepResult {
  name: string
  status: 'success' | 'failed' | 'skipped' | 'pending'
  duration_ms: number
  error?: string
}

interface RunRecord {
  id: string
  automation_id: string
  trigger_type: string
  trigger_data: Record<string, unknown>
  status: 'running' | 'completed' | 'failed' | 'waiting'
  started_at: string
  completed_at: string | null
  steps: StepResult[]
  error: string | null
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function fireAutomations(event: string, context: Record<string, unknown>) {
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
    executeWorkflow(auto, event, context, db).catch(err => {
      console.error(`[automations-engine] Failed to execute "${auto.name}":`, err)
    })
  }
}

export async function executeWorkflow(
  automation: AutomationRow,
  triggerType: string,
  triggerData: Record<string, unknown>,
  db?: SupabaseClient,
  isResume = false,
) {
  // Form-submission automations can be scoped to one specific form
  // (config.formScope === 'specific') rather than "any form" — the trigger
  // fetch above only matches on trigger label, so this is the only place
  // that actually narrows it to the configured form.
  if (automation.config?.formScope === 'specific' && automation.config?.formId !== triggerData.formId) {
    return { runId: null, status: 'skipped' as const, steps: [] }
  }

  const supabase = db ?? createServiceClient()
  const runId = `run-${uid()}`
  const startedAt = new Date().toISOString()
  const steps: StepResult[] = []
  let runStatus: RunRecord['status'] = 'running'
  let runError: string | null = null
  let skipRemaining = false

  await supabase.from('automation_runs').insert({
    id: runId,
    automation_id: automation.id,
    trigger_type: triggerType,
    trigger_data: triggerData,
    status: 'running',
    started_at: startedAt,
    completed_at: null,
    steps: [],
    error: null,
  }).then(() => {}, () => {})

  try {
    for (let i = 0; i < automation.actions.length; i++) {
      const { type: actionType, config: actionConfig } = normalizeAction(automation.actions[i])
      if (skipRemaining) {
        steps.push({ name: actionType, status: 'skipped', duration_ms: 0 })
        continue
      }

      const stepStart = Date.now()
      try {
        // Automation-level default, then this action's own config, then
        // real trigger event data — each layer only overriding what the
        // one before it didn't set, actual event data always wins on
        // conflict (AUDIT.md #12). `resumeContext` deliberately excludes
        // this action's own translated config — if this action is a Wait,
        // that's what gets persisted for the *next* action to resume with,
        // and a later action must never inherit an earlier Wait's own
        // config (e.g. Wait's `waitDuration` leaking into a subsequent
        // action's context — see AUDIT.md #12/#13 plan).
        const resumeContext = { ...automation.config, ...triggerData }
        const context = { ...automation.config, ...translateActionConfig(actionType, actionConfig), ...triggerData }
        const remainingActions = automation.actions.slice(i + 1)
        const result = await executeAction(actionType, context, supabase, automation.id, runId, i, resumeContext)
        steps.push({
          name: actionType,
          status: 'success',
          duration_ms: Date.now() - stepStart,
        })
        // Wait scheduled a resume — stop executing this pass entirely
        // instead of falling through to the next action (AUDIT.md #13).
        if (result?.paused) {
          runStatus = 'waiting'
          for (const remaining of remainingActions) {
            steps.push({ name: normalizeAction(remaining).type, status: 'pending', duration_ms: 0 })
          }
          break
        }
        if (result?.skipRemaining) {
          skipRemaining = true
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        steps.push({
          name: actionType,
          status: 'failed',
          duration_ms: Date.now() - stepStart,
          error: errorMsg,
        })
        runStatus = 'failed'
        runError = `Step "${actionType}" failed: ${errorMsg}`

        for (let j = steps.length; j < automation.actions.length; j++) {
          steps.push({
            name: normalizeAction(automation.actions[j]).type,
            status: 'skipped',
            duration_ms: 0,
          })
        }
        break
      }
    }

    if (runStatus !== 'failed' && runStatus !== 'waiting') {
      runStatus = 'completed'
    }

    // A resumed run is a continuation of the same logical trigger, not a
    // new one — only the original (non-resume) call counts toward runs/
    // last_run, so a Wait-paused-then-resumed execution isn't double-counted.
    if (!isResume) {
      await supabase
        .from('automations')
        .update({
          runs: (automation.runs ?? 0) + 1,
          last_run: new Date().toISOString(),
        })
        .eq('id', automation.id)
    }

    console.log(`[automations-engine] ${runStatus} "${automation.name}" (${automation.id}) — ${steps.filter(s => s.status === 'success').length}/${automation.actions.length} steps`)
  } catch (err) {
    runStatus = 'failed'
    runError = err instanceof Error ? err.message : String(err)
  }

  await supabase.from('automation_runs').update({
    status: runStatus,
    completed_at: runStatus === 'waiting' ? null : new Date().toISOString(),
    steps,
    error: runError,
  }).eq('id', runId).then(() => {}, () => {})

  return { runId, status: runStatus, steps }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeAction(
  action: string,
  context: Record<string, unknown>,
  db: any,
  automationId?: string,
  runId?: string,
  actionIndex = 0,
  resumeContext: Record<string, unknown> = {},
): Promise<{ paused?: boolean; skipRemaining?: boolean } | void> {
  const company = (context.company as string) ?? ''
  const today = new Date().toISOString().split('T')[0]

  switch (action) {
    case 'Send Email':
    case 'Send Email Reminder':
    case 'Send Follow-up Email': {
      if (!company) break
      const { data: contacts } = await db
        .from('crm_contacts')
        .select('emails, full_name')
        .eq('company_name', company)
        .order('is_primary', { ascending: false })
        .limit(1)
      const contact = contacts?.[0]
      if (!contact?.emails?.[0]) break

      const subject = (context.emailSubject as string) ?? `Update from GravHub — ${action}`
      const rawHtml = (context.emailBody as string) ?? `<p>Hi ${contact.full_name ?? 'there'},</p><p>This is an automated message regarding ${company}.</p>`
      const html = await wrapBrandedEmail(rawHtml, 'AUTOMATED NOTIFICATION')
      await sendEmail({ to: contact.emails[0], subject, html })
      break
    }

    case 'Create Task': {
      const title = (context.taskTitle as string) ?? `Auto task: ${company}`
      const assignee = (context.taskAssignee as string) ?? (context.assigned_rep as string) ?? ''
      const dueDateOffset = (context.taskDueDateOffset as number) ?? 1
      const dueDate = new Date(Date.now() + dueDateOffset * 86400000).toISOString().split('T')[0]
      await db.from('app_tasks').insert({
        id: `task-auto-${uid()}`,
        title,
        description: `Auto-created by automation for ${company}`,
        category: 'Automation',
        status: 'Pending',
        priority: 'High',
        assigned_to: assignee,
        due_date: dueDate,
        created_date: today,
      })
      break
    }

    case 'Add Tag': {
      const tag = (context.tag as string) ?? ''
      const contactId = (context.contactId as string) ?? (context.contact_id as string) ?? null
      if (!tag || !contactId) break
      const { data: existing } = await db
        .from('crm_contacts')
        .select('tags')
        .eq('id', contactId)
        .single()
      const currentTags: string[] = existing?.tags ?? []
      if (!currentTags.includes(tag)) {
        await db.from('crm_contacts').update({ tags: [...currentTags, tag] }).eq('id', contactId)
      }
      break
    }

    case 'Remove Tag': {
      const tag = (context.tag as string) ?? ''
      const contactId = (context.contactId as string) ?? (context.contact_id as string) ?? null
      if (!tag || !contactId) break
      const { data: existing } = await db
        .from('crm_contacts')
        .select('tags')
        .eq('id', contactId)
        .single()
      const currentTags: string[] = existing?.tags ?? []
      await db.from('crm_contacts').update({ tags: currentTags.filter(t => t !== tag) }).eq('id', contactId)
      break
    }

    case 'Update Contact': {
      const contactId = (context.contactId as string) ?? (context.contact_id as string) ?? null
      const field = (context.updateField as string) ?? ''
      const value = (context.updateValue as string) ?? ''
      if (!contactId || !field) break
      const fieldMap: Record<string, string> = {
        status: 'lead_status',
        lifecycle_stage: 'lifecycle_stage',
        owner: 'owner',
        source: 'source',
      }
      const dbField = fieldMap[field] ?? field
      await db.from('crm_contacts').update({ [dbField]: value }).eq('id', contactId)
      break
    }

    case 'Create Deal': {
      const dealName = (context.dealName as string) ?? `Deal for ${company}`
      const stage = (context.dealStage as string) ?? 'Lead'
      await db.from('deals').insert({
        id: `deal-auto-${uid()}`,
        company,
        stage,
        value: (context.value as number) ?? 0,
        service_type: (context.service_type as string) ?? 'General',
        assigned_rep: (context.assigned_rep as string) ?? '',
        probability: 0,
        notes: [{ text: dealName, date: today }],
        last_activity: today,
      })
      break
    }

    case 'Log Activity': {
      const note = (context.activityNote as string) ?? `[Auto] ${context.trigger ?? 'Automation'} for ${company}`
      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        type: 'Note',
        description: note,
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
        contact_id: (context.contactId as string) ?? (context.contact_id as string) ?? null,
        timestamp: new Date().toISOString(),
        logged_by: 'System',
      })
      break
    }

    case 'Send Notification': {
      const target = (context.notifyTarget as string) ?? 'assigned_rep'
      const message = (context.notifyMessage as string) ?? `Automation triggered for ${company}`

      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        type: 'Notification',
        description: `[Auto] ${message}`,
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
        contact_id: (context.contactId as string) ?? (context.contact_id as string) ?? null,
        timestamp: new Date().toISOString(),
        logged_by: 'System',
      })

      const targetUserIds: string[] = []
      if (target === 'assigned_rep') {
        const userId = (context.assigned_rep_user_id as string) ?? ''
        if (userId) targetUserIds.push(userId)
      } else {
        const unitMap: Record<string, string> = {
          sales_team: 'Sales',
          finance_team: 'Billing/Finance',
          delivery_team: 'Delivery',
          leadership: 'Leadership/Admin',
        }
        const unit = unitMap[target]
        if (unit) {
          const { data: members } = await db
            .from('team_members')
            .select('id')
            .eq('unit', unit)
            .eq('status', 'Active')
          for (const m of members ?? []) targetUserIds.push(m.id)
        }
      }

      for (const userId of targetUserIds) {
        sendPushNotification({
          userId,
          title: 'Automation Notification',
          body: message,
          url: '/automation',
        }).catch(() => {})
      }
      break
    }

    case 'Wait': {
      const duration = (context.waitDuration as number) ?? 1
      const unit = (context.waitUnit as string) ?? 'hours'
      let ms = duration * 60_000
      if (unit === 'hours') ms = duration * 3_600_000
      else if (unit === 'days') ms = duration * 86_400_000

      // Without a real automation id there's nothing to resume against —
      // matches the existing no-op fallback other actions use when they're
      // missing required context, rather than scheduling a resume that can
      // never be found again.
      if (!automationId || !runId) break

      // automation_pending_steps has no status column and no
      // remaining_actions column — it tracks resume position via
      // step_index (an index into the automation's own actions array) and
      // relies on the resumer re-fetching the automation fresh, rather
      // than freezing a snapshot of "what's left" at pause time. Confirmed
      // against the live schema (information_schema.columns), which
      // doesn't match what an earlier migration file in this repo assumed.
      const { error: pendingErr } = await db.from('automation_pending_steps').insert({
        id: `pending-${uid()}`,
        automation_id: automationId,
        run_id: runId,
        step_index: actionIndex + 1,
        resume_at: new Date(Date.now() + ms).toISOString(),
        // Deliberately resumeContext, not context — never this Wait step's
        // own translated config (see the caller's comment on resumeContext).
        context: resumeContext,
      })
      if (pendingErr) throw new Error(pendingErr.message || 'Failed to schedule Wait resume')
      return { paused: true }
    }

    case 'If/Else': {
      const field = (context.conditionField as string) ?? ''
      const operator = (context.conditionOperator as string) ?? 'equals'
      const compareValue = (context.conditionValue as string) ?? ''
      const actual = String((context as Record<string, unknown>)[field] ?? '')

      let matched = false
      switch (operator) {
        case 'equals':       matched = actual === compareValue; break
        case 'not_equals':   matched = actual !== compareValue; break
        case 'contains':     matched = actual.includes(compareValue); break
        case 'greater_than': matched = parseFloat(actual) > parseFloat(compareValue); break
        case 'less_than':    matched = parseFloat(actual) < parseFloat(compareValue); break
      }

      if (!matched) {
        // Condition not met — skip remaining actions gracefully (not an
        // error). Signaled via return value, not by mutating `context`
        // (that object is a fresh copy built per-action in the caller's
        // loop, so mutating it here never actually reached the loop's
        // check — this flag had never propagated in production).
        return { skipRemaining: true }
      }
      break
    }

    // Legacy actions from the simple automation panel
    case 'Create Draft Contract': {
      await db.from('contracts').insert({
        id: `c-auto-${uid()}`,
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
        id: `task-auto-${uid()}`,
        title: `${action}: ${company}`,
        description: `Auto-created by automation for ${company}`,
        category: action === 'Create Billing Task' ? 'Billing' : 'Renewal',
        status: 'Pending',
        priority: 'High',
        assigned_to: (context.assigned_rep as string) ?? '',
        due_date: today,
        created_date: today,
      })
      break
    }

    case 'Create Project Record': {
      await db.from('projects').insert({
        id: `proj-auto-${uid()}`,
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
        id: `maint-auto-${uid()}`,
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
      const notifMessage = `${action}: ${context.trigger ?? 'Automation triggered'} for ${company}`
      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        type: 'Notification',
        description: `[Auto] ${notifMessage}`,
        company_id: (context.companyId as string) ?? null,
        contact_id: (context.contactId as string) ?? null,
        timestamp: new Date().toISOString(),
        logged_by: 'System',
      })

      const unitMap: Record<string, string> = {
        'Notify Sales Rep': 'Sales',
        'Notify Finance Team': 'Billing/Finance',
        'Notify Delivery Team': 'Delivery',
        'Notify Assigned Rep': '',
      }
      const targetUnit = unitMap[action]
      if (targetUnit) {
        const { data: members } = await db
          .from('team_members')
          .select('id')
          .eq('unit', targetUnit)
          .eq('status', 'Active')
        for (const m of members ?? []) {
          sendPushNotification({ userId: m.id, title: action, body: notifMessage, url: '/automation' }).catch(() => {})
        }
      } else if (action === 'Notify Assigned Rep') {
        const repId = (context.assigned_rep_user_id as string) ?? ''
        if (repId) {
          sendPushNotification({ userId: repId, title: action, body: notifMessage, url: '/automation' }).catch(() => {})
        }
      }
      break
    }

    case 'Log Touchpoint': {
      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        type: 'Touchpoint',
        description: `[Auto] ${context.trigger ?? 'Automation'} for ${company}`,
        company_id: (context.companyId as string) ?? null,
        contact_id: (context.contactId as string) ?? null,
        timestamp: new Date().toISOString(),
        logged_by: 'System',
      })
      break
    }

    case 'Flag in Dashboard': {
      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        type: 'FLAG',
        description: `[Auto] Flagged for attention — ${context.trigger ?? action}`,
        company_id: (context.companyId as string) ?? null,
        timestamp: new Date().toISOString(),
        logged_by: 'System',
      })
      break
    }

    case 'Update Revenue Metrics': {
      const monthKey = new Date().toISOString().slice(0, 7)
      const { data: contracts } = await db
        .from('contracts')
        .select('value, billing_structure, status')
        .eq('status', 'Fully Executed')
      const totalRevenue = (contracts ?? []).reduce((s: number, c: { value: number | null; billing_structure: string | null }) =>
        s + contractMonthlyValue({ value: Number(c.value) || 0, billingStructure: c.billing_structure ?? '' }), 0)
      const recurring = (contracts ?? [])
        .filter((c: { billing_structure: string | null }) => {
          const bs = (c.billing_structure ?? '').toLowerCase()
          return !bs.includes('one') && !bs.includes('milestone') && !bs.includes('project')
        })
        .reduce((s: number, c: { value: number | null; billing_structure: string | null }) =>
          s + contractMonthlyValue({ value: Number(c.value) || 0, billingStructure: c.billing_structure ?? '' }), 0)
      await db.from('revenue_months').upsert(
        { month: monthKey, revenue: totalRevenue, recurring },
        { onConflict: 'month' }
      )
      break
    }

    case 'Apply Service Template': {
      const templateName = (context.templateName as string) ?? String(context.trigger ?? '')
      if (!templateName) break
      const { data: template } = await db
        .from('document_templates')
        .select('id, name, content')
        .ilike('name', `%${templateName}%`)
        .limit(1)
        .maybeSingle()
      if (!template) break
      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        type: 'Template',
        description: `[Auto] Applied service template "${template.name}" to ${company}`,
        company_id: (context.companyId as string) ?? null,
        timestamp: new Date().toISOString(),
        logged_by: 'System',
      })
      break
    }

    case 'Update Client Portal': {
      if (!company) break
      const { data: portalClients } = await db
        .from('portal_clients')
        .select('id')
        .eq('company', company)
      for (const pc of (portalClients ?? []) as Array<{ id: string }>) {
        await db.from('portal_notifications').insert({
          id: `pn-${uid()}`,
          portal_client_id: pc.id,
          type: 'system',
          title: `Update: ${context.trigger ?? action}`,
          message: (context.message as string) ?? `Your account has an update related to ${context.trigger ?? 'activity'}.`,
          link: '/portal',
          read: false,
          created_at: new Date().toISOString(),
        })
      }
      break
    }

    case 'Escalate if 7+ Days': {
      const dealId = (context.dealId as string) ?? null
      const ticketId = (context.ticketId as string) ?? null
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      let shouldEscalate = false
      if (dealId) {
        const { data: deal } = await db
          .from('deals')
          .select('last_activity, stage, company')
          .eq('id', dealId)
          .single()
        if (deal?.last_activity && new Date(deal.last_activity) < new Date(sevenDaysAgo)) {
          shouldEscalate = true
        }
      } else if (ticketId) {
        const { data: ticket } = await db
          .from('tickets')
          .select('created_date, status, company')
          .eq('id', ticketId)
          .single()
        if (ticket?.created_date && new Date(ticket.created_date) < new Date(sevenDaysAgo)) {
          shouldEscalate = true
        }
      }
      if (shouldEscalate) {
        await db.from('app_tasks').insert({
          id: `task-esc-${uid()}`,
          title: `Escalation: ${company} stuck 7+ days`,
          description: `[Auto] ${action} — review and advance or reassign`,
          category: 'Escalation',
          priority: 'High',
          status: 'Pending',
          company,
          assigned_to: 'Leadership',
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          created_date: today,
        })
      }
      break
    }

    case 'Enroll in Sequence': {
      // sequenceId (from automation.config, set by the sequence-level
      // Automate tab) is preferred — sequenceName is kept only for any
      // caller that still passes a name directly via trigger context.
      const seqId = (context.sequenceId as string) ?? ''
      const seqName = (context.sequenceName as string) ?? ''
      if (!seqId && !seqName) break
      let seqQuery = db.from('sequences').select('id, steps, enrolled_count, active_count').eq('status', 'Active')
      seqQuery = seqId ? seqQuery.eq('id', seqId) : seqQuery.eq('name', seqName)
      const { data: targetSeq } = await seqQuery.single()
      if (!targetSeq) break

      let contactEmail = (context.contactEmail as string) ?? ''
      let contactName = (context.contactName as string) ?? ''
      const contactId = (context.contactId as string) ?? null
      // Some triggers (e.g. form_submitted) only pass contactId, with the
      // submitted email/name buried in a per-form data blob rather than a
      // standard field — resolve from the CRM record instead of trying to
      // guess a form's field names.
      if (!contactEmail && contactId) {
        const { data: contactRow } = await db.from('crm_contacts').select('emails, full_name').eq('id', contactId).maybeSingle()
        contactEmail = contactRow?.emails?.[0] ?? ''
        contactName = contactName || contactRow?.full_name || ''
      }
      if (!contactEmail) break

      const { data: suppressed } = await db
        .from('sequence_suppression_list')
        .select('id')
        .eq('email', contactEmail)
        .single()
      if (suppressed) break

      // One active sequence at a time — same rule enforced by the manual
      // enrollment route (app/api/sequences/[id]/enroll/route.ts).
      const { data: activeElsewhere } = await db
        .from('sequence_enrollments')
        .select('id')
        .eq('contact_email', contactEmail)
        .eq('status', 'active')
        .single()
      if (activeElsewhere) break

      // Dynamic sender resolution — set by the automation's config.senderType.
      // 'contact_owner': send from whoever this contact's assigned rep is
      // (crm_contacts.owner_id). 'specific_user': always the configured user.
      // Neither: leave null, execute/route.ts falls back to the sequence's
      // own default assigned_rep_id.
      let enrollmentRepId: string | null = null
      const senderType = context.senderType as string | undefined
      if (senderType === 'contact_owner' && contactId) {
        const { data: contactRow } = await db.from('crm_contacts').select('owner_id').eq('id', contactId).maybeSingle()
        enrollmentRepId = contactRow?.owner_id ?? null
      } else if (senderType === 'specific_user') {
        enrollmentRepId = (context.senderUserId as string) ?? null
      }

      const seqSteps = targetSeq.steps ?? []
      const firstDay = seqSteps[0]?.day ?? 0
      const now = new Date()

      // The activeElsewhere check above is a fast pre-filter, not the
      // source of truth — a partial unique index on sequence_enrollments
      // (contact_email) where status='active' is the real "one sequence
      // at a time" guarantee (AUDIT.md #44), so a conflict here just
      // means another request won the race; skip silently.
      const { error: enrollErr } = await db.from('sequence_enrollments').insert({
        id: `enr-auto-${uid()}`,
        sequence_id: targetSeq.id,
        contact_id: contactId,
        contact_name: contactName,
        contact_email: contactEmail,
        current_step: 0,
        status: 'active',
        next_send_at: new Date(now.getTime() + firstDay * 86400000).toISOString(),
        company: company || null,
        assigned_rep_id: enrollmentRepId,
      })
      if (enrollErr) {
        if (enrollErr.code === '23505') break
        throw new Error(enrollErr.message || 'Failed to enroll contact')
      }

      await db.from('sequences').update({
        enrolled_count: (targetSeq.enrolled_count ?? 0) + 1,
        active_count: (targetSeq.active_count ?? 0) + 1,
      }).eq('id', targetSeq.id)
      break
    }

    case 'Unenroll from Sequence': {
      let contactEmail = (context.contactEmail as string) ?? ''
      const unenrollContactId = (context.contactId as string) ?? null
      if (!contactEmail && unenrollContactId) {
        const { data: contactRow } = await db.from('crm_contacts').select('emails').eq('id', unenrollContactId).maybeSingle()
        contactEmail = contactRow?.emails?.[0] ?? ''
      }
      if (!contactEmail) break
      const { data: activeEnrollments } = await db
        .from('sequence_enrollments')
        .select('id, sequence_id')
        .eq('contact_email', contactEmail)
        .eq('status', 'active')

      for (const enr of activeEnrollments ?? []) {
        await db.from('sequence_enrollments')
          .update({ status: 'unenrolled', unenroll_reason: 'automation' })
          .eq('id', enr.id)

        const { data: seq } = await db.from('sequences')
          .select('active_count').eq('id', enr.sequence_id).single()
        if (seq) {
          await db.from('sequences')
            .update({ active_count: Math.max(0, (seq.active_count ?? 1) - 1) })
            .eq('id', enr.sequence_id)
        }
      }
      break
    }

    case 'Rotate Contact Owner': {
      // config.unit: which team_members.unit to rotate across (e.g. 'Sales').
      // Rotation position is tracked durably in rotation_state, keyed by
      // this automation's id, so it survives across cold starts instead of
      // resetting to the same first rep every run.
      const unit = context.unit as string | undefined
      const contactId = (context.contactId as string) ?? null
      if (!unit || !contactId || !automationId) break

      const { data: members } = await db
        .from('team_members')
        .select('id, name')
        .eq('unit', unit)
        .eq('status', 'Active')
        .order('id', { ascending: true })
      if (!members || members.length === 0) break

      // Atomic — the increment happens inside the DB's UPSERT so two
      // automations firing at nearly the same instant can't both read the
      // same last_index and assign the same rep (see AUDIT.md #43).
      const { data: nextIndex, error: rotationErr } = await db.rpc('next_rotation_index', {
        p_automation_id: automationId,
        p_member_count: members.length,
      })
      if (rotationErr || nextIndex === null || nextIndex === undefined) break
      const nextRep = members[nextIndex % members.length]

      await db.from('crm_contacts').update({ owner_id: nextRep.id, owner: nextRep.name }).eq('id', contactId)
      break
    }

    default:
      console.warn(`[automations-engine] Unknown action: ${action}`)
  }
}
