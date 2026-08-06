/**
 * One spelling of an email address, for comparisons (AUDIT #750).
 *
 * The suppression list (`sequence_suppression_list`) is the app's record of
 * "do not email this person". Rows land in it lowercased by most writers, and
 * `app/api/sequences/[id]/enroll/route.ts` documents the assumption outright:
 * *"Check suppression list (emails stored lowercase)"*. But that invariant was
 * enforced nowhere and honoured inconsistently — several readers compared a
 * lowercased needle against `row.email` exactly as stored, and
 * `lib/automations-engine.ts` compared a raw contact address against it
 * without lowercasing either side.
 *
 * That matters because contact addresses genuinely carry mixed case:
 * `POST /api/crm/contacts` stores `body.emails` verbatim, and the CSV import
 * lowercases only for its dedupe comparison, not for what it writes. So a
 * contact saved as `John@Acme.com` who unsubscribes gets a lowercase
 * suppression row, and a check that compares `John@Acme.com` against it finds
 * nothing and mails them anyway.
 *
 * Local parts are technically case-sensitive per RFC 5321, but no mail
 * provider in practice treats them that way, and the alternative here is
 * emailing people who asked not to be emailed. Every comparison against the
 * suppression list goes through this function, on BOTH sides, so a legacy row
 * stored with capitals is still matched.
 */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Builds a lookup set from suppression rows, normalizing what the DB returned.
 *
 * IMPORTANT about what this can and cannot rescue. Normalizing the returned
 * rows only helps for a row the query actually returned:
 *
 *   - `lib/review-campaigns.ts` selects the whole table with no filter, and
 *     `lib/automations-engine.ts` uses `.ilike` (case-insensitive). Both are
 *     genuinely rescued — a legacy row stored as `John@Acme.com` is matched.
 *   - The three `.in('email', [...])` call sites are NOT. Postgres `IN` is
 *     case-sensitive, so a mixed-case row is never returned in the first
 *     place, and there is nothing left for this function to normalize.
 *
 * Those three are correct because migration 20260806120000 lowercased the
 * table and added a CHECK constraint making a mixed-case row impossible to
 * write. **That constraint is the guarantee, not this function.** If it is
 * ever dropped, those three call sites silently regress to the original bug.
 */
export function suppressionSet(
  rows: { email: string | null }[] | null | undefined,
): Set<string> {
  return new Set((rows ?? []).map(r => normalizeEmail(r.email)).filter(Boolean))
}
