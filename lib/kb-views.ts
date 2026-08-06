/**
 * Opening a Knowledge Base article, including its view count (AUDIT #522).
 *
 * #276 added an atomic `increment_kb_article_views` RPC, fired by
 * `GET /api/knowledge-base/[id]`. But the internal KB page opened an article
 * by switching to the copy it already had in the list — it never called that
 * endpoint, so the RPC never ran. The "X views" figure shown next to every
 * article was permanently 0 for internally-read articles, no matter how many
 * people read them. Nothing errored; the number was just always wrong.
 *
 * The fix is simply *making the request*, which is exactly the kind of thing
 * that is invisible in a diff and untestable inside a page handler — so it
 * lives here, where a test can assert the request happens at all.
 *
 * Reads must never be able to break opening an article: a failed or slow
 * counter update is not a reason to refuse to show someone a document. Every
 * failure path returns the article the caller already had.
 */

export interface ViewableArticle {
  id: string
  views: number
}

/**
 * Fetches the article by id — which is what increments its view counter —
 * and returns it with the server's fresh count.
 *
 * Returns the input unchanged if the request fails, the response is a
 * non-2xx, or the body carries no usable count.
 *
 * `fetchImpl` is injectable purely so this is testable without a live
 * server; production callers pass nothing.
 */
export async function openArticleCountingView<T extends ViewableArticle>(
  article: T,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  try {
    const res = await fetchImpl(`/api/knowledge-base/${article.id}`)
    if (!res.ok) return article
    const fresh = await res.json()
    // A missing or non-numeric count means the shape changed or the row is
    // partial — keep what we had rather than rendering `undefined views`.
    if (typeof fresh?.views !== 'number') return article
    return { ...article, views: fresh.views }
  } catch {
    return article
  }
}
