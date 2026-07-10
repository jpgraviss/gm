/**
 * Single source of truth for GravHub/Graviss Marketing brand constants.
 * Plain values only (no server imports) so this is safe to use from both
 * client components (PDF generation) and server code. lib/settings.ts's
 * DB-overridable defaults, lib/audit-template.ts, and
 * lib/templates/generate-monthly-report.ts all derive from this instead of
 * each hardcoding their own copy of the same six hex values.
 */

export const BRAND_COLORS = {
  primary: '#015035',   // forest green — headers, borders, CTAs, score indicators
  secondary: '#FFF3EA', // warm cream — page/card backgrounds, highlight blocks
  accent: '#CC7853',    // terracotta — accent badges, secondary CTA, callouts
  ink: '#1B211D',       // near-black — body text, section titles
  stone: '#8C8478',     // muted gray — captions, metadata
  darkBg: '#012b1e',    // near-black-green — header/footer bands
} as const

export const BRAND_FONTS = {
  heading: "'Syncopate', sans-serif",
  body: "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
} as const

export const BRAND_NAME = {
  company: 'Graviss Marketing',
  app: 'GravHub',
} as const

/** Matches lib/audit-template.ts's SECTION_TEMPLATE.scorecard.gradeScale. */
export const GRADE_COLORS: Record<string, string> = {
  A: '#059669',
  B: BRAND_COLORS.primary,
  C: BRAND_COLORS.accent,
  D: '#d97706',
  F: '#dc2626',
}

export function gradeColorHex(grade: string): string {
  return GRADE_COLORS[grade] ?? '#6b7280'
}
