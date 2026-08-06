import { describe, it, expect, vi } from 'vitest'
import { openArticleCountingView } from '@/lib/kb-views'

/**
 * AUDIT #532 backfill — the behaviour behind #522.
 *
 * #276 built an atomic `increment_kb_article_views` RPC, fired by
 * `GET /api/knowledge-base/[id]`. The internal KB page then opened articles
 * by switching to the copy already in its list, so that endpoint was never
 * called and the RPC never ran. Every article showed 0 views forever,
 * however many people read it. Nothing errored — the number was just wrong,
 * which is the hardest kind of wrong to notice.
 *
 * The fix was *making the request*. That is invisible in a diff and
 * impossible to assert from inside a page handler, so the first test below
 * is the one that matters: the request must actually happen.
 */

const article = { id: 'kb-1', title: 'Refunds', views: 0 }

function respond(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch
}

describe('openArticleCountingView', () => {
  it('calls the endpoint that increments the counter', async () => {
    // THE test for #522. Opening from local state alone left the RPC
    // unfired and every count at zero.
    const spy = respond({ views: 41 })
    await openArticleCountingView(article, spy)
    expect(spy).toHaveBeenCalledWith('/api/knowledge-base/kb-1')
  })

  it('returns the server count, not the stale local one', async () => {
    const out = await openArticleCountingView(article, respond({ views: 41 }))
    expect(out.views).toBe(41)
  })

  it('preserves the rest of the article', async () => {
    // The response is a partial row; merging must not drop fields the list
    // already had, or the reader opens a blank document.
    const out = await openArticleCountingView(article, respond({ views: 41 }))
    expect(out.title).toBe('Refunds')
    expect(out.id).toBe('kb-1')
  })

  it('still opens the article when the request fails', async () => {
    // A counter update is never a reason to refuse to show someone a
    // document. Each of these must fall back to what the caller had.
    const rejects = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch
    await expect(openArticleCountingView(article, rejects)).resolves.toEqual(article)
    await expect(openArticleCountingView(article, respond(null, false))).resolves.toEqual(article)
  })

  it('ignores a response with no usable count', async () => {
    // A changed shape or a partial row should leave the old number in
    // place rather than rendering "undefined views".
    await expect(openArticleCountingView(article, respond({}))).resolves.toEqual(article)
    await expect(openArticleCountingView(article, respond({ views: 'lots' }))).resolves.toEqual(article)
    await expect(openArticleCountingView(article, respond({ views: null }))).resolves.toEqual(article)
  })

  it('does not mutate the article it was given', async () => {
    const input = { ...article }
    await openArticleCountingView(input, respond({ views: 41 }))
    expect(input.views).toBe(0)
  })
})
