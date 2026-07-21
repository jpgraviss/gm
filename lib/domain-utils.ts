// Shared by components/crm/NewContactPanel.tsx (email-blur enrichment) and
// app/crm/contacts/page.tsx (matching a new contact's email domain against
// existing companies' websites) so the "is this a real company domain"
// list can't drift between the two.
export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com',
  'live.com', 'msn.com', 'protonmail.com', 'proton.me', 'mail.com',
])

// Strips protocol/www/path/query so "https://www.Acme.com/about" and
// "acme.com" both normalize to "acme.com" for comparison.
export function normalizeDomain(value: string): string {
  if (!value) return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
}
