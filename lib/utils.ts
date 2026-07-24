// serviceTypeColors now lives in lib/services.ts (the single source of truth
// for the service catalog); re-exported here so existing '@/lib/utils'
// imports keep working.
export { serviceTypeColors } from './services'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// AUDIT #288 — a plain date-only string ("2026-07-22") is parsed as UTC
// midnight; toLocaleDateString() with no explicit timeZone then renders in
// the browser's local zone, rolling back to the previous day for every US
// timezone (verified: TZ=America/Chicago prints "Jul 21" for "2026-07-22").
// This is the exact bug 12+ call sites elsewhere already work around
// ad-hoc by appending 'T12:00:00' before their own `new Date(...)` calls —
// centralizing that same fix here instead of leaving it to be
// independently reinvented (or missed) at every formatDate() call site.
// A real timestamp (has a time component) is left untouched — converting
// a genuine UTC instant to the viewer's local time there is correct.
export function formatDate(dateStr: string): string {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T12:00:00` : dateStr
  return new Date(normalized).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getDaysUntil(dateStr: string): number {
  const today = new Date()
  const target = new Date(dateStr)
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const stageColors: Record<string, string> = {
  Lead: 'bg-gray-100 text-gray-600',
  Qualified: 'bg-blue-100 text-blue-700',
  'Proposal Sent': 'bg-yellow-100 text-yellow-700',
  'Contract Sent': 'bg-orange-100 text-orange-700',
  'Closed Won': 'bg-green-100 text-green-700',
  'Closed Lost': 'bg-red-100 text-red-600',
}

export const proposalStatusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  'Pending Approval': 'bg-amber-100 text-amber-700',
  Approved: 'bg-teal-100 text-teal-700',
  Sent: 'bg-blue-100 text-blue-700',
  Viewed: 'bg-purple-100 text-purple-700',
  Accepted: 'bg-green-100 text-green-700',
  Declined: 'bg-red-100 text-red-600',
}

export const contractStatusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  Viewed: 'bg-purple-100 text-purple-700',
  'Signed by Client': 'bg-yellow-100 text-yellow-700',
  'Countersign Needed': 'bg-orange-100 text-orange-700',
  'Fully Executed': 'bg-green-100 text-green-700',
  Expired: 'bg-red-100 text-red-600',
  Terminated: 'bg-red-200 text-red-800',
}

export const invoiceStatusColors: Record<string, string> = {
  Pending: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-700',
  Overdue: 'bg-red-100 text-red-600',
  Paid: 'bg-green-100 text-green-700',
  Cancelled: 'bg-orange-100 text-orange-600',
}

export const projectStatusColors: Record<string, string> = {
  'Not Started': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Awaiting Client': 'bg-yellow-100 text-yellow-700',
  Completed: 'bg-green-100 text-green-700',
  Launched: 'bg-emerald-100 text-emerald-700',
  'In Maintenance': 'bg-purple-100 text-purple-700',
}

export const renewalStatusColors: Record<string, string> = {
  Upcoming: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  Renewed: 'bg-green-100 text-green-700',
  Churned: 'bg-red-100 text-red-600',
}

// Labels the actual source of an AI-generation-endpoint response
// ('ollama'|'groq'|'gemini'|'cerebras'|'template') so a deterministic
// template fallback (no AI provider reachable) is never presented to the
// user as if it were a real AI draft — the established convention across
// the app's AI-drafting UIs.
export function aiSourceLabel(source: string | undefined): string {
  switch (source) {
    case 'ollama': return '(local AI)'
    case 'groq': return '(AI · Groq)'
    case 'gemini': return '(AI · Gemini)'
    case 'cerebras': return '(AI · Cerebras)'
    default: return '(template — no AI provider configured)'
  }
}
