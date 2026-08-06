/**
 * Optimistic list updates, as three named operations (AUDIT #509/#460).
 *
 * The pattern these replace appears ~150 times in this codebase as inline
 * `prev.map(x => x.id === id ? next : x)` / `prev.filter(x => x.id !== id)`.
 * Inline is fine; what is not fine is the specific mistake these exist to
 * make impossible.
 *
 * #460 and #509 were the same bug in two files: a row is created locally
 * with a client-generated id (`task-${Date.now()}`), POSTed, and the
 * response never read. The server always generates its OWN id and ignores
 * whatever the client sent, so the optimistic row keeps an id that matches
 * nothing in the database. Every later toggle, edit or delete on that row
 * 404s, and the recovery path — which looks the row up by its (fake) id —
 * can't find it either, so the row is silently dropped from the list. The
 * user watches something they just created disappear.
 *
 * `replaceById` makes the correct move the obvious one: the optimistic row
 * goes in, the SERVER row replaces it, and the temporary id never survives
 * a successful write.
 *
 * These are deliberately pure and id-based rather than a hook or a store.
 * The state container is not the problem; forgetting to read the response
 * is, and that is what a named operation with a test suite pins down.
 */

interface HasId {
  id: string
}

/**
 * Swaps the row carrying `tempId` for the server's version of it.
 *
 * Position is preserved — the row does not jump to the end of the list on
 * save, which is what rebuilding via filter-then-append would do and is
 * visibly wrong in an ordered list.
 *
 * Returns the list unchanged if `tempId` isn't present, rather than
 * appending: an absent row means something else already removed it (a
 * concurrent refetch, a revert), and re-adding it would resurrect a row the
 * user may have just deleted.
 */
export function replaceById<T extends HasId>(list: T[], tempId: string, saved: T): T[] {
  if (!list.some(item => item.id === tempId)) return list
  return list.map(item => (item.id === tempId ? saved : item))
}

/** Removes a row by id — the revert half of an optimistic create. */
export function dropById<T extends HasId>(list: T[], id: string): T[] {
  return list.filter(item => item.id !== id)
}

/**
 * Replaces a row if present, otherwise inserts it.
 *
 * For refetch-after-failure recovery (AUDIT #294): a failed DELETE has
 * already optimistically removed the row, so restoring it has to insert
 * rather than map over nothing. `position` decides where a genuinely new
 * row lands — 'start' for newest-first lists, 'end' for ordered ones.
 */
export function upsertById<T extends HasId>(
  list: T[],
  item: T,
  position: 'start' | 'end' = 'start',
): T[] {
  if (list.some(existing => existing.id === item.id)) {
    return list.map(existing => (existing.id === item.id ? item : existing))
  }
  return position === 'start' ? [item, ...list] : [...list, item]
}
