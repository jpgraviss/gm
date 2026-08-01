import type { SupabaseClient } from '@supabase/supabase-js'

export const CLIENT_FILES_BUCKET = 'client-files'

// AUDIT.md #584 — two companies whose names differ only by punctuation
// ("Acme, Inc." vs "Acme Inc") sanitize to the identical folder here, so
// either company's portal client could list/download the other's files.
// Kept only as the legacy fallback key (pre-migration files, or a company
// with no matching crm_companies row) — resolveFolder() below prefers the
// real company_id whenever one exists.
export function sanitizePath(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-')
}

// Resolves the storage folder key for a company: its real crm_companies.id
// when one exists (collision-proof, matches every other company-scoped
// table in the app), falling back to the lossy sanitized-name slug only
// for companies with no CRM record (ad-hoc/legacy). Callers that need to
// stay visible to pre-migration files should also check `legacyFolder`.
export async function resolveFolder(
  db: SupabaseClient,
  company: string,
): Promise<{ folder: string; legacyFolder: string }> {
  const legacyFolder = sanitizePath(company)
  const { data } = await db.from('crm_companies').select('id').ilike('name', company).maybeSingle()
  return { folder: data?.id ?? legacyFolder, legacyFolder }
}
