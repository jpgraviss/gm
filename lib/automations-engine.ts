import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { sendPushNotification } from '@/lib/push-notifications'
import { wrapBrandedEmail } from '@/lib/email-template'
import { getSettings } from '@/lib/settings'
import { shouldSendPushForEvent } from '@/lib/notification-preferences'
import { contractMonthlyValue } from '@/lib/metrics'
import { contractPeriodAmount, isRecurringStructure } from '@/lib/recurring-billing'
import { sendInvoiceEmail } from '@/lib/invoice-send'
import { getFirstPipelineStageName } from '@/lib/pipelines'
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
  // Delivery/Operations and Client Support previously had NO usable triggers
  // at all — 'project_launched' existed here but was only ever fired by a
  // dead endpoint with zero callers, so an entire half of the business was
  // invisible to the automation engine in both directions.
  'project_status_changed': 'Project Status Changed',
  'project_completed':    'Project Completed',
  'task_completed':       'Task Completed',
  'ticket_created':       'Ticket Created',
  'ticket_replied':       'Ticket Reply Received',
  'deal_stage_changed':   'Deal Stage Changed',
  'contact_created':      'Contact Created',
  'form_submitted':       'Form Submitted',
  'renewal_90':           'Renewal Date Within 90 Days',
  'renewal_30':           'Renewal Date Within 30 Days',
  'sequence_reply':       'Sequence Contact Replied',
  'sequence_bounce':      'Sequence Contact Bounced',
  'sequence_completed':   'Sequence Completed',
  'webhook_received':     'Webhook Received',
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
  // AUDIT.md #295 — previously had no adapter at all, so the visual builder
  // (app/automation/builder/page.tsx) had no way to actually reach the
  // engine's `context.unit` read in the 'Rotate Contact Owner' case below —
  // the action was only ever reachable via SequenceAutomateTab's bespoke
  // automation-level config.unit, and only against the Form Submitted
  // trigger, which the action's own _publicSource gate always blocks. Kept
  // unprefixed (`unit`, not e.g. `rotateUnit`) to match the engine's
  // existing read — safe here since this action is only meaningful against
  // the Contact Created trigger, whose trigger data (a crm_contacts row)
  // has no `unit` column to collide with.
  'Rotate Contact Owner': (cfg) => ({ unit: cfg.unit }),
  // AUDIT.md #524 — previously had no adapter at all, so the builder's
  // config had nowhere real to go even after a template picker was added.
  'Apply Service Template': (cfg) => ({ templateId: cfg.templateId }),
  'Create Invoice': (cfg) => ({ invoiceAmount: cfg.amount, invoiceServiceType: cfg.serviceType, invoiceDueDays: cfg.dueDays }),
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
  // Index into the automation's ORIGINAL, full actions array that this
  // call's `automation.actions` starts at. 0 for a fresh trigger. On
  // resume, cron passes a truncated slice as `automation.actions` — without
  // this offset, a second Wait step's step_index would be computed
  // relative to that truncated array (loop-local index 0), not the
  // original array cron re-slices from next time, causing the resumed
  // range to be wrong and the same actions to re-execute forever.
  indexOffset = 0,
  // When resuming a paused run, the run_id of the ORIGINAL automation_runs
  // row (from the pending step) plus that row's steps recorded before the
  // pause. Reusing the id (instead of minting a new one) means the final
  // status update below lands on the same row the pause left at 'waiting',
  // so it actually finalizes to 'completed'/'failed' instead of being
  // orphaned forever alongside a second, disconnected run for the same
  // logical trigger. priorSteps seeds step history so the resumed run's
  // steps append onto what already happened, not overwrite it.
  resumeRunId?: string,
  priorSteps: StepResult[] = [],
) {
  // Form-submission automations can be scoped to one specific form
  // (config.formScope === 'specific') rather than "any form" — the trigger
  // fetch above only matches on trigger label, so this is the only place
  // that actually narrows it to the configured form.
  if (automation.config?.formScope === 'specific' && automation.config?.formId !== triggerData.formId) {
    return { runId: null, status: 'skipped' as const, steps: [] }
  }

  // Deal-stage automations can be scoped to one target stage (builder's
  // "Target Stage" field) rather than any stage change — previously
  // collected in the UI but discarded on save (AUDIT #110), so this check
  // never had anything to read regardless.
  if (automation.config?.stage && automation.config.stage !== triggerData.stage) {
    return { runId: null, status: 'skipped' as const, steps: [] }
  }

  // Invoice-overdue automations can target a specific overdue threshold.
  // checkTimeBasedTriggers() only ever fires two real checkpoints today —
  // the initial Sent→Overdue transition (triggerData.overdueDays unset,
  // i.e. day 0) and the 3-day-overdue recheck (overdueDays: 3) — so an
  // exact match against those is what's actually achievable without a
  // larger cron rework to support arbitrary per-automation thresholds.
  if (
    triggerType === 'invoice_overdue' &&
    automation.config?.overdueDays !== undefined &&
    automation.config.overdueDays !== (triggerData.overdueDays ?? 0)
  ) {
    return { runId: null, status: 'skipped' as const, steps: [] }
  }

  // Webhook-triggered automations are matched broadly by trigger label
  // (any 'Webhook Received' automation), same as every other trigger — this
  // is what actually narrows it to the ONE automation the incoming request
  // was addressed to. Every webhook automation must have its own token
  // (the builder generates one on save); an automation somehow saved
  // without one can never fire, rather than firing on every webhook call.
  if (
    triggerType === 'webhook_received' &&
    (!automation.config?.webhookToken || automation.config.webhookToken !== triggerData.webhookToken)
  ) {
    return { runId: null, status: 'skipped' as const, steps: [] }
  }

  // AUDIT.md #554 — sequence_reply/sequence_bounce/sequence_completed are
  // inherently scoped to the one sequence a user configured them under
  // (created via SequenceAutomateTab, never the general-purpose builder,
  // which has no sequence picker). The trigger fetch above only matches on
  // trigger label — same as every other trigger — so without this check an
  // automation built for Sequence A's replies would fire for every
  // sequence's replies company-wide. Requires an exact match rather than
  // "skip only if set and different," so an automation somehow saved
  // without a sequenceId can never fire broadly by accident.
  if (
    ['sequence_reply', 'sequence_bounce', 'sequence_completed'].includes(triggerType) &&
    automation.config?.sequenceId !== triggerData.sequenceId
  ) {
    return { runId: null, status: 'skipped' as const, steps: [] }
  }

  const supabase = db ?? createServiceClient()
  const runId = resumeRunId ?? `run-${uid()}`
  const startedAt = new Date().toISOString()
  const steps: StepResult[] = [...priorSteps]
  let runStatus: RunRecord['status'] = 'running'
  let runError: string | null = null
  let skipRemaining = false

  if (!resumeRunId) {
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
  }

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
        const result = await executeAction(actionType, context, supabase, automation.id, runId, indexOffset + i, resumeContext, triggerType)
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

// Contract/invoice/proposal triggers carry a `company` name but have no
// contact FK (unlike deals), so contactId is never in context for them.
// Falls back to the same "primary contact for this company" lookup Send
// Email already does, instead of silently no-oping every contact-targeting
// action for every trigger that isn't deal-based.
async function resolveContactId(context: Record<string, unknown>, company: string, db: SupabaseClient): Promise<string | null> {
  const direct = (context.contactId as string) ?? (context.contact_id as string) ?? null
  if (direct) return direct
  if (!company) return null
  const { data: contacts } = await db
    .from('crm_contacts')
    .select('id')
    .eq('company_name', company)
    .order('is_primary', { ascending: false })
    .limit(1)
  return contacts?.[0]?.id ?? null
}

// `assigned_rep_user_id` is never set anywhere in the app — every trigger
// only ever spreads a DB row's `assigned_rep`, which is plain text (a
// name), not a user id. Without this fallback, "Assigned Rep" notification
// targeting (both the Send Notification action and the standalone Notify
// Assigned Rep action) silently resolved zero recipients on every run.
async function resolveAssignedRepUserId(context: Record<string, unknown>, db: SupabaseClient): Promise<string | null> {
  const direct = (context.assigned_rep_user_id as string) ?? null
  if (direct) return direct
  const repName = (context.assigned_rep as string) ?? ''
  if (!repName) return null
  const { data: member } = await db
    .from('team_members')
    .select('id')
    .eq('name', repName)
    .eq('status', 'active')
    .maybeSingle()
  return member?.id ?? null
}

async function executeAction(
  action: string,
  context: Record<string, unknown>,
  db: SupabaseClient,
  automationId?: string,
  runId?: string,
  actionIndex = 0,
  resumeContext: Record<string, unknown> = {},
  // The raw event key passed to fireAutomations() (e.g. 'deal_stage_changed')
  // that caused this action to run — the only place in this flow where the
  // notification's event type is actually known. Used to gate real push
  // sends below against Settings > Notifications (AUDIT.md #406).
  triggerType?: string,
): Promise<{ paused?: boolean; skipRemaining?: boolean } | void> {
  const company = (context.company as string) ?? ''
  const today = new Date().toISOString().split('T')[0]

  switch (action) {
    case 'Send Email':
    case 'Send Email Reminder':
    case 'Send Follow-up Email': {
      // form_submitted (and other contact-only triggers) never populate
      // `company` in context — only requiring it meant Send Email was
      // structurally dead on the most intuitive builder combo ("Form
      // Submitted" -> "Send Email"). resolveContactId already falls back
      // from a direct contactId to a company-name lookup; do the same here
      // instead of requiring company up front.
      const contactId = await resolveContactId(context, company, db)
      if (!contactId) break
      const { data: contact } = await db
        .from('crm_contacts')
        .select('emails, full_name')
        .eq('id', contactId)
        .maybeSingle()
      if (!contact?.emails?.[0]) break

      const subject = (context.emailSubject as string) ?? `Update from GravHub — ${action}`
      const rawHtml = (context.emailBody as string) ?? `<p>Hi ${contact.full_name ?? 'there'},</p><p>This is an automated message regarding ${company || 'your account'}.</p>`
      const html = await wrapBrandedEmail(rawHtml, 'AUTOMATED NOTIFICATION')
      const fromName = context.fromName as string | undefined
      const from = fromName ? `${fromName} <${(await getSettings()).email.fromEmail}>` : undefined
      await sendEmail({ to: contact.emails[0], subject, html, from })
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
      const contactId = await resolveContactId(context, company, db)
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
      const contactId = await resolveContactId(context, company, db)
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
      const contactId = await resolveContactId(context, company, db)
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
      const update: Record<string, unknown> = { [dbField]: value }
      // AUDIT #611 — the "Owner" field only wrote the display-only `owner`
      // text column, never the real `owner_id` FK that dynamic
      // sequence-sender resolution (senderType: 'contact_owner') and the
      // "Recently engaged leads" widget actually read, matching the
      // owner_id write 'Rotate Contact Owner' already does. If the typed
      // name doesn't match an active team member, leave owner_id
      // untouched rather than nulling out a previously-valid one.
      if (dbField === 'owner') {
        if (value) {
          const { data: matchedOwner } = await db
            .from('team_members')
            .select('id')
            .eq('name', value)
            .eq('status', 'active')
            .maybeSingle()
          if (matchedOwner) update.owner_id = matchedOwner.id
        } else {
          // AUDIT #646 — clearing the Owner field only blanked the display
          // `owner` column, leaving `owner_id` (read by sequence-sender
          // resolution and the "Recently engaged leads" widget) pointing
          // at the previous owner.
          update.owner_id = null
        }
      }
      await db.from('crm_contacts').update(update).eq('id', contactId)
      break
    }

    case 'Create Deal': {
      let dealCompany = company
      let dealCompanyId = (context.companyId as string) ?? (context.company_id as string) ?? null
      const dealContactId = (context.contactId as string) ?? (context.contact_id as string) ?? null
      // form_submitted/funnel_submitted never populate `company` in context
      // (only contactId) — without this fallback, a deal auto-created from
      // a form had a blank company name and no company_id, invisible on
      // that company's Deals tab despite contact_id correctly resolving.
      if (!dealCompany && dealContactId) {
        const { data: contactRow } = await db.from('crm_contacts').select('company_name, company_id').eq('id', dealContactId).maybeSingle()
        if (contactRow) {
          dealCompany = contactRow.company_name ?? ''
          dealCompanyId = dealCompanyId ?? contactRow.company_id ?? null
        }
      }
      const dealName = (context.dealName as string) ?? `Deal for ${dealCompany}`
      // AUDIT #629 — matches #516's fix for the builder dropdown/AI
      // generator, applied to the engine's own runtime default: pipeline
      // stages are user-renamable (#42), so a deal created with a hardcoded
      // 'Lead' after the first stage is renamed becomes invisible on the
      // Pipeline board (which groups strictly by d.stage === s.name).
      const stage = (context.dealStage as string) ?? await getFirstPipelineStageName(db)
      await db.from('deals').insert({
        id: `deal-auto-${uid()}`,
        company: dealCompany,
        // Previously unset on every automation-created deal — a deal
        // spawned from a form/funnel submission had no way back to the
        // contact it came from, which silently broke any join meant to
        // trace revenue back to how that contact was originally sourced.
        company_id: dealCompanyId,
        contact_id: dealContactId,
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
        type: 'note',
        title: note,
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
        contact_id: (context.contactId as string) ?? (context.contact_id as string) ?? null,
        timestamp: new Date().toISOString(),
        user_name: 'System',
      })
      break
    }

    case 'Send Notification': {
      const target = (context.notifyTarget as string) ?? 'assigned_rep'
      const message = (context.notifyMessage as string) ?? `Automation triggered for ${company}`

      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        type: 'note',
        title: `[Auto] ${message}`,
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
        contact_id: (context.contactId as string) ?? (context.contact_id as string) ?? null,
        timestamp: new Date().toISOString(),
        user_name: 'System',
      })

      const targetUserIds: string[] = []
      if (target === 'assigned_rep') {
        const userId = await resolveAssignedRepUserId(context, db)
        if (userId) targetUserIds.push(userId)
      } else {
        const unitMap: Record<string, string> = {
          sales_team: 'Sales',
          finance_team: 'Billing/Finance',
          delivery_team: 'Delivery/Operations',
          leadership: 'Leadership/Admin',
        }
        const unit = unitMap[target]
        if (unit) {
          const { data: members } = await db
            .from('team_members')
            .select('id')
            .eq('unit', unit)
            .eq('status', 'active')
          for (const m of members ?? []) targetUserIds.push(m.id)
        }
      }

      if (targetUserIds.length > 0 && await shouldSendPushForEvent(triggerType)) {
        for (const userId of targetUserIds) {
          sendPushNotification({
            userId,
            title: 'Automation Notification',
            body: message,
            url: '/automation',
          }).catch(() => {})
        }
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

    // AUDIT #609 — 'Generate Proposal' (formerly here) was removed as a
    // selectable automation action entirely: it required 'Form Submitted'
    // to supply formId, but both real routes that fire that trigger
    // unconditionally set _publicSource (#46's anti-abuse guard), which
    // this action refused to run under — the one trigger that could feed
    // it and the guard it needed were permanently incompatible, so it could
    // structurally never fire in any real configuration. Removed rather
    // than loosening #46's guard, matching the #14/#143/#565 precedent for
    // selectable-but-permanently-unreachable features. The standalone AI
    // proposal generator (components/crm/GenerateProposalPanel.tsx,
    // POST /api/proposals/generate) is a different, unaffected, working
    // feature that happens to share the name.

    // Legacy actions from the simple automation panel
    case 'Create Draft Contract': {
      await db.from('contracts').insert({
        id: `c-auto-${uid()}`,
        proposal_id: (context.proposalId as string) ?? null,
        company,
        // Was missing on this and the 4 sibling "legacy" actions below —
        // 7 other action handlers in this same file already resolve it
        // this way; without it, an auto-created contract/task/project/
        // maintenance record is invisible on the originating company's own
        // detail-page tabs and any ?companyId=-filtered view (same bug
        // class as AUDIT #226/#598/#634, just missed for this set).
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
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
        company,
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
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
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
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
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
        service_type: (context.service_type as string) ?? 'General',
        status: 'Active',
        contract_id: (context.contractId as string) ?? null,
      })
      break
    }

    // Previously there was NO invoice-creation action of any kind, so even a
    // fully hand-built automation could not generate an invoice — the single
    // biggest cross-module wiring gap in the app (Contract → Invoice had no
    // path at all, and all three real invoice-creation call sites left
    // `contract_id` null). This closes that, and is what the recurring
    // retainer-billing cron builds on.
    case 'Create Invoice': {
      const invCompanyId = (context.companyId as string) ?? (context.company_id as string) ?? null
      const contractId = (context.contractId as string) ?? (context.contract_id as string) ?? null

      // Prefer the contract as the source of truth for amount/service when
      // this fires off a contract trigger — the whole point is that staff
      // shouldn't re-key what the contract already says.
      //
      // Deliberately does NOT fall back to `context.value`. `executeWorkflow`
      // spreads the whole trigger row over the config (see the
      // ACTION_CONFIG_ADAPTERS note above), and deals, contracts, proposals
      // and renewals all carry a `value` column — so a "Deal Stage Changed →
      // Create Invoice" automation on an $82,500 multi-year deal would raise
      // a single $82,500 invoice off the raw row and skip the contract
      // normalization below entirely. Only the action's own explicit
      // `invoiceAmount` counts as a caller-supplied amount.
      let amount = Number(context.invoiceAmount ?? 0) || 0
      let invServiceType = (context.invoiceServiceType as string) ?? (context.service_type as string) ?? 'General'
      let invCompany = company
      if (contractId) {
        const { data: contractRow } = await db
          .from('contracts')
          .select('company, company_id, value, service_type, billing_structure')
          .eq('id', contractId)
          .maybeSingle()
        if (contractRow) {
          if (!amount) {
            const structure = contractRow.billing_structure ?? ''
            const contractValue = Number(contractRow.value) || 0
            // `contracts.value` is the per-billing-period amount (lib/metrics.ts),
            // which is exactly what one invoice should charge. Using
            // contractMonthlyValue() here instead would divide Quarterly by 3
            // and Annual by 12 — the right figure for an MRR dashboard, the
            // wrong one for an invoice — and would resolve a One-time or
            // Milestone contract to 0, silently raising no invoice at all for
            // precisely the contracts most likely to need one.
            amount = isRecurringStructure(structure)
              ? contractPeriodAmount(contractValue, structure)
              : contractValue
          }
          if (!context.invoiceServiceType && contractRow.service_type) invServiceType = contractRow.service_type
          if (!invCompany && contractRow.company) invCompany = contractRow.company
        }
      }

      if (amount <= 0) {
        console.warn(`[automations-engine] Create Invoice skipped for ${invCompany || 'unknown company'} — no positive amount resolved`)
        break
      }

      const dueOffsetDays = Number(context.invoiceDueDays ?? 30) || 30
      const dueDate = new Date(Date.now() + dueOffsetDays * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]

      const newInvoiceId = `inv-auto-${uid()}`
      await db.from('invoices').insert({
        id: newInvoiceId,
        company: invCompany,
        company_id: invCompanyId,
        // The field every existing invoice-creation path leaves null.
        contract_id: contractId,
        amount,
        status: 'Pending',
        issued_date: today,
        issue_date: today,
        due_date: dueDate,
        service_type: invServiceType,
        source: 'automation',
      })

      // Optional delivery, off by default. An automation that silently
      // emailed a client without the operator asking for it would be a bad
      // surprise, so this only fires when the action is explicitly
      // configured to — but without it an auto-created invoice sits Pending
      // forever, never delivered and (since the cron's overdue sweep only
      // looks at 'Sent') never aged or chased either.
      if (context.sendInvoice === true || context.sendInvoice === 'true') {
        const sent = await sendInvoiceEmail(newInvoiceId, { actorName: 'Automation' }, db)
        if (!sent.ok) {
          console.warn(`[automations-engine] Create Invoice: ${newInvoiceId} created but not sent — ${sent.error}`)
        }
      }
      break
    }

    // Sends an invoice that already exists — the counterpart to Create
    // Invoice's opt-in delivery, for flows that raise the invoice elsewhere
    // (the retainer cron, a staff member) and want the automation to handle
    // getting it to the client.
    case 'Send Invoice': {
      const targetInvoiceId = (context.invoiceId as string) ?? (context.invoice_id as string) ?? null
      if (!targetInvoiceId) {
        console.warn('[automations-engine] Send Invoice skipped — no invoice in the trigger context')
        break
      }
      const sent = await sendInvoiceEmail(targetInvoiceId, { actorName: 'Automation' }, db)
      if (!sent.ok) {
        console.warn(`[automations-engine] Send Invoice failed for ${targetInvoiceId} — ${sent.error}`)
      }
      break
    }

    case 'Notify Sales Rep':
    case 'Notify Finance Team':
    case 'Notify Delivery Team':
    case 'Notify Assigned Rep': {
      const notifMessage = `${action}: ${context.trigger ?? 'Automation triggered'} for ${company}`
      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        type: 'note',
        title: `[Auto] ${notifMessage}`,
        // AUDIT #600 — most real trigger contexts are built by spreading a
        // raw DB row (snake_case), matching the fallback Log Activity/Send
        // Notification already use — camelCase-only left this null for any
        // trigger fired that way, orphaning the activity off both the
        // company's and deal's Activity tab.
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
        contact_id: (context.contactId as string) ?? (context.contact_id as string) ?? null,
        timestamp: new Date().toISOString(),
        user_name: 'System',
      })

      const unitMap: Record<string, string> = {
        'Notify Sales Rep': 'Sales',
        'Notify Finance Team': 'Billing/Finance',
        'Notify Delivery Team': 'Delivery/Operations',
        'Notify Assigned Rep': '',
      }
      const targetUnit = unitMap[action]
      if (targetUnit) {
        const { data: members } = await db
          .from('team_members')
          .select('id')
          .eq('unit', targetUnit)
          .eq('status', 'active')
        if (members && members.length > 0 && await shouldSendPushForEvent(triggerType)) {
          for (const m of members) {
            sendPushNotification({ userId: m.id, title: action, body: notifMessage, url: '/automation' }).catch(() => {})
          }
        }
      } else if (action === 'Notify Assigned Rep') {
        const repId = await resolveAssignedRepUserId(context, db)
        if (repId && await shouldSendPushForEvent(triggerType)) {
          sendPushNotification({ userId: repId, title: action, body: notifMessage, url: '/automation' }).catch(() => {})
        }
      }
      break
    }

    case 'Log Touchpoint': {
      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        type: 'note',
        title: `[Auto] ${context.trigger ?? 'Automation'} for ${company}`,
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
        contact_id: (context.contactId as string) ?? (context.contact_id as string) ?? null,
        timestamp: new Date().toISOString(),
        user_name: 'System',
      })
      break
    }

    case 'Flag in Dashboard': {
      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        type: 'note',
        title: `[Auto] Flagged for attention — ${context.trigger ?? action}`,
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
        timestamp: new Date().toISOString(),
        user_name: 'System',
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
      // AUDIT.md #524 — the old version fuzzy-matched a template by name
      // (name was almost always undefined, falling back to the trigger's
      // own label, which essentially never matches a real template name)
      // and, even on a match, only wrote an activity note claiming the
      // template was "applied" — it never read `template.body`, so no
      // actual document was ever generated or sent anywhere. This now
      // requires a real templateId (set via the builder's template picker,
      // see ACTION_CONFIG_ADAPTERS), fills the template's bracket
      // placeholders with real data (same [KEY] convention as the AI
      // chat's generate_document tool), and actually emails the result to
      // the account's primary contact.
      const templateId = context.templateId as string | undefined
      if (!templateId) break
      const { data: template } = await db
        .from('document_templates')
        .select('id, name, body')
        .eq('id', templateId)
        .maybeSingle()
      if (!template?.body) break

      const contactId = await resolveContactId(context, company, db)
      if (!contactId) break
      const { data: contact } = await db
        .from('crm_contacts')
        .select('emails, full_name')
        .eq('id', contactId)
        .maybeSingle()
      if (!contact?.emails?.[0]) break

      const clientName = contact.full_name ?? company
      const placeholderData: Record<string, string> = {
        'CLIENT NAME': clientName,
        'COMPANY': company,
        'DATE': new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      }
      if (context.value != null) placeholderData['VALUE'] = `$${Number(context.value).toLocaleString()}`
      const serviceType = (context.serviceType as string) ?? (context.service_type as string)
      if (serviceType) placeholderData['SERVICE TYPE'] = serviceType

      let filled = template.body as string
      for (const [key, value] of Object.entries(placeholderData)) {
        filled = filled.replace(new RegExp(`\\[${key}\\]`, 'gi'), value)
      }

      const subject = `${template.name} — ${company}`
      const html = await wrapBrandedEmail(filled.replace(/\n/g, '<br>'), template.name)
      const sendResult = await sendEmail({ to: contact.emails[0], subject, html })

      await db.from('crm_activities').insert({
        id: `act-auto-${uid()}`,
        // AUDIT #600 — 'document' isn't a real ActivityType member
        // (lib/types.ts); ActivityTimeline dereferences
        // activityConfig[act.type] unguarded, so this crashed the Activity
        // tab the moment this action ever ran. 'email' is the accurate
        // type — this action sends a real email.
        type: 'email',
        title: sendResult.success
          ? `[Auto] Sent "${template.name}" to ${clientName} (${contact.emails[0]})`
          : `[Auto] Failed to send "${template.name}" to ${clientName}: ${sendResult.error ?? 'unknown error'}`,
        body: filled,
        contact_id: contactId,
        contact_name: clientName,
        company_id: (context.companyId as string) ?? (context.company_id as string) ?? null,
        company_name: company,
        timestamp: new Date().toISOString(),
        user_name: 'System',
        outcome: sendResult.success ? 'success' : 'failed',
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
          link: '/client',
          read: false,
          created_at: new Date().toISOString(),
        })
      }
      break
    }

    case 'Escalate if 7+ Days': {
      const dealId = (context.dealId as string) ?? null
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      let shouldEscalate = false
      let dealCompanyId: string | null = null
      if (dealId) {
        const { data: deal } = await db
          .from('deals')
          .select('last_activity, stage, company, company_id')
          .eq('id', dealId)
          .single()
        if (deal?.last_activity && new Date(deal.last_activity) < new Date(sevenDaysAgo)) {
          shouldEscalate = true
        }
        dealCompanyId = deal?.company_id ?? null
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
          company_id: dealCompanyId ?? (context.companyId as string) ?? (context.company_id as string) ?? null,
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
      let seqQuery = db.from('sequences').select('id, steps').eq('status', 'Active')
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

      // AUDIT #638 — matches #125's fix for increment_review_campaign_counts:
      // check the RPC's own error instead of letting a failure pass silently.
      const { error: adjustErr1 } = await db.rpc('adjust_sequence_counts', {
        p_sequence_id: targetSeq.id,
        p_enrolled_delta: 1,
        p_active_delta: 1,
      })
      if (adjustErr1) console.error(`[automations-engine] adjust_sequence_counts failed for sequence ${targetSeq.id}:`, adjustErr1.message)
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

        const { error: adjustErr2 } = await db.rpc('adjust_sequence_counts', {
          p_sequence_id: enr.sequence_id,
          p_enrolled_delta: 0,
          p_active_delta: -1,
        })
        if (adjustErr2) console.error(`[automations-engine] adjust_sequence_counts failed for sequence ${enr.sequence_id}:`, adjustErr2.message)
      }
      break
    }

    case 'Rotate Contact Owner': {
      // Reassigns real CRM ownership — refuse when the trigger came from a
      // public, unauthenticated endpoint (funnel-submit / generic public
      // forms), which can be reached by anyone who knows a funnel slug and
      // an existing contact's email. Enroll in Sequence stays allowed from
      // public triggers (worst case: an unwanted nurture email), but
      // reassigning who owns a customer relationship shouldn't be forgeable
      // by a spoofed public form submission (AUDIT.md #46).
      if (context._publicSource) break

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
        .eq('status', 'active')
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
