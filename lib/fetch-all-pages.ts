// Cursor-paginated endpoints (lib/pagination.ts) cap a single response at
// DEFAULT_LIMIT (100) rows and signal more via the X-Next-Cursor response
// header. Callers that need the *complete* result set (not just a page —
// e.g. computing a total across every deal) must follow that cursor until
// it's gone, or they'll silently truncate past the limit with no
// indication anything is missing.
export async function fetchAllPages<T>(baseUrl: string, maxLimit = 500): Promise<T[]> {
  const all: T[] = []
  let cursor: string | null = null
  for (;;) {
    const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    url.searchParams.set('limit', String(maxLimit))
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetch(url.pathname + url.search)
    if (!res.ok) {
      // AUDIT #244 — this used to `break` on a failed page (silently
      // returning whatever had already accumulated) instead of rejecting,
      // so a session expiring or a transient network blip between page 1
      // and page N produced a silently-truncated result with no error —
      // the exact "false all-clear" this helper exists to prevent for the
      // first-page case, just not for later pages. Every call site already
      // has a `.catch()`/try-catch written expecting this to reject on
      // failure; it just never actually fired.
      throw new Error(`fetchAllPages: ${baseUrl} failed with ${res.status}${all.length > 0 ? ` after ${all.length} rows` : ''}`)
    }
    const page = (await res.json()) as T[]
    if (Array.isArray(page)) all.push(...page)
    cursor = res.headers.get('X-Next-Cursor')
    if (!cursor) break
  }
  return all
}
