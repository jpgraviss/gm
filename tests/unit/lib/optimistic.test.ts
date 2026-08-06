import { describe, it, expect } from 'vitest'
import { replaceById, dropById, upsertById } from '@/lib/optimistic'

/**
 * AUDIT #532 backfill — the logic behind #509 (and #460 before it).
 *
 * Both were the same bug in two files: a row created locally with
 * `task-${Date.now()}`, POSTed, and the response discarded. The server
 * generates its own id and ignores the client's, so the optimistic row kept
 * an id matching nothing in the database. Every later toggle/edit/delete on
 * it 404'd, and the "not found" recovery path then filtered it out of local
 * state — the user watched a task they had just created vanish.
 *
 * Nothing errored at any point. That is why it survived two separate fixes
 * of "the same" bug, and why the operation is now named and tested rather
 * than open-coded a third time.
 */

interface Row { id: string; title: string }

const rows = (): Row[] => [
  { id: 'a', title: 'first' },
  { id: 'tmp-1', title: 'optimistic' },
  { id: 'c', title: 'third' },
]

describe('replaceById', () => {
  it('swaps the optimistic row for the server row', () => {
    const saved = { id: 'real-99', title: 'optimistic' }
    expect(replaceById(rows(), 'tmp-1', saved)).toEqual([
      { id: 'a', title: 'first' },
      saved,
      { id: 'c', title: 'third' },
    ])
  })

  it('leaves no trace of the temporary id', () => {
    // The whole point. A surviving temp id is a row that 404s on every
    // subsequent interaction.
    const out = replaceById(rows(), 'tmp-1', { id: 'real-99', title: 'x' })
    expect(out.map(r => r.id)).not.toContain('tmp-1')
  })

  it('keeps the row in place rather than moving it to the end', () => {
    // Rebuilding via filter-then-append would put it last, which is
    // visibly wrong in an ordered list (project tasks carry a sortOrder).
    const out = replaceById(rows(), 'tmp-1', { id: 'real-99', title: 'x' })
    expect(out.findIndex(r => r.id === 'real-99')).toBe(1)
  })

  it('does not resurrect a row that is already gone', () => {
    // An absent temp id means something else removed it — a concurrent
    // refetch, or a revert that already ran. Re-adding it would bring back
    // a row the user may have just deleted.
    const without = rows().filter(r => r.id !== 'tmp-1')
    expect(replaceById(without, 'tmp-1', { id: 'real-99', title: 'x' })).toEqual(without)
  })

  it('does not mutate the input list', () => {
    const original = rows()
    replaceById(original, 'tmp-1', { id: 'real-99', title: 'x' })
    expect(original.map(r => r.id)).toEqual(['a', 'tmp-1', 'c'])
  })
})

describe('dropById', () => {
  it('removes the row, for reverting a failed create', () => {
    expect(dropById(rows(), 'tmp-1').map(r => r.id)).toEqual(['a', 'c'])
  })

  it('is a no-op for an unknown id', () => {
    expect(dropById(rows(), 'nope').map(r => r.id)).toEqual(['a', 'tmp-1', 'c'])
  })

  it('removes only the matching row', () => {
    const dupes = [{ id: 'a', title: '1' }, { id: 'b', title: '2' }, { id: 'a2', title: '3' }]
    expect(dropById(dupes, 'a').map(r => r.id)).toEqual(['b', 'a2'])
  })
})

describe('upsertById', () => {
  it('replaces an existing row in place', () => {
    const out = upsertById(rows(), { id: 'c', title: 'updated' })
    expect(out).toHaveLength(3)
    expect(out[2]).toEqual({ id: 'c', title: 'updated' })
  })

  it('inserts a row that is missing, for failed-delete recovery', () => {
    // AUDIT #294: a failed DELETE has already optimistically removed the
    // row, so restoring it must insert — mapping over a list that no longer
    // contains it would silently do nothing and the row would stay gone.
    const without = rows().filter(r => r.id !== 'tmp-1')
    const out = upsertById(without, { id: 'tmp-1', title: 'restored' })
    expect(out.map(r => r.id)).toContain('tmp-1')
  })

  it('honours the requested insert position', () => {
    const empty: Row[] = []
    expect(upsertById(empty, { id: 'x', title: 'x' }, 'start').map(r => r.id)).toEqual(['x'])
    const one = [{ id: 'a', title: 'a' }]
    expect(upsertById(one, { id: 'x', title: 'x' }, 'start').map(r => r.id)).toEqual(['x', 'a'])
    expect(upsertById(one, { id: 'x', title: 'x' }, 'end').map(r => r.id)).toEqual(['a', 'x'])
  })

  it('never duplicates on repeated recovery', () => {
    // Two failed deletes in a row, or a refetch racing a revert, must not
    // leave two copies of the same row on screen.
    let out = upsertById(rows(), { id: 'c', title: 'restored' })
    out = upsertById(out, { id: 'c', title: 'restored' })
    expect(out.filter(r => r.id === 'c')).toHaveLength(1)
  })
})
