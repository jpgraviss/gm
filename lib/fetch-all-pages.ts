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
    if (!res.ok) break
    const page = (await res.json()) as T[]
    if (Array.isArray(page)) all.push(...page)
    cursor = res.headers.get('X-Next-Cursor')
    if (!cursor) break
  }
  return all
}
