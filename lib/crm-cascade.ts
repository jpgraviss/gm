// Shared by both company-delete paths (DELETE /api/crm/companies/[id] and
// POST /api/crm/bulk-delete's company path) — AUDIT #96. Decision: block
// deletion when real business records still reference the company
// (contacts/deals/contracts/invoices/projects/proposals), rather than
// cascade-destroy them, since data loss there is irreversible. The
// company's own activity log is the one exception — it's just a history
// of interactions with the company, unreachable in the UI once the
// company itself is gone, so it deletes along with it rather than
// blocking.

export interface CompanyRelatedCounts {
  contacts: number
  deals: number
  contracts: number
  invoices: number
  projects: number
  proposals: number
  renewals: number
  maintenanceRecords: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countByCompany(db: any, table: string, nameColumn: string, companyId: string, companyName: string): Promise<number> {
  // Real match: company_id FK. Fallback: legacy rows that never got a
  // company_id backfilled, matched by name — but only those, so a
  // same-named unrelated company's rows are never counted.
  const [byId, byName] = await Promise.all([
    db.from(table).select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    db.from(table).select('id', { count: 'exact', head: true }).is('company_id', null).eq(nameColumn, companyName),
  ])
  return (byId.count ?? 0) + (byName.count ?? 0)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCompanyRelatedCounts(db: any, companyId: string, companyName: string): Promise<CompanyRelatedCounts> {
  const [contacts, deals, contracts, invoices, projects, proposals, renewals, maintenanceRecords] = await Promise.all([
    countByCompany(db, 'crm_contacts', 'company_name', companyId, companyName),
    countByCompany(db, 'deals', 'company', companyId, companyName),
    countByCompany(db, 'contracts', 'company', companyId, companyName),
    countByCompany(db, 'invoices', 'company', companyId, companyName),
    countByCompany(db, 'projects', 'company', companyId, companyName),
    countByCompany(db, 'proposals', 'company', companyId, companyName),
    countByCompany(db, 'renewals', 'company', companyId, companyName),
    countByCompany(db, 'maintenance_records', 'company', companyId, companyName),
  ])
  return { contacts, deals, contracts, invoices, projects, proposals, renewals, maintenanceRecords }
}

export function hasBlockingRelatedRecords(counts: CompanyRelatedCounts): boolean {
  return Object.values(counts).some(n => n > 0)
}

const COUNT_LABELS: Record<keyof CompanyRelatedCounts, string> = {
  contacts: 'contacts',
  deals: 'deals',
  contracts: 'contracts',
  invoices: 'invoices',
  projects: 'projects',
  proposals: 'proposals',
  renewals: 'renewals',
  maintenanceRecords: 'maintenance records',
}

export function describeRelatedCounts(counts: CompanyRelatedCounts): string {
  return (Object.keys(counts) as (keyof CompanyRelatedCounts)[])
    .filter(key => counts[key] > 0)
    .map(key => `${counts[key]} ${COUNT_LABELS[key]}`)
    .join(', ')
}

// Matches by company_id ONLY — unlike getCompanyRelatedCounts' block check
// above, this is a real, irreversible DELETE, and crm_companies.name has
// no unique constraint. A name-based fallback here could destroy a
// different, still-live company's activity history if it happens to share
// a display name with the one being deleted and has legacy rows with no
// company_id. Any such orphaned rows are simply left behind (safe) rather
// than risk deleting the wrong company's data (not safe).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteCompanyActivities(db: any, companyId: string): Promise<void> {
  await db.from('crm_activities').delete().eq('company_id', companyId)
}
