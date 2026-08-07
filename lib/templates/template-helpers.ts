import { escapeHtml } from '@/lib/html-escape'
export function generateId(): string {
  return `del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}


// AUDIT #621 — this used to substitute values with zero HTML escaping,
// bitten 4 separate callers (#589 fixed generate-growth-report.ts locally
// rather than here; generate-welcome/usage-guide/monthly-report were still
// exposed). Escaping here, not per-caller, so the next new template
// generator gets it for free instead of needing its own local fix.
export function renderTemplate(html: string, variables: Record<string, string>): string {
  let result = html
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{${key}}`, escapeHtml(value))
  }
  return result
}
