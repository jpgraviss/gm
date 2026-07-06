import { NextRequest, NextResponse } from 'next/server'
export const DEFAULT_LIMIT = 100
export const MAX_LIMIT = 500

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
 * Apply ordering + cursor filter to a Supabase query. Uses (orderBy, id) as a
 * composite key so rows with identical timestamps don't get skipped.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyCursor<T extends { order: (...args: any[]) => any; limit: (...args: any[]) => any; or: (...args: any[]) => any; lt: (...args: any[]) => any }>(
  query: T,
  { limit, cursor, orderBy }: { limit: number; cursor: string | null; orderBy: string },
): T {
  let q = query
    .order(orderBy, { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1) as T

  if (cursor) {
    const sep = cursor.indexOf('|')
    if (sep !== -1) {
      const ts = cursor.slice(0, sep)
      const id = cursor.slice(sep + 1)
      q = q.or(`${orderBy}.lt.${ts},and(${orderBy}.eq.${ts},id.lt.${id})`) as T
    } else {
      q = q.lt(orderBy, cursor) as T
    }
  }
  return q
}

export function slicePage<T extends Record<string, unknown>>(
  rows: T[] | null,
  limit: number,
  orderByField: string,
): { rows: T[]; nextCursor: string | null } {
  const list = rows ?? []
  const hasMore = list.length > limit
  const page = hasMore ? list.slice(0, limit) : list
  const last = page[page.length - 1]
  const nextCursor = hasMore && last
    ? `${String(last[orderByField] ?? '')}|${String(last['id'] ?? '')}`
    : null
  return { rows: page, nextCursor }
}

export function paginatedJson(rows: unknown[], nextCursor: string | null, status = 200) {
  const headers: Record<string, string> = {}
  if (nextCursor) headers['X-Next-Cursor'] = nextCursor
  return NextResponse.json(rows, { status, headers })
}
