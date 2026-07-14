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
  const [contacts, deals, contracts, invoices, projects, proposals] = await Promise.all([
    countByCompany(db, 'crm_contacts', 'company_name', companyId, companyName),
    countByCompany(db, 'deals', 'company', companyId, companyName),
    countByCompany(db, 'contracts', 'company', companyId, companyName),
    countByCompany(db, 'invoices', 'company', companyId, companyName),
    countByCompany(db, 'projects', 'company', companyId, companyName),
    countByCompany(db, 'proposals', 'company', companyId, companyName),
  ])
  return { contacts, deals, contracts, invoices, projects, proposals }
}

export function hasBlockingRelatedRecords(counts: CompanyRelatedCounts): boolean {
  return Object.values(counts).some(n => n > 0)
}

export function describeRelatedCounts(counts: CompanyRelatedCounts): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${n} ${label}`)
    .join(', ')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteCompanyActivities(db: any, companyId: string, companyName: string): Promise<void> {
  await db.from('crm_activities').delete().eq('company_id', companyId)
  await db.from('crm_activities').delete().is('company_id', null).eq('company_name', companyName)
}
