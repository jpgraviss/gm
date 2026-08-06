/**
 * Single source of truth for Graviss Marketing's service catalog — the
 * "Two-Lane, Two-Layer Service Model" (Marketing Lane / Sales Lane, each
 * with a Foundation layer and a Fractional Leadership layer). Every place
 * in the app that lets someone pick a service (deals, proposals, contracts,
 * invoices, tickets, projects, maintenance records, renewals, tasks, time
 * entries) should derive its options from SERVICES/SERVICE_NAMES here
 * instead of re-declaring its own list, and every badge should use
 * serviceTypeColors from here instead of a local color map.
 *
 * `service_type`/`team_service_line` columns are free text with no DB
 * CHECK constraint, so nothing below requires a migration. LEGACY_SERVICE_NAMES
 * covers pre-existing free-text values (old deals/renewals/time entries) that
 * predate this catalog — kept only so old badges still render a real color
 * instead of falling back to gray, not offered as choices for new records.
 */

export type ServiceLane = 'Marketing' | 'Sales'
export type ServiceLayer = 'Foundation' | 'Fractional Leadership'
export type ServiceCategory =
  | 'One-Time Build'
  | 'Ongoing MRR'
  | 'Fractional Engagement'
  // Billed to the client and remitted straight on to a third party (ad
  // platforms, travel, hardware). Cash moves through the agency but is not
  // agency revenue, so it must be excluded from revenue totals entirely —
  // not merely from MRR. Billing $10k of ad spend alongside a $2k management
  // fee is $2k of revenue.
  | 'Pass-Through'
  // Real revenue that is neither run rate nor a standard one-time build —
  // billed ad hoc (training, cancellation fees, hourly work).
  | 'Other'

interface ServiceTierInput {
  label: string
  price: number
  cadence: 'one-time' | 'monthly' | 'hourly'
  minTerm?: string
  note?: string
}

interface ServiceDefinitionInput {
  name: string
  /** Omitted for billing/accounting categories that aren't sold as a
   *  packaged offering in a lane (pass-through costs, cancellation fees). */
  lane?: ServiceLane
  layer?: ServiceLayer
  category: ServiceCategory
  color: string
  tiers?: readonly ServiceTierInput[]
  /** Older free-text values that should visually resolve to this service. */
  aliases?: readonly string[]
}

const SERVICES_RAW = [
  // ── Marketing Lane — Foundation ─────────────────────────────────────────
  {
    name: 'Website Build',
    lane: 'Marketing', layer: 'Foundation', category: 'One-Time Build',
    color: 'bg-indigo-100 text-indigo-700',
    tiers: [{ label: 'Custom Website Build', price: 6000, cadence: 'one-time', note: '$6,000–$10,000+' }],
    aliases: ['Website'],
  },
  {
    name: 'Website Management',
    lane: 'Marketing', layer: 'Foundation', category: 'Ongoing MRR',
    color: 'bg-blue-100 text-blue-700',
    tiers: [{ label: 'Website Management', price: 350, cadence: 'monthly' }],
  },
  {
    // Previously two separately-selectable catalog entries ('SEO / AEO' and
    // 'GEO', the latter bundled under the former with no pricing of its own
    // per a 2026-08-01 decision). User feedback: this is one service, not
    // two things to pick independently — merged into a single entry.
    // 'GEO' kept as an alias so any deal/project/proposal that already
    // stored the literal 'GEO' value still resolves to a real color/name
    // instead of falling back to gray.
    // Renamed to 'SEO Management' (Jonathan's billing taxonomy). Every prior
    // spelling stays an alias, so stored deals/contracts/invoices keep
    // resolving to this entry and keep their revenue classification.
    name: 'SEO Management',
    lane: 'Marketing', layer: 'Foundation', category: 'Ongoing MRR',
    color: 'bg-teal-100 text-teal-700',
    tiers: [
      { label: 'Basic', price: 550, cadence: 'monthly' },
      { label: 'Standard', price: 700, cadence: 'monthly' },
      { label: 'Premium', price: 900, cadence: 'monthly' },
    ],
    aliases: ['SEO', 'AEO', 'GEO', 'SEO / AEO', 'SEO / AEO / GEO'],
  },
  {
    name: 'Social Media Management',
    lane: 'Marketing', layer: 'Foundation', category: 'Ongoing MRR',
    color: 'bg-pink-100 text-pink-700',
    tiers: [
      { label: 'Basic', price: 1500, cadence: 'monthly' },
      { label: 'Standard', price: 2750, cadence: 'monthly' },
      { label: 'Premium', price: 4000, cadence: 'monthly', note: '$4,000+/mo' },
    ],
    aliases: ['Social Media'],
  },
  {
    name: 'Advertising Management',
    lane: 'Marketing', layer: 'Foundation', category: 'Ongoing MRR',
    color: 'bg-fuchsia-100 text-fuchsia-700',
    // The agency's monthly fee for running paid media. Deliberately separate
    // from 'Advertising Spend' below: the fee is revenue, the spend is not.
    aliases: ['PPC', 'Paid Ads', 'Ad Management'],
  },
  {
    name: 'Email Marketing',
    lane: 'Marketing', layer: 'Foundation', category: 'Ongoing MRR',
    color: 'bg-cyan-100 text-cyan-700',
    tiers: [
      { label: 'Basic', price: 750, cadence: 'monthly' },
      { label: 'Standard', price: 1500, cadence: 'monthly' },
      { label: 'Premium', price: 2750, cadence: 'monthly' },
    ],
  },
  // ── Marketing Lane — Fractional Leadership ──────────────────────────────
  {
    name: 'Fractional CMO',
    lane: 'Marketing', layer: 'Fractional Leadership', category: 'Fractional Engagement',
    color: 'bg-emerald-100 text-emerald-700',
    tiers: [
      { label: 'Revenue Ready Operator Assessment', price: 5000, cadence: 'one-time', note: 'Credits toward retainer' },
      { label: 'Tier 1 — Marketing Advisor', price: 4500, cadence: 'monthly', minTerm: '3-mo min' },
      { label: 'Tier 2 — Embedded Marketing Lead', price: 9000, cadence: 'monthly', minTerm: '6-mo min' },
      { label: 'Tier 3 — Fractional CMO', price: 16500, cadence: 'monthly', minTerm: '6-mo min' },
      { label: 'Hourly Consulting', price: 250, cadence: 'hourly', note: '5-hr blocks' },
    ],
  },
  // ── Sales Lane — Foundation ──────────────────────────────────────────────
  {
    // Stays 'One-Time Build'. It was briefly reclassified to 'Other', which
    // Jonathan corrected: a training sprint is a discrete one-time job that
    // gets delivered, not a miscellaneous ad-hoc charge, so 'Other' described
    // it inaccurately and hid real one-time revenue in a catch-all bucket.
    name: 'Sales Training',
    lane: 'Sales', layer: 'Foundation', category: 'One-Time Build',
    color: 'bg-orange-100 text-orange-700',
    tiers: [
      { label: 'Sales Training Sprint', price: 10000, cadence: 'one-time', note: 'Per sprint · five AE sprints, à la carte, any order' },
    ],
  },
  {
    name: 'Sales Enablement',
    lane: 'Sales', layer: 'Foundation', category: 'One-Time Build',
    color: 'bg-amber-100 text-amber-700',
    tiers: [
      { label: 'Enablement Foundation', price: 7500, cadence: 'one-time' },
      { label: 'Enablement Core Build', price: 15000, cadence: 'one-time' },
      { label: 'Enablement System', price: 22000, cadence: 'one-time' },
    ],
  },
  {
    name: 'Sales Coaching',
    lane: 'Sales', layer: 'Foundation', category: 'Ongoing MRR',
    color: 'bg-yellow-100 text-yellow-700',
    tiers: [{ label: 'Ongoing Sales Coaching', price: 3000, cadence: 'monthly' }],
  },
  {
    name: 'Sales Enablement Support',
    lane: 'Sales', layer: 'Foundation', category: 'Ongoing MRR',
    color: 'bg-lime-100 text-lime-700',
    tiers: [{ label: 'Ongoing Enablement Support', price: 3000, cadence: 'monthly' }],
  },
  // ── Sales Lane — Fractional Leadership ───────────────────────────────────
  {
    name: 'Fractional Sales Lead / CRO',
    lane: 'Sales', layer: 'Fractional Leadership', category: 'Fractional Engagement',
    color: 'bg-violet-100 text-violet-700',
    tiers: [
      { label: 'Revenue Ready Operator Assessment', price: 5000, cadence: 'one-time', note: 'Credits toward retainer' },
      { label: 'Tier 1 — Sales Advisor', price: 4500, cadence: 'monthly', minTerm: '3-mo min' },
      { label: 'Tier 2 — Embedded Sales Lead', price: 9000, cadence: 'monthly', minTerm: '6-mo min' },
      { label: 'Tier 3 — Fractional CRO', price: 16500, cadence: 'monthly', minTerm: '6-mo min' },
      { label: 'Hourly Consulting', price: 250, cadence: 'hourly', note: '5-hr blocks' },
    ],
  },
  // ── Pass-through — billed to the client, remitted to a third party ───────
  // Not agency revenue. Excluded from MRR, one-time revenue AND revenue
  // totals; reported separately so the cash movement is still visible.
  {
    name: 'Advertising Spend',
    category: 'Pass-Through',
    color: 'bg-slate-100 text-slate-700',
    aliases: ['Ad Spend', 'Media Spend'],
  },
  {
    name: 'Client Reimbursable Expenses',
    category: 'Pass-Through',
    color: 'bg-stone-100 text-stone-700',
    // Replaces the previous free-text 'Travel Expense' and 'Amazon Order'
    // values — kept as aliases so historical records reclassify to
    // pass-through automatically instead of being counted as revenue.
    aliases: ['Travel Expense', 'Amazon Order', 'Reimbursable Expenses', 'Expenses'],
  },
  // ── One-time jobs ────────────────────────────────────────────────────────
  {
    name: 'Onboarding and Setup Fee',
    lane: 'Marketing', layer: 'Foundation', category: 'One-Time Build',
    color: 'bg-sky-100 text-sky-700',
    aliases: ['Onboarding Fee', 'Setup Fee', 'Onboarding'],
  },
  {
    name: 'Content and Creative',
    lane: 'Marketing', layer: 'Foundation', category: 'One-Time Build',
    color: 'bg-rose-100 text-rose-700',
    aliases: ['Content', 'Creative', 'Design', 'Content Marketing'],
  },
  // ── Other — real revenue, billed ad hoc ──────────────────────────────────
  {
    name: 'Cancellation',
    category: 'Other',
    color: 'bg-red-100 text-red-700',
    aliases: ['Cancellation Fee', 'Early Termination'],
  },
  {
    name: 'Hourly Services',
    category: 'Other',
    color: 'bg-zinc-100 text-zinc-700',
    // Billed from logged time entries rather than a contract cadence.
    aliases: ['Hourly', 'Hourly Consulting', 'Consulting'],
  },
] as const satisfies readonly ServiceDefinitionInput[]

export type ServiceName = typeof SERVICES_RAW[number]['name']

export interface ServiceTier {
  label: string
  price: number
  cadence: 'one-time' | 'monthly' | 'hourly'
  minTerm?: string
  note?: string
}

export interface ServiceDefinition {
  name: ServiceName
  lane?: ServiceLane
  layer?: ServiceLayer
  category: ServiceCategory
  color: string
  tiers?: readonly ServiceTier[]
  /** Older free-text values that should visually resolve to this service. */
  aliases?: readonly string[]
}

// Re-typed against the uniform-shape interfaces above (SERVICES_RAW's literal
// union type has each tier/aliases key present only on the entries that
// declared it, which makes property access across the union fail) — this
// assignment is structurally safe since `satisfies` already validated it.
export const SERVICES: readonly ServiceDefinition[] = SERVICES_RAW

export const SERVICE_NAMES: readonly ServiceName[] = SERVICES.map((s) => s.name)

export function servicesByLane(lane: ServiceLane) {
  return SERVICES.filter((s) => s.lane === lane)
}

export function servicesByLayer(layer: ServiceLayer) {
  return SERVICES.filter((s) => s.layer === layer)
}

export function getService(name: string) {
  return SERVICES.find((s) => s.name === name || s.aliases?.includes(name))
}

/**
 * Whether a service is sold as ongoing monthly work or as a one-time job.
 *
 * This is the identifier that keeps recurring and one-time revenue accounted
 * for separately. It is deliberately a property of the *service*, not of the
 * contract: 'Website Build' is a one-time job no matter how the client pays
 * for it, and 'SEO / AEO / GEO' is a retainer no matter what.
 *
 * That distinction matters because the two can legitimately disagree. A
 * $10,000 Website Build can be contracted as 12 monthly payments — a payment
 * plan. The contract's `billing_structure` says Monthly and the retainer cron
 * correctly invoices it every month, but it is NOT recurring revenue: it ends
 * when the build is paid off, and counting it in MRR would overstate the
 * agency's actual run rate by the size of every active payment plan.
 * `lib/metrics.ts` uses this to keep those apart.
 *
 * Returns null for a service the catalog doesn't recognize (legacy free-text
 * values like 'Consulting' or 'General'). Null means "unknown", not "one-time"
 * — callers fall back to the contract's own billing structure rather than
 * silently reclassifying historical records.
 */
export type RevenueKind = 'recurring' | 'one-time' | 'pass-through' | 'other'

export function serviceRevenueKind(name?: string | null): RevenueKind | null {
  if (!name) return null
  const service = getService(name)
  if (!service) return null
  switch (service.category) {
    case 'Ongoing MRR': return 'recurring'
    case 'One-Time Build': return 'one-time'
    // Billed to the client, remitted to a third party. Never revenue.
    case 'Pass-Through': return 'pass-through'
    // Real revenue, billed ad hoc — training, cancellation fees, hourly.
    case 'Other': return 'other'
    // Fractional engagements are sold as monthly retainer tiers (Tier 1-3),
    // alongside a one-time assessment and hourly blocks. The retainer is the
    // ongoing part and the reason a fractional client is on the books, so the
    // service classifies as recurring; the one-time assessment is contracted
    // separately, and hourly blocks are billed from time tracking rather
    // than through a contract at all.
    case 'Fractional Engagement': return 'recurring'
  }
}

/** Pre-existing free-text service values that predate this catalog. Kept for
 * backward-compatible badge coloring of historical records only — never
 * offered as a choice on new records. */
export const LEGACY_SERVICE_NAMES = [
  'Branding', 'Custom', 'General', 'Development', 'Content', 'Design',
  'Marketing', 'PPC', 'Content Marketing', 'Consulting', 'Maintenance',
] as const
export type LegacyServiceName = typeof LEGACY_SERVICE_NAMES[number]

const LEGACY_SERVICE_COLORS: Record<LegacyServiceName, string> = {
  Branding: 'bg-amber-100 text-amber-700',
  Custom: 'bg-purple-100 text-purple-700',
  General: 'bg-gray-100 text-gray-600',
  Development: 'bg-indigo-100 text-indigo-700',
  Content: 'bg-yellow-100 text-yellow-700',
  Design: 'bg-rose-100 text-rose-700',
  Marketing: 'bg-fuchsia-100 text-fuchsia-700',
  PPC: 'bg-red-100 text-red-700',
  'Content Marketing': 'bg-yellow-100 text-yellow-700',
  Consulting: 'bg-slate-100 text-slate-700',
  Maintenance: 'bg-purple-100 text-purple-700',
}

/** Any value that has ever been a valid service_type/team_service_line —
 * used for server-side enum validation so old data never gets rejected. */
export const ALL_SERVICE_VALUES: readonly string[] = Array.from(
  new Set([
    ...SERVICES.flatMap((s) => [s.name, ...(s.aliases ?? [])]),
    ...LEGACY_SERVICE_NAMES,
  ]),
)

/**
 * AUDIT.md #181 — the new-client wizard and portal Services Hub use a
 * shorter, client-facing taxonomy (SEO/PPC/Web Design/Social Media/Email
 * Marketing/Content Creation/Sales Training/Marketing Strategy) that
 * predates this catalog and doesn't fully overlap it — 3 of the 8 values
 * aren't in ALL_SERVICE_VALUES at all, so handing one straight to a route
 * that validates serviceType against this catalog (e.g.
 * POST /api/delivery/workflow) silently 400s. Maps each portal-taxonomy
 * value to its closest valid catalog value so those calls succeed instead
 * of failing closed with no visible error.
 */
export const PORTAL_TO_CATALOG_SERVICE: Record<string, string> = {
  'SEO':               'SEO',
  'PPC':               'PPC',
  'Web Design':        'Website Build',
  'Social Media':      'Social Media',
  'Email Marketing':   'Email Marketing',
  'Content Creation':  'Content Marketing',
  'Sales Training':    'Sales Training',
  'Marketing Strategy': 'Marketing',
}

export function toCatalogServiceValue(portalService: string): string {
  return PORTAL_TO_CATALOG_SERVICE[portalService] ?? portalService
}

/** Canonical + legacy color map. Replaces lib/utils.ts's serviceTypeColors
 * and the separate copy in app/time-tracking/page.tsx. Unrecognized values
 * fall back to gray at the call site, same as before. */
export const serviceTypeColors: Record<string, string> = {
  ...Object.fromEntries(SERVICES.map((s) => [s.name, s.color])),
  ...Object.fromEntries(SERVICES.flatMap((s) => (s.aliases ?? []).map((a) => [a, s.color] as const))),
  ...LEGACY_SERVICE_COLORS,
}

/**
 * Best-effort classification of free text (CSV import columns, HubSpot deal
 * type/name) into one canonical service name. Order matters — more specific
 * phrases are checked before generic ones. Shared by app/api/crm/import and
 * app/api/integrations/hubspot/deals so the two don't drift, as they had
 * before (one defaulted to 'Custom', the other to 'General', and only one
 * recognized Development/Marketing/Content/Design).
 */
export function normalizeServiceType(val?: string | null, fallback?: string | null): string {
  const check = (val ?? fallback ?? '').toLowerCase()
  if (!check) return 'General'
  if (check.includes('fractional cmo') || check.includes('marketing advisor') || check.includes('embedded marketing lead')) return 'Fractional CMO'
  if (check.includes('fractional cro') || check.includes('fractional sales') || check.includes('sales advisor') || check.includes('embedded sales lead')) return 'Fractional Sales Lead / CRO'
  if (check.includes('sales training') || check.includes('ae sprint')) return 'Sales Training'
  if (check.includes('sales coaching')) return 'Sales Coaching'
  if (check.includes('enablement support')) return 'Sales Enablement Support'
  if (check.includes('sales enablement') || check.includes('enablement foundation') || check.includes('enablement core') || check.includes('enablement system')) return 'Sales Enablement'
  // Pass-through first: "ad spend" also contains "ad", and misreading spend
  // as the management fee would count a client's media budget as revenue.
  if (check.includes('ad spend') || check.includes('media spend') || check.includes('adspend')) return 'Advertising Spend'
  if (check.includes('reimburs') || check.includes('travel expense') || check.includes('amazon order') || check.includes('expense')) return 'Client Reimbursable Expenses'

  if (check.includes('cancellation') || check.includes('early termination')) return 'Cancellation'
  if (check.includes('onboarding fee') || check.includes('setup fee')) return 'Onboarding and Setup Fee'

  // 'maintenance' is how this team titles ongoing website work (see the
  // real deal titles 'Web + Maintenance' / 'Website Maintenance Transfer'),
  // so it has to beat the generic 'website' → Build rule below.
  // Matched as two independent tokens rather than an adjacent phrase: the
  // real titles include 'Web + Maintenance', where the '+' defeats any
  // 'web maintenance' substring check.
  if (check.includes('website manage')
    || (check.includes('maintenance') && (check.includes('web') || check.includes('site')))
    || (check.includes('hosting') && check.includes('manage'))) return 'Website Management'
  if (check.includes('website') || check.includes('web design') || check.includes('web dev')) return 'Website Build'

  // Word-boundary match, not a plain substring check — 'geo' in particular
  // is a common substring of real company/deal names with no relation to
  // SEO ("Georgia Outdoor Advertising" was misclassified as SEO/AEO/GEO
  // before this fix, purely because "Georgia" contains "geo").
  if (/\b(seo|aeo|geo)\b/.test(check)) return 'SEO Management'
  if (check.includes('social')) return 'Social Media Management'
  if (check.includes('advertis') || check.includes('paid ads') || check.includes('google ads') || check.includes('ppc')) return 'Advertising Management'
  if (check.includes('email')) return 'Email Marketing'
  if (check.includes('hourly') || check.includes('consulting')) return 'Hourly Services'
  // Branding/content/design/creative are all the same deliverable line now.
  if (check.includes('brand') || check.includes('content') || check.includes('design') || check.includes('creative')) return 'Content and Creative'
  if (check.includes('develop')) return 'Website Build'
  // 'marketing' alone is too vague to place — 'General' is the honest answer
  // rather than inventing a service line for it.
  return 'General'
}
