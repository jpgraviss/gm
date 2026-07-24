// AUDIT — comparing two objects via plain `JSON.stringify(a) === JSON.stringify(b)`
// is only safe when both came from the same JS-literal construction path.
// Postgres jsonb columns do NOT preserve object key insertion order — they
// normalize it on write, so a value read back after a round trip through
// jsonb storage can have different key order than the in-memory value it
// started as, even though the content is identical. `JSON.stringify` is
// key-order-sensitive, so that comparison spuriously fails. This recursively
// sorts object keys before stringifying so the comparison is order-independent.
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}
