// Turns a plain-English description ("a 4-touch nurture sequence for SEO
// leads who haven't responded") into a real sequence: a name, target
// segment, and an ordered array of SequenceSteps (lib/types.ts) — the exact
// shape app/crm/sequences/[id]/page.tsx's step editor and
// app/api/sequences/execute/route.ts already work with, so the result can
// be created via the existing POST /api/sequences and opened in the normal
// step editor for review/editing like any other sequence.
//
// Mirrors lib/proposal-generator.ts's pattern: a system prompt enumerating
// the exact valid schema, a defensive normalize step that never trusts the
// AI's shape directly, and no "wait" pseudo-steps — day offsets on real
// steps already encode spacing, and app/api/sequences/execute/route.ts has
// no distinct handling for a 'wait' step type, so emitting one would just
// silently do nothing.
import { chatCompletion } from '@/lib/ai-client'
import type { SequenceStep, TaskPriority } from '@/lib/types'

const STEP_TYPES = ['email', 'task', 'manual_email'] as const
const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High']

export interface GeneratedSequence {
  name: string
  targetSegment: string
  trigger: string
  steps: SequenceStep[]
  warnings: string[]
}

export interface GenerateSequenceResult {
  sequence: GeneratedSequence | null
  source: 'ollama' | 'groq' | 'gemini' | 'cerebras' | 'none'
  error: string | null
}

const SYSTEM_PROMPT = `You are the email sequence builder for GravHub, a marketing agency's internal operations app. A staff member will describe, in plain English, an outreach/nurture sequence they want. Turn it into a real, ready-to-send sequence, then respond with ONLY a single JSON object (no markdown fences, no commentary before or after).

House style for any email copy you write:
- Confident, professional marketing-agency tone. Concise, no filler.
- No em dashes or en dashes. Hyphens only for genuine compound words.
- Write real, ready-to-send subject lines and bodies grounded only in what the user described — never invent specific numbers, case studies, or client names that weren't given.

Step types — each step MUST use one of these exact type strings:
- "email" — sends automatically. Needs: subject (string), body (string — plain text, short paragraphs, a couple sentences to a short paragraph).
- "manual_email" — creates a task for a human rep to personally write and send an email (use when the description implies a personal/high-touch touch, not a templated blast). Needs: subject (string, used as the task title context), body (string — instructions/talking points for the rep, not necessarily the literal email text).
- "task" — creates a generic follow-up task for a human rep (e.g. "call the contact", "check LinkedIn"). Needs: taskTitle (string), body (string, optional instructions), taskPriority (one of: ${TASK_PRIORITIES.join('|')}).

Every step needs a "day" (integer, days since enrollment — day 0 is immediately on enrollment). Space steps out sensibly for the cadence described (e.g. a "gentle nurture" spaces days further apart than an "aggressive follow-up" sequence); days must be non-decreasing across the array in the order you return them. Do not emit a separate "wait" step — day offsets alone control spacing.

Unless the user specifies a step count, default to 4-6 steps for a full sequence, or fewer if they describe something simpler (e.g. "just a single follow-up email").

JSON shape to return:
{
  "name": string,                    // short, descriptive, e.g. "SEO Lead Nurture — 5 Touch"
  "targetSegment": string,           // who this is for, in a few words, e.g. "Inbound SEO leads, no response after first call"
  "trigger": string,                 // plain-English enrollment condition, e.g. "Contact tagged as New Lead + Service = SEO" — descriptive text only, not a system trigger
  "steps": [{ "type": string, "day": number, "subject": string, "body": string, "taskTitle": string, "taskPriority": string }],  // omit fields that don't apply to a step's type
  "warnings": [string]               // anything the user asked for that isn't possible with the step types above, or an assumption you made instead of guessing silently — empty array if nothing to flag
}`

function stripFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fenced ? fenced[1] : trimmed
}

function normalizeStep(raw: unknown, index: number, warnings: string[]): SequenceStep | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  let type = String(r.type ?? 'email')
  if (!STEP_TYPES.includes(type as typeof STEP_TYPES[number])) {
    warnings.push(`Step ${index + 1}: unrecognized step type "${type}" — defaulted to "email".`)
    type = 'email'
  }
  const day = Number(r.day)

  const step: SequenceStep = {
    id: `step-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    type: type as SequenceStep['type'],
    day: Number.isFinite(day) && day >= 0 ? Math.round(day) : index * 3,
  }
  if (type === 'email' || type === 'manual_email') {
    step.subject = r.subject ? String(r.subject) : undefined
    step.body = r.body ? String(r.body) : undefined
    if (type === 'email') step.htmlTemplate = 'branded'
  }
  if (type === 'task') {
    step.taskTitle = r.taskTitle ? String(r.taskTitle) : (r.subject ? String(r.subject) : undefined)
    step.body = r.body ? String(r.body) : undefined
    const priority = String(r.taskPriority ?? 'Medium')
    step.taskPriority = TASK_PRIORITIES.includes(priority as TaskPriority) ? priority as TaskPriority : 'Medium'
  }
  return step
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSequence(raw: any): GeneratedSequence {
  const warnings: string[] = Array.isArray(raw.warnings) ? raw.warnings.map((w: unknown) => String(w)) : []

  const rawSteps = Array.isArray(raw.steps) ? raw.steps : []
  const steps = rawSteps
    .map((s: unknown, i: number) => normalizeStep(s, i, warnings))
    .filter((s: SequenceStep | null): s is SequenceStep => s !== null)

  // Enforce non-decreasing day offsets — the step editor's own
  // normalizeStepDays() does this on every manual save (see
  // app/crm/sequences/[id]/page.tsx) because the executor computes a
  // scheduled send time from each step's absolute day offset; a step that
  // regressed backwards would compute a zero/negative gap from the one
  // before it.
  let minDay = 0
  for (const step of steps) {
    if (step.day < minDay) step.day = minDay
    minDay = step.day + 1
  }

  if (steps.length === 0) {
    warnings.push('The AI didn\'t propose any real steps — add at least one manually before activating.')
  }

  return {
    name: String(raw.name ?? 'Untitled sequence').slice(0, 200),
    targetSegment: String(raw.targetSegment ?? '').slice(0, 200),
    trigger: String(raw.trigger ?? '').slice(0, 200),
    steps,
    warnings,
  }
}

export async function generateSequence(description: string): Promise<GenerateSequenceResult> {
  const ai = await chatCompletion({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: description }],
    maxTokens: 2500,
    timeoutMs: 30_000,
    feature: 'sequence_builder',
  })

  if (ai.source === 'none' || !ai.text) {
    return { sequence: null, source: ai.source, error: 'No AI provider is reachable right now. Build the sequence manually, or try again in a moment.' }
  }

  try {
    const parsed = JSON.parse(stripFences(ai.text))
    return { sequence: normalizeSequence(parsed), source: ai.source, error: null }
  } catch {
    return { sequence: null, source: ai.source, error: 'The AI response could not be parsed. Try rephrasing, or build the sequence manually.' }
  }
}
