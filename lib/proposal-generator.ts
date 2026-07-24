// Turns a raw intake (a form submission's field/answer pairs, or manual
// pasted text) into a finished branded proposal PDF. Mirrors the process in
// the Proposal Generator Cowork kit's setup doc: read the intake, draft in
// Graviss house style, clone the ADCO section structure, flag anything
// ambiguous instead of guessing silently, render to PDF.
import { chatCompletion } from '@/lib/ai-client'
import { buildProposalHtml, buildFooterTemplate, type ProposalDraft, type ProposalOption } from '@/lib/proposal-template'
import { renderProposalPdf } from '@/lib/proposal-render'

export interface GenerateProposalOptions {
  intakeText: string
  clientName: string
  preparedForNames?: string
  today?: string
}

export interface GenerateProposalResult {
  draft: ProposalDraft
  pdf: Buffer
  source: 'ollama' | 'groq' | 'gemini' | 'cerebras' | 'template'
  notes: string
}

const SYSTEM_PROMPT = `You are the proposal generator for Graviss Marketing. Given a client intake (raw field/answer pairs from a form, call notes, or pasted text), draft a proposal matching this exact structure and house style, then respond with ONLY a single JSON object (no markdown fences, no commentary before or after).

House style (non-negotiable):
- Lead with the point. Concise. Revenue-anchored. No motivational filler.
- No em dashes or en dashes anywhere in any text field. Hyphens only for genuine compound words. Use "to" for ranges (e.g. "Week 1 to 2"). Use a middot (·) or "/" as a separator instead of a dash.
- Pricing only ever appears in the "options" field. Never mention a dollar amount anywhere else.
- Flag any external dependency (integration, third-party access, client-supplied asset) as a Note rather than a promise — put it in serviceNote.

JSON shape to return:
{
  "preparedForNames": string,       // names/roles from the intake, or the client name if not given
  "preparedForCompany": string,
  "kicker": string,                 // proposal type, e.g. "Website Development Proposal"
  "headline": string,                // the cover promise, not a service name
  "subhead": string,                 // one line
  "introParagraphs": [string, string], // first: who the client is + the market truth that matters. second: what this proposal delivers and why
  "goals": [{ "title": string, "body": string }],  // 4 to 6, business goals not a task list
  "hasAnalysis": boolean,            // true only if the intake presents more than one real option or an approach needing justification
  "analysisIntro": string,
  "analysisRows": [{ "factor": string, "recommended": string, "alternative": string }],
  "recommendationNote": string,      // plain business case for the recommended option, evidence led
  "services": [{ "title": string, "body": string }],  // the recommended scope, bolded capability + one sentence each
  "alternativeServicesTitle": string,
  "alternativeServices": [string],   // empty array if no lighter alternative
  "serviceNote": { "tag": string, "body": string } | null,
  "options": [{ "name": string, "priceLabel": string, "cadence": string, "description": string, "recommended": boolean }],
  "existingAgreementNote": string,   // one line noting any continuing agreement, or "" if none
  "timelineNote": string,
  "timeline": [{ "focus": string, "window": string, "output": string }],
  "paymentStructure": string,        // default "50% due to schedule kickoff, 50% due at launch." for one-time; "Net 15, invoiced on the 1st." for recurring, unless the intake overrides it
  "invoicing": string,               // default "Net 15 from invoice date."
  "engagementType": string,
  "scopeChanges": string,            // default "Work outside the defined scope is handled by written change order before it begins."
  "existingAgreementTerm": string,   // default "No existing agreement to note." if none given
  "ownershipNote": string,           // default: platform selected for performance/ease of management, full ownership transfers on final payment, no proprietary lock-in
  "clientResponsibilities": [string],
  "providerResponsibilities": [string],
  "closingNote": string,             // one line, ready-to-begin
  "generationNotes": string          // anything required that was missing or ambiguous in the intake, and what you assumed instead of asking — empty string if nothing to flag
}`

function buildUserPrompt(opts: GenerateProposalOptions): string {
  return `Client: ${opts.clientName}\nPrepared for: ${opts.preparedForNames ?? opts.clientName}\nDate: ${opts.today ?? new Date().toISOString().split('T')[0]}\n\nIntake:\n${opts.intakeText}`
}

function stripFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fenced ? fenced[1] : trimmed
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDraft(raw: any, opts: GenerateProposalOptions): ProposalDraft {
  const options: ProposalOption[] = Array.isArray(raw.options) && raw.options.length > 0
    ? raw.options.map((o: Record<string, unknown>) => ({
        name: String(o.name ?? 'Proposed Scope'),
        priceLabel: String(o.priceLabel ?? 'TBD'),
        cadence: String(o.cadence ?? 'one-time'),
        description: String(o.description ?? ''),
        recommended: Boolean(o.recommended),
      }))
    : [{ name: 'Proposed Scope', priceLabel: 'TBD', cadence: 'one-time', description: '', recommended: true }]
  if (!options.some(o => o.recommended)) options[0].recommended = true

  return {
    preparedForNames: String(raw.preparedForNames ?? opts.preparedForNames ?? opts.clientName),
    preparedForCompany: String(raw.preparedForCompany ?? opts.clientName),
    preparedBy: 'Jonathan P. Graviss',
    date: opts.today ?? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    validDays: 30,
    kicker: String(raw.kicker ?? 'Proposal'),
    headline: String(raw.headline ?? `A Proposal for ${opts.clientName}`),
    subhead: String(raw.subhead ?? ''),
    introParagraphs: Array.isArray(raw.introParagraphs) && raw.introParagraphs.length === 2
      ? [String(raw.introParagraphs[0]), String(raw.introParagraphs[1])]
      : ['', ''],
    goals: Array.isArray(raw.goals) ? raw.goals.map((g: Record<string, unknown>) => ({ title: String(g.title ?? ''), body: String(g.body ?? '') })) : [],
    hasAnalysis: Boolean(raw.hasAnalysis) && Array.isArray(raw.analysisRows) && raw.analysisRows.length > 0,
    analysisIntro: String(raw.analysisIntro ?? ''),
    analysisRows: Array.isArray(raw.analysisRows) ? raw.analysisRows.map((r: Record<string, unknown>) => ({ factor: String(r.factor ?? ''), recommended: String(r.recommended ?? ''), alternative: String(r.alternative ?? '') })) : [],
    recommendationNote: String(raw.recommendationNote ?? ''),
    services: Array.isArray(raw.services) ? raw.services.map((s: Record<string, unknown>) => ({ title: String(s.title ?? ''), body: String(s.body ?? '') })) : [],
    alternativeServicesTitle: String(raw.alternativeServicesTitle ?? 'Alternative Scope'),
    alternativeServices: Array.isArray(raw.alternativeServices) ? raw.alternativeServices.map(String) : [],
    serviceNote: raw.serviceNote && typeof raw.serviceNote === 'object'
      ? { tag: String(raw.serviceNote.tag ?? 'Note'), body: String(raw.serviceNote.body ?? '') }
      : null,
    options,
    existingAgreementNote: String(raw.existingAgreementNote ?? ''),
    timelineNote: String(raw.timelineNote ?? 'Timeline begins upon signed approval, deposit, and receipt of initial assets.'),
    timeline: Array.isArray(raw.timeline) ? raw.timeline.map((t: Record<string, unknown>) => ({ phase: '', focus: String(t.focus ?? ''), window: String(t.window ?? ''), output: String(t.output ?? '') })) : [],
    paymentStructure: String(raw.paymentStructure ?? '50% due to schedule kickoff, 50% due at launch.'),
    invoicing: String(raw.invoicing ?? 'Net 15 from invoice date.'),
    engagementType: String(raw.engagementType ?? 'One-time project engagement for the scope defined in this proposal.'),
    scopeChanges: String(raw.scopeChanges ?? 'Work outside the defined scope is handled by written change order before it begins.'),
    existingAgreementTerm: String(raw.existingAgreementTerm ?? 'No existing agreement to note.'),
    ownershipNote: String(raw.ownershipNote ?? 'The platform is selected during discovery for performance and ease of ongoing management. Full ownership of all deliverables and associated assets transfers to the client upon final payment. There is no proprietary lock-in.'),
    clientResponsibilities: Array.isArray(raw.clientResponsibilities) && raw.clientResponsibilities.length > 0
      ? raw.clientResponsibilities.map(String)
      : ['Provide content, brand assets, and account access on the agreed schedule.', 'Review and approve deliverables within agreed windows.', 'Designate a single point of contact for decisions.'],
    providerResponsibilities: Array.isArray(raw.providerResponsibilities) && raw.providerResponsibilities.length > 0
      ? raw.providerResponsibilities.map(String)
      : ['Deliver strategy, design, and execution as scoped.', 'Maintain clear communication and a consistent update cadence.'],
    closingNote: String(raw.closingNote ?? 'We are ready to begin as soon as you are.'),
    footerRunningTitle: `Graviss Marketing  ·  ${String(raw.kicker ?? 'Proposal')}`,
  }
}

function buildTemplateFallbackDraft(opts: GenerateProposalOptions): ProposalDraft {
  return normalizeDraft({
    preparedForCompany: opts.clientName,
    kicker: 'Proposal',
    headline: `A Proposal for ${opts.clientName}`,
    subhead: 'Prepared from the intake below — review and complete before sending.',
    introParagraphs: [
      `This draft was generated without an AI provider available, directly from the raw intake for ${opts.clientName}.`,
      'Every section below needs manual review and completion before this proposal is sent to the client.',
    ],
    goals: [],
    hasAnalysis: false,
    services: [{ title: 'Scope', body: 'Fill in from the intake below.' }],
    alternativeServices: [],
    options: [{ name: 'Proposed Scope', priceLabel: 'TBD', cadence: 'one-time', description: 'Set pricing from the intake.', recommended: true }],
    timeline: [],
    closingNote: 'We are ready to begin as soon as you are.',
  }, opts)
}

export async function generateProposal(opts: GenerateProposalOptions): Promise<GenerateProposalResult> {
  const ai = await chatCompletion({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(opts) }],
    maxTokens: 4000,
    timeoutMs: 90_000,
    feature: 'proposal_generator',
  })

  let draft: ProposalDraft | null = null
  let notes = ''
  if (ai.source !== 'none' && ai.text) {
    try {
      const parsed = JSON.parse(stripFences(ai.text))
      draft = normalizeDraft(parsed, opts)
      notes = typeof parsed.generationNotes === 'string' ? parsed.generationNotes : ''
    } catch {
      draft = null
    }
  }

  const source: GenerateProposalResult['source'] = draft ? ai.source as 'ollama' | 'groq' | 'gemini' | 'cerebras' : 'template'
  if (!draft) {
    draft = buildTemplateFallbackDraft(opts)
    notes = 'No AI provider configured, or the AI response could not be parsed as valid JSON — this is a deterministic placeholder draft, not an AI-drafted one. Every section needs manual completion before sending.'
  }

  const html = buildProposalHtml(draft)
  const footerTemplate = buildFooterTemplate(draft.footerRunningTitle)
  const pdf = await renderProposalPdf(html, footerTemplate)

  return { draft, pdf, source, notes }
}

/**
 * Flattens a form submission's field label/answer pairs (arbitrary shape —
 * every client's intake form is custom-built, no fixed schema) into the raw
 * intake text the AI reads, matching the kit's "read my intake" step.
 */
export function buildIntakeTextFromSubmission(
  fields: { label: string; name: string }[],
  data: Record<string, string | number | boolean>,
): string {
  const lines: string[] = []
  for (const field of fields) {
    const value = data[field.name]
    if (value === undefined || value === null || value === '') continue
    lines.push(`${field.label}: ${value}`)
  }
  return lines.join('\n')
}
