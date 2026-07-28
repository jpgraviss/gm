import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'

// Contacts can carry a company_id FK (crm_contacts.company_id) and/or a
// legacy free-text company_name — the same "real FK, legacy name fallback"
// split already established for maintenance_records (#417) and the
// company-delete cascade check (lib/crm-cascade.ts). A contact with
// company_id null but a real company_name on file is very likely just
// missing its backfill, not actually unaffiliated — this scans for those
// and matches them against real companies by exact (case-insensitive) name,
// the same normalization convention already used in app/api/crm/
// duplicates/route.ts. Contacts with no company_name at all, or whose name
// doesn't match any real company, are left untouched and reported — no
// email-domain or fuzzy matching, since a wrong guess here silently
// misattributes a contact to the wrong company.

interface MatchPreview {
  contactId: string
  contactName: string
  companyNameOnFile: string
  matchedCompanyId: string
  matchedCompanyName: string
}
interface UnmatchedContact {
  contactId: string
  contactName: string
  companyNameOnFile: string
  ambiguous?: boolean
}

async function computeMatches(db: ReturnType<typeof createServiceClient>) {
  const { data: contacts, error: contactsErr } = await db
    .from('crm_contacts')
    .select('id, full_name, company_name')
    .is('company_id', null)
  if (contactsErr) throw new Error(contactsErr.message || 'Failed to fetch contacts')

  const { data: companies, error: companiesErr } = await db
    .from('crm_companies')
    .select('id, name')
  if (companiesErr) throw new Error(companiesErr.message || 'Failed to fetch companies')

  // AUDIT #513 — group by name instead of keeping only the last company
  // inserted per name, so a real duplicate-name collision (no unique
  // constraint on crm_companies.name, see #243/#236) can be detected and
  // routed to `unmatched` instead of silently picking an arbitrary one.
  const companiesByName = new Map<string, { id: string; name: string }[]>()
  for (const c of companies ?? []) {
    const key = (c.name ?? '').toLowerCase().trim()
    if (!key) continue
    const list = companiesByName.get(key) ?? []
    list.push({ id: c.id, name: c.name })
    companiesByName.set(key, list)
  }

  const matches: MatchPreview[] = []
  const unmatched: UnmatchedContact[] = []

  for (const contact of contacts ?? []) {
    const companyNameOnFile = (contact.company_name ?? '').trim()
    const key = companyNameOnFile.toLowerCase()
    const candidates = key ? companiesByName.get(key) : undefined
    if (candidates?.length === 1) {
      matches.push({
        contactId: contact.id,
        contactName: contact.full_name || '(no name)',
        companyNameOnFile,
        matchedCompanyId: candidates[0].id,
        matchedCompanyName: candidates[0].name,
      })
    } else {
      unmatched.push({
        contactId: contact.id,
        contactName: contact.full_name || '(no name)',
        companyNameOnFile,
        ambiguous: (candidates?.length ?? 0) > 1,
      })
    }
  }

  return { matches, unmatched }
}

// GET — dry run. Computes what would change without writing anything, so
// the UI can show a preview before a real backfill runs.
export const GET = withErrorHandler('crm/contacts/fix-company GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const db = createServiceClient()
  const { matches, unmatched } = await computeMatches(db)
  return NextResponse.json({ matches, unmatched })
})

// POST — recomputes the same matches server-side (never trusts a client-
// supplied list) and actually writes company_id for each matched contact.
export const POST = withErrorHandler('crm/contacts/fix-company POST', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const db = createServiceClient()
  const { matches, unmatched } = await computeMatches(db)

  let updated = 0
  const failures: { contactId: string; error: string }[] = []
  for (const m of matches) {
    const { error } = await db
      .from('crm_contacts')
      .update({ company_id: m.matchedCompanyId })
      .eq('id', m.contactId)
      .is('company_id', null)
    if (error) {
      failures.push({ contactId: m.contactId, error: error.message })
    } else {
      updated++
    }
  }

  return NextResponse.json({ updated, failures, unmatched })
})
