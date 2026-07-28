// Turns a plain-English description ("email me when an invoice goes
// overdue") into a real, working automation — same {trigger, actions:
// [{type, config}]} shape app/automation/builder/page.tsx already produces,
// so the result can be created via the existing POST /api/automations and
// opened in that builder for review/editing like any other automation.
//
// Mirrors lib/proposal-generator.ts's pattern: a system prompt that
// enumerates the exact valid schema, a defensive normalize step that never
// trusts the AI's shape directly, and dropped (not guessed) invalid
// trigger/action values rather than inventing something that would sit at
// "Active" and silently never run — that exact "dead automation" failure
// mode is why app/automation/page.tsx's TRIGGER_OPTIONS/ACTION_OPTIONS were
// pruned down to only-real values in the first place (see comments there).
import { chatCompletion } from '@/lib/ai-client'

// Only triggers something in the app actually fires — kept in sync with
// TRIGGER_OPTIONS in app/automation/page.tsx by design; do not add a
// trigger here that isn't also safe to add there.
export const VALID_TRIGGERS = [
  'Proposal Accepted', 'Proposal Declined', 'Contract Fully Executed',
  'Contract Sent', 'Invoice Paid', 'Invoice Overdue',
  'Renewal Date Within 90 Days', 'Renewal Date Within 30 Days',
  'Deal Stage Changed', 'Contact Created', 'Form Submitted',
] as const

// AUDIT #516 — this hardcoded list is now only the last-resort fallback for
// when the caller (POST /api/automations/generate) can't fetch the real,
// saved pipeline config; the actual system prompt uses live stage names via
// lib/pipelines.ts's getPipelineStageNames(), same fix #501 already applied
// to the forms editor's deal-stage dropdown.
const FALLBACK_DEAL_STAGES = ['Lead', 'Qualified', 'Proposal Sent', 'Contract Sent', 'Closed Won', 'Closed Lost']
const CONTACT_FIELDS = ['status', 'lifecycle_stage', 'owner', 'source']
const NOTIFY_TARGETS = ['assigned_rep', 'sales_team', 'finance_team', 'delivery_team', 'leadership']
const CONDITION_OPERATORS = ['equals', 'not_equals', 'contains', 'greater_than', 'less_than']
const WAIT_UNITS = ['minutes', 'hours', 'days']

// Every action type executeAction() in lib/automations-engine.ts actually
// implements, except Enroll in Sequence / Unenroll from Sequence / Rotate
// Contact Owner (each needs a real cross-reference — a specific sequence
// id, a specific unit — that a free-text description can't reliably supply;
// left for the visual builder, which already lists real sequences/units).
const ACTION_CATALOG: Record<string, string | null> = {
  'Send Email Reminder': 'subject (string), body (string, plain text/short paragraphs), fromName (string, optional)',
  'Create Task': 'title (string), assignee (string — a team member name, or a unit like "Sales"), dueDateOffset (number of days from now)',
  'Update Contact': `field (one of: ${CONTACT_FIELDS.join('|')}), value (string)`,
  // Placeholder — buildSystemPrompt() overrides this entry with the real,
  // live pipeline stage names before rendering the prompt.
  'Create Deal': `dealName (string), stage (one of: ${FALLBACK_DEAL_STAGES.join('|')})`,
  'Log Activity': 'note (string)',
  'Send Notification': `target (one of: ${NOTIFY_TARGETS.join('|')}), message (string)`,
  'Add Tag': 'tag (string)',
  'Remove Tag': 'tag (string)',
  'Wait': `duration (number), unit (one of: ${WAIT_UNITS.join('|')})`,
  'If/Else': `field (string — a fact from the trigger event, e.g. "value" or "stage"), operator (one of: ${CONDITION_OPERATORS.join('|')}), value (string to compare against)`,
  'Create Draft Contract': null,
  'Create Billing Task': null,
  'Create Renewal Task': null,
  'Create Project Record': null,
  'Create Maintenance Record': null,
  'Notify Sales Rep': null,
  'Notify Finance Team': null,
  'Notify Delivery Team': null,
  'Notify Assigned Rep': null,
  'Log Touchpoint': null,
  'Flag in Dashboard': null,
  'Update Revenue Metrics': null,
  'Apply Service Template': null,
  'Update Client Portal': null,
  'Escalate if 7+ Days': null,
  // executeAction() only implements this for the Form Submitted trigger with
  // a real formId in context (lib/automations-engine.ts) — under any other
  // trigger it's a silent no-op, so both the prompt and normalizeAutomation()
  // below must keep it scoped to that one trigger.
  'Generate Proposal': null,
}

const VALID_ACTIONS = Object.keys(ACTION_CATALOG)

export interface GeneratedAutomationAction {
  type: string
  config: Record<string, unknown>
}

export interface GeneratedAutomation {
  name: string
  trigger: string
  actions: GeneratedAutomationAction[]
  warnings: string[]
}

export interface GenerateAutomationResult {
  automation: GeneratedAutomation | null
  source: 'ollama' | 'groq' | 'gemini' | 'cerebras' | 'none'
  error: string | null
}

function buildSystemPrompt(dealStages: string[]): string {
  const stages = dealStages.length > 0 ? dealStages : FALLBACK_DEAL_STAGES
  const actionList = Object.entries(ACTION_CATALOG)
    .map(([name, fields]) => {
      const resolvedFields = name === 'Create Deal'
        ? `dealName (string), stage (one of: ${stages.join('|')})`
        : fields
      const base = resolvedFields ? ` — config: {${resolvedFields}}` : ' — no config needed, pass config: {}'
      const note = name === 'Generate Proposal' ? ' (ONLY valid when trigger is "Form Submitted" — never pair with any other trigger)' : ''
      return `- "${name}"${base}${note}`
    })
    .join('\n')

  return `You are the automation builder for GravHub, a marketing agency's internal operations app. A staff member will describe, in plain English, an automation they want. Turn it into a working automation, then respond with ONLY a single JSON object (no markdown fences, no commentary before or after).

Valid triggers — you MUST pick exactly one of these strings, verbatim:
${VALID_TRIGGERS.map(t => `- "${t}"`).join('\n')}

If nothing in that list genuinely matches what the user described, pick the closest real one and explain the gap in "warnings" — never invent a new trigger string.

Valid actions — pick one or more, each MUST use one of these exact type strings, verbatim:
${actionList}

Important: only "Send Email Reminder" (not "Send Follow-up Email" or any other label) actually reads a subject/body from config — if the user wants a specific email written, the action type must be exactly "Send Email Reminder".

JSON shape to return:
{
  "name": string,                    // short, descriptive, e.g. "Notify finance when an invoice goes overdue"
  "trigger": string,                 // one of the exact trigger strings above
  "actions": [{ "type": string, "config": object }],  // one of the exact action strings above per action; config per the field list above, {} if none
  "warnings": [string]               // anything the user asked for that isn't possible with the triggers/actions above, or any assumption you made instead of guessing silently — empty array if nothing to flag
}`
}

function stripFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fenced ? fenced[1] : trimmed
}

function normalizeAction(raw: unknown, warnings: string[]): GeneratedAutomationAction | null {
  if (typeof raw !== 'object' || raw === null) return null
  const type = String((raw as Record<string, unknown>).type ?? '')
  if (!VALID_ACTIONS.includes(type)) {
    warnings.push(`Dropped an action the AI proposed that isn't a real action type: "${type || '(empty)'}"`)
    return null
  }
  const rawConfig = (raw as Record<string, unknown>).config
  const config = typeof rawConfig === 'object' && rawConfig !== null ? rawConfig as Record<string, unknown> : {}
  // Coerce every config value to a string (or number for numeric fields) —
  // never trust the AI's types directly, same reasoning as
  // proposal-generator.ts's normalizeDraft.
  const cleanConfig: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined || value === null || value === '') continue
    if (key === 'duration' || key === 'dueDateOffset') {
      const n = Number(value)
      if (!Number.isNaN(n)) cleanConfig[key] = n
    } else {
      cleanConfig[key] = String(value)
    }
  }
  return { type, config: cleanConfig }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAutomation(raw: any): GeneratedAutomation {
  const warnings: string[] = Array.isArray(raw.warnings) ? raw.warnings.map((w: unknown) => String(w)) : []

  let trigger = String(raw.trigger ?? '')
  if (!VALID_TRIGGERS.includes(trigger as typeof VALID_TRIGGERS[number])) {
    warnings.push(`The AI proposed a trigger that isn't real: "${trigger || '(empty)'}" — defaulted to "Contact Created". Pick the right trigger manually before activating.`)
    trigger = 'Contact Created'
  }

  const rawActions = Array.isArray(raw.actions) ? raw.actions : []
  let actions: GeneratedAutomationAction[] = rawActions
    .map((a: unknown) => normalizeAction(a, warnings))
    .filter((a: GeneratedAutomationAction | null): a is GeneratedAutomationAction => a !== null)

  // executeAction() no-ops 'Generate Proposal' for every trigger except Form
  // Submitted (lib/automations-engine.ts) — never let it through under any
  // other trigger, since it would sit "Active" and silently never run.
  if (trigger !== 'Form Submitted') {
    const droppedCount = actions.filter(a => a.type === 'Generate Proposal').length
    if (droppedCount > 0) {
      warnings.push('Dropped "Generate Proposal" — it only works under the "Form Submitted" trigger and would otherwise silently never run.')
      actions = actions.filter(a => a.type !== 'Generate Proposal')
    }
  }

  if (actions.length === 0) {
    warnings.push('The AI didn\'t propose any real actions — add at least one manually before activating.')
  }

  return {
    name: String(raw.name ?? 'Untitled automation').slice(0, 200),
    trigger,
    actions,
    warnings,
  }
}

export async function generateAutomation(description: string, dealStages: string[] = []): Promise<GenerateAutomationResult> {
  const ai = await chatCompletion({
    system: buildSystemPrompt(dealStages),
    messages: [{ role: 'user', content: description }],
    maxTokens: 1500,
    timeoutMs: 30_000,
    feature: 'automation_builder',
  })

  if (ai.source === 'none' || !ai.text) {
    return { automation: null, source: ai.source, error: 'No AI provider is reachable right now. Build the automation manually, or try again in a moment.' }
  }

  try {
    const parsed = JSON.parse(stripFences(ai.text))
    return { automation: normalizeAutomation(parsed), source: ai.source, error: null }
  } catch {
    return { automation: null, source: ai.source, error: 'The AI response could not be parsed. Try rephrasing, or build the automation manually.' }
  }
}
