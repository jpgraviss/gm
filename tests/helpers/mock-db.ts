/**
 * Shared Supabase mock factory for integration tests.
 * Creates a chainable, thenable mock that simulates Supabase's query builder.
 * When awaited, the chain resolves with { data, error }.
 */
export function createMockDb(overrides?: {
  selectResult?: { data: unknown[] | null; error: unknown }
  insertResult?: { data: unknown; error: unknown }
  updateResult?: { data: unknown; error: unknown }
  deleteResult?: { error: unknown }
}) {
  const defaults = {
    selectResult: { data: [], error: null },
    insertResult: { data: null, error: null },
    updateResult: { data: null, error: null },
    deleteResult: { error: null },
  }
  const cfg = { ...defaults, ...overrides }

  function makeChain(result: { data?: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {
      select: () => chain,
      single: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      order: () => chain,
      eq: () => chain,
      neq: () => chain,
      in: () => chain,
      limit: () => chain,
      ilike: () => chain,
      // Make the chain thenable — Supabase resolves queries on await
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    return chain
  }

  return {
    from: () => ({
      select: () => makeChain(cfg.selectResult),
      insert: () => {
        const chain = makeChain(cfg.insertResult)
        chain.select = () => chain
        return chain
      },
      update: () => {
        const chain = makeChain(cfg.updateResult)
        chain.select = () => chain
        return chain
      },
      delete: () => makeChain(cfg.deleteResult),
      upsert: () => makeChain(cfg.insertResult),
    }),
  }
}
