import { describe, it, expect, vi } from 'vitest'
import { mutateJson, ApiError } from '@/lib/api-mutate'

/**
 * AUDIT #532 backfill — the shape behind #517 and #521.
 *
 * Both were a mutating `fetch` whose response was never inspected: the New
 * Sequence modal closed with no sequence created and no toast, and a chatbot
 * toggle blocked by `requireAdmin` flipped back on the next refetch with no
 * explanation. The class has a long tail here — #212, #100, #294, #567.
 *
 * The important property is that `mutateJson` **cannot succeed quietly**.
 * There is no way to get a value out of it except by the request having
 * worked, so the original mistake — carrying on as though a rejected write
 * had landed — is not expressible.
 *
 * The second half is the message. Both handlers toasted a fixed string while
 * the route had returned a real reason in `{ error }`. #521's own note said
 * the bug was that nothing told the user *why* their click did nothing — and
 * "Failed to update chatbot status" still doesn't.
 */

function respond(status: number, body: unknown, opts: { invalidJson?: boolean } = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: opts.invalidJson
      ? async () => { throw new SyntaxError('Unexpected token < in JSON') }
      : async () => body,
  }) as unknown as typeof fetch
}

describe('mutateJson on success', () => {
  it('returns the parsed body', async () => {
    const out = await mutateJson<{ id: string }>('/api/sequences', 'POST', { name: 'x' }, respond(201, { id: 'seq-9' }))
    expect(out).toEqual({ id: 'seq-9' })
  })

  it('sends the method, JSON content type and serialised body', async () => {
    const spy = respond(200, {})
    await mutateJson('/api/chatbots/bot-1', 'PATCH', { active: false }, spy)

    const [url, init] = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/api/chatbots/bot-1')
    expect(init.method).toBe('PATCH')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ active: false })
  })

  it('omits the body entirely when none is given', async () => {
    // A DELETE with `body: undefined` serialises to the string "undefined",
    // which some servers reject as a malformed payload.
    const spy = respond(204, null)
    await mutateJson('/api/chatbots/bot-1', 'DELETE', undefined, spy)
    const [, init] = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect('body' in init).toBe(false)
  })

  it('treats an empty 2xx as success, not failure', async () => {
    // A 204 has no body. Failing to parse one is "nothing returned", not an
    // error — throwing here would make every successful DELETE look broken.
    await expect(mutateJson('/api/x', 'DELETE', undefined, respond(204, null, { invalidJson: true })))
      .resolves.toBeNull()
  })
})

describe('mutateJson on failure', () => {
  it('throws rather than returning, so a caller cannot continue', async () => {
    // The whole point. #517 and #521 both carried on as though the write
    // had landed; there is no value to carry on with here.
    await expect(mutateJson('/api/sequences', 'POST', {}, respond(500, { error: 'boom' })))
      .rejects.toBeInstanceOf(ApiError)
  })

  it("surfaces the route's own explanation", async () => {
    // #521's stated problem was that nothing told the user why. A generic
    // string does not fix that; the server's reason does.
    await expect(mutateJson('/api/chatbots/b', 'PATCH', {}, respond(403, { error: 'Only admins can change this' })))
      .rejects.toThrow('Only admins can change this')
  })

  it('carries the status for callers that branch on it', async () => {
    const err = await mutateJson('/api/x', 'POST', {}, respond(409, { error: 'Conflict' })).catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(409)
  })

  it('still gives a usable message when the error body is not JSON', async () => {
    // A 502 from a proxy returns HTML. Without this the user sees
    // "Unexpected token < in JSON", which means nothing to them.
    await expect(mutateJson('/api/x', 'POST', {}, respond(502, null, { invalidJson: true })))
      .rejects.toThrow('Request failed (502)')
  })

  it('falls back when the error field is missing or blank', async () => {
    await expect(mutateJson('/api/x', 'POST', {}, respond(400, {})))
      .rejects.toThrow('Request failed (400)')
    await expect(mutateJson('/api/x', 'POST', {}, respond(400, { error: '   ' })))
      .rejects.toThrow('Request failed (400)')
    // A non-string `error` (some routes return an object) must not become
    // "[object Object]" in a toast.
    await expect(mutateJson('/api/x', 'POST', {}, respond(400, { error: { field: 'name' } })))
      .rejects.toThrow('Request failed (400)')
  })

  it('lets a network rejection propagate', async () => {
    // Offline is not a 4xx. The caller's catch handles both, but conflating
    // them would report a server refusal for a dropped connection.
    const offline = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch
    await expect(mutateJson('/api/x', 'POST', {}, offline)).rejects.toThrow('Failed to fetch')
  })
})
