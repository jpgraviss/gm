import { NextRequest, NextResponse } from 'next/server'

/**
 * Cursor-based pagination helper. Uses `created_at` as the ordering key —
 * stable, non-skipping, works on any table with a `created_at timestamptz`.
 *
 * Backwards-compatible: the response body stays an array, and the next
 * cursor is returned via the `X-Next-Cursor` response header. Clients that
 * don't know about pagination just get the first page silently.
 *
 * Usage in a GET handler:
 *   const { limit, cursor, orderBy } = parsePagination(req)
 *   let query = db.from('deals').select('*').order(orderBy, { ascending: false }).limit(limit + 1)
 *   if (cursor) query = query.lt(orderBy, cursor)
 *   const { data } = await query
 *   const { rows, nextCursor } = slicePage(data, limit, orderBy)
 *   return paginatedJson(rows.map(mapRow), nextCursor)
 */

export const DEFAULT_LIMIT = 1000
export const MAX_LIMIT = 5000

export function parsePagination(req: NextRequest): {
  limit: number
  cursor: string | null
  orderBy: string
} {
  const { searchParams } = new URL(req.url)
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT
  const cursor = searchParams.get('cursor')
  const orderBy = searchParams.get('order_by') ?? 'created_at'
  return { limit, cursor, orderBy }
}

/**
 * Slice the fetched rows into a page + next cursor. Call with `limit + 1`
 * rows — if the extra row exists, it becomes the next cursor.
 */
export function slicePage<T extends Record<string, unknown>>(
  rows: T[] | null,
  limit: number,
  orderByField: string,
): { rows: T[]; nextCursor: string | null } {
  const list = rows ?? []
  const hasMore = list.length > limit
  const page = hasMore ? list.slice(0, limit) : list
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? String(last[orderByField] ?? '') : null
  return { rows: page, nextCursor }
}

/**
 * Return a JSON response with the paginated rows as the body and the next
 * cursor exposed via the X-Next-Cursor header. Backwards-compatible with
 * clients that expect a plain array body.
 */
export function paginatedJson(rows: unknown[], nextCursor: string | null, status = 200) {
  const headers: Record<string, string> = {}
  if (nextCursor) headers['X-Next-Cursor'] = nextCursor
  return NextResponse.json(rows, { status, headers })
}
