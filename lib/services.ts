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
export type ServiceCategory = 'One-Time Build' | 'Ongoing MRR' | 'Fractional Engagement'

interface ServiceTierInput {
  label: string
  price: number
  cadence: 'one-time' | 'monthly' | 'hourly'
  minTerm?: string
  note?: string
}

interface ServiceDefinitionInput {
  name: string
  lane: ServiceLane
  layer: ServiceLayer
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
    name: 'SEO / AEO',
    lane: 'Marketing', layer: 'Foundation', category: 'Ongoing MRR',
    color: 'bg-teal-100 text-teal-700',
    tiers: [
      { label: 'Basic', price: 550, cadence: 'monthly' },
      { label: 'Standard', price: 700, cadence: 'monthly' },
      { label: 'Premium', price: 900, cadence: 'monthly' },
    ],
    aliases: ['SEO'],
  },
  {
    name: 'Social Media',
    lane: 'Marketing', layer: 'Foundation', category: 'Ongoing MRR',
    color: 'bg-pink-100 text-pink-700',
    tiers: [
      { label: 'Basic', price: 1500, cadence: 'monthly' },
      { label: 'Standard', price: 2750, cadence: 'monthly' },
      { label: 'Premium', price: 4000, cadence: 'monthly', note: '$4,000+/mo' },
    ],
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
  lane: ServiceLane
  layer: ServiceLayer
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
  if (check.includes('website manage')) return 'Website Management'
  if (check.includes('website') || check.includes('web design') || check.includes('web dev')) return 'Website Build'
  if (check.includes('seo') || check.includes('aeo')) return 'SEO / AEO'
  if (check.includes('social')) return 'Social Media'
  if (check.includes('email')) return 'Email Marketing'
  if (check.includes('brand')) return 'Branding'
  if (check.includes('develop')) return 'Development'
  if (check.includes('market')) return 'Marketing'
  if (check.includes('content')) return 'Content'
  if (check.includes('design')) return 'Design'
  return 'General'
}
