/**
 * One way to make a write and find out whether it worked (AUDIT #517/#521).
 *
 * The recurring bug this exists to remove is a mutating `fetch` whose
 * response is never inspected, so a rejected write leaves the UI showing
 * success — #212, #100, #294, #567, #517, #521. Every one was silent: the
 * modal closed, the toggle flipped, and nothing had actually changed.
 *
 * Those are all fixed, and a sweep of `app/` and `components/` found no
 * remaining instances (#756). What was still missing is a shape that makes
 * the mistake awkward: `mutateJson` cannot succeed quietly, because the only
 * way to get a value out of it is for the request to have worked.
 *
 * It also fixes a second-order problem the original fixes left behind. The
 * handlers checked `res.ok` and toasted a fixed string — "Failed to update
 * chatbot status" — while the API route had returned a real reason in
 * `{ error }`: not an admin, validation detail, a conflict. #521's own note
 * said the bug was that nothing told the user *why* their click did nothing,
 * and a generic failure message still doesn't. This surfaces the server's
 * message when there is one.
 */

/** A non-2xx response, carrying whatever the route explained. */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Sends a JSON write and returns the parsed response.
 *
 * Throws `ApiError` on a non-2xx, preferring the route's own `error` field
 * over a generic string. Callers catch and toast `err.message`.
 *
 * `fetchImpl` is injectable for tests only; production callers omit it.
 */
export async function mutateJson<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const res = await fetchImpl(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  if (!res.ok) {
    // A route that failed before it could serialise JSON (a 502, an HTML
    // error page) must still produce a usable message rather than a
    // "Unexpected token < in JSON" that means nothing to the reader.
    const parsed = await res.json().catch(() => null)
    const message = typeof parsed?.error === 'string' && parsed.error.trim()
      ? parsed.error
      : `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }

  // 204 and other empty successes are real — a DELETE usually returns
  // nothing. Parsing failure on a 2xx means "no body", not an error.
  return (await res.json().catch(() => null)) as T
}
