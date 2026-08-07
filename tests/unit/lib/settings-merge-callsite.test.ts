import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Object-shaped settings must be merged onto their defaults, never replaced.
 *
 * AUDIT #782. `app_settings` stores each settings group as a jsonb blob, and
 * a stored row only holds the keys that existed when it was last written. The
 * live row still carries a `legalName` key that no longer appears in
 * `COMPANY_DEFAULTS`, which is what drift looks like from the inside.
 *
 * `setCompany(d.company)` therefore replaced a complete defaults object with
 * a partial one, leaving every absent field `undefined`. React flips those
 * inputs from controlled to uncontrolled, they render blank instead of
 * showing their default, and since `JSON.stringify` drops undefined keys the
 * next Save writes the same partial object back — so the blanks persist and
 * the original values are gone for good. Company details feed invoices,
 * contracts and proposals, so those blanks travel.
 *
 * Nine sibling setters in the same `.then` already merged with `prev`. Two
 * did not. That is this audit's most repeated shape — several parallel things
 * that must agree, with nothing keeping them in step — so it is enforced
 * rather than just fixed.
 *
 * Array-shaped defaults (`CONTACT_TAGS_DEFAULT`) are excluded on purpose:
 * merging two lists is not meaningful, and replacing them is correct. The
 * scan reads each constant's literal to tell the two apart rather than
 * relying on a name convention.
 */

const FILE = resolve(__dirname, '../../../app/settings/page.tsx')
const src = readFileSync(FILE, 'utf-8')

/** Setter names for `useState(SOME_DEFAULTS)` where the constant is an object. */
function objectBackedSetters(): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/const \[\w+, (set\w+)\] = useState\((\w*DEFAULTS?\w*)\)/g)) {
    const [, setter, constant] = m
    const decl = new RegExp(`const ${constant}\\s*(?::[^=]+)?=\\s*(.)`).exec(src)
    // `[` means a list — replacing it wholesale is the correct behaviour.
    if (decl && decl[1] === '{') out.push(setter)
  }
  return out
}

describe('settings load merges rather than replaces (AUDIT #782)', () => {
  const setters = objectBackedSetters()

  it('finds the setters it is meant to guard', () => {
    // A scan that silently matches nothing passes forever. These are the
    // object-shaped settings groups; if the file is restructured this fails
    // loudly rather than going quiet.
    expect(setters.length).toBeGreaterThanOrEqual(5)
    expect(setters).toContain('setCompany')
    expect(setters).toContain('setInvoiceDefaults')
    expect(setters).toContain('setBranding')
  })

  it.each(objectBackedSetters())('%s is never handed a server object directly', setter => {
    const offenders: string[] = []
    src.split('\n').forEach((line, i) => {
      // Comments at the repaired call sites quote the old expression.
      if (/^\s*(\/\/|\/?\*)/.test(line.trim())) return
      // `setX(d.y)` / `setX(data.y)` — a bare replacement. A functional
      // updater reads `setX(prev => …)` and does not match.
      const bare = new RegExp(`\\b${setter}\\((?:d|data)\\.[\\w.?]+\\s*\\)`)
      if (bare.test(line)) offenders.push(`${i + 1}: ${line.trim().slice(0, 110)}`)
    })
    expect(offenders, `merge onto the defaults instead:\n${offenders.join('\n')}`).toEqual([])
  })
})
