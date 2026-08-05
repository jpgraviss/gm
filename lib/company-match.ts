/**
 * Company-scoped record matching for "company 360" views.
 *
 * Historically the Company detail panel filtered a company's Deals,
 * Contracts, and Invoices with an exact company-NAME string comparison
 * (`d.company === company.name`) even though every one of those tables has
 * carried a real `company_id` FK to `crm_companies` since
 * `add_company_id_fks.sql`. That meant a company rename, a trailing space,
 * or an import-time typo silently dropped real records off that company's
 * own page — with no error and nothing to indicate anything was missing.
 * (Contacts and Activity already keyed off `companyId` correctly; this
 * brings the rest in line.)
 *
 * Prefer the FK. Fall back to a normalized name comparison only for legacy
 * rows whose `companyId` was never backfilled, so nothing that used to be
 * visible disappears.
 */

export interface CompanyScopedRecord {
  companyId?: string | null
  company?: string | null
}

/** Shared name normalization for the legacy no-FK fallback path. Exported so
 *  callers that can't use `belongsToCompany` directly — e.g. a row that has no
 *  `companyId` of its own to prefer — still compare names the same way. */
export function normalizeCompanyName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

/** True when `record` belongs to the given company by FK, or — only when
 *  the record has no FK at all — by normalized name. */
export function belongsToCompany(
  record: CompanyScopedRecord,
  companyId: string,
  companyName: string,
): boolean {
  if (record.companyId) return record.companyId === companyId
  return normalizeCompanyName(record.company) === normalizeCompanyName(companyName)
}

/** Filter helper for the common list case. */
export function filterByCompany<T extends CompanyScopedRecord>(
  records: T[],
  companyId: string,
  companyName: string,
): T[] {
  return records.filter(r => belongsToCompany(r, companyId, companyName))
}
