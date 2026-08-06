import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * "You" is a render fallback. It must never be what gets WRITTEN.
 *
 * AUDIT #519: `sendReply()` on the tickets page and `addNote()` on the
 * project detail page each built their message object with a hardcoded
 * `author: 'You'` and POSTed it. The server stores that string verbatim in
 * the `messages`/`notes` jsonb column, so every colleague who opened the
 * thread later — and, for tickets, the portal client — read the literal word
 * "You" as the author, permanently. It looks right to exactly one person:
 * whoever typed it, on the render immediately after typing it.
 *
 * That finding named two call sites. It missed a third: `handleAddNote()` and
 * `handleAddTask()` in `app/crm/contacts/page.tsx`, which had the same
 * hardcoded literal and PATCH it onto the contact — even though the enclosing
 * component already had `user` in scope and already passed the correct
 * `user?.name || user?.email || 'You'` to `LogActivityForm` twelve lines away.
 * Fixing named call sites one at a time is what let it survive; this test
 * covers the class instead.
 *
 * The rule: a bare `'You'` may not be assigned to an attribution field. The
 * `user?.name || user?.email || 'You'` form is fine and is the point — the
 * literal is reachable there only when there is no session at all, and it is
 * the tail of an expression rather than the whole value.
 */

const root = resolve(__dirname, '../../..')

/** Fields whose value is persisted and later read by someone else. */
const ATTRIBUTION_FIELDS = ['author', 'authorName', 'assignedTo', 'assignee', 'createdBy', 'user']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Matches `author: 'You'` / `assignedTo: "You"` and the JSX prop spelling
 * `authorName={'You'}` — the whole value being the literal.
 *
 * Deliberately does NOT match `user?.name || user?.email || 'You'`: the
 * alternation requires the quote to follow the colon (or `={`) directly, so
 * anything with a real source ahead of the fallback is left alone. That
 * distinction is the entire rule, not an implementation detail — a test that
 * banned the string outright would force call sites to drop the fallback and
 * render `undefined` for a missing session.
 */
const HARDCODED_ATTRIBUTION = new RegExp(
  String.raw`\b(${ATTRIBUTION_FIELDS.join('|')})\s*(?::\s*|=\{)['"]You['"]`,
  'g',
)

describe('persisted attribution never hardcodes "You"', () => {
  const files = [...walk(join(root, 'app')), ...walk(join(root, 'components'))]
    // The demo section is deliberately fabricated data shown to logged-out
    // visitors; there is no session to attribute anything to.
    .filter(f => !f.includes(join('app', 'demo')))
    .map(f => [f.replace(root + '/', ''), readFileSync(f, 'utf-8')] as const)

  it('has files to check — guards against a path typo silently passing', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('finds no attribution field assigned a bare "You"', () => {
    const offenders = files.flatMap(([file, src]) =>
      [...src.matchAll(HARDCODED_ATTRIBUTION)].map(m => `${file}: ${m[0]}`))

    // Each entry is a value that gets stored and read back by someone who
    // is not the person who wrote it.
    expect(offenders).toEqual([])
  })

  it('still allows the session-fallback form', () => {
    // Not vacuous: this asserts the regex is narrow enough to be adoptable.
    // If it flagged this shape, every call site would "fix" it by deleting
    // the fallback, which is worse than the bug it prevents.
    const ok = `author: user?.name || user?.email || 'You',`
    expect([...ok.matchAll(HARDCODED_ATTRIBUTION)]).toEqual([])
  })

  it('catches the exact shape #519 was about', () => {
    // Pins the regex to the real bug so a later loosening is visible here
    // rather than only in a clean full-repo run, which proves nothing.
    const bug = `const note = { body, date, author: 'You' }`
    expect([...bug.matchAll(HARDCODED_ATTRIBUTION)].map(m => m[0])).toEqual([`author: 'You'`])
  })
})
