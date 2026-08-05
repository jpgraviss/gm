/**
 * Server-safe USD formatting.
 *
 * lib/utils.ts's formatCurrency is imported by client components that pull
 * in React/browser-only helpers alongside it; API routes and lib modules
 * need the same formatting without dragging any of that into a server
 * bundle. Same output as formatCurrency so activity-log titles read
 * identically to what the UI shows.
 */
export function formatUsd(value: number | null | undefined): string {
  const n = Number(value) || 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}
