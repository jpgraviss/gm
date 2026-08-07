import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * No `onAuthStateChange` callback may await.
 *
 * AUDIT #775. supabase-js invokes these callbacks from inside its own auth
 * lock: `GoTrueClient._acquireLock` holds the lock while running the
 * operation, and that operation calls `_notifyAllSubscribers`, which
 * `await`s every subscriber before returning. Any supabase-js call made from
 * within a callback re-enters `_acquireLock`, takes the "already acquired"
 * branch, and queues itself in `pendingInLock` behind the outer operation —
 * which is the very thing waiting on the callback. Neither can proceed.
 *
 * What made this worth a guard rather than a one-line fix is the symptom.
 * Nothing throws. The promise simply never settles, so every downstream
 * `catch`, `!res.ok` check and error boundary stays quiet. In this app it
 * surfaced as a signed-in user being bounced to `/login`: AuthContext's
 * mount-time `getSession()` races a 2s timeout, loses it to the stalled
 * lock, and the bootstrap's `.catch` sets `loading = false` with `user`
 * still null — at which point AppShell redirects. Password sign-in was worse
 * still, because `signInWithPassword()` emits SIGNED_IN from inside the lock
 * itself and therefore never resolved at all.
 *
 * Source-level review had swept this file repeatedly without seeing it; it
 * took driving the real app in a browser (tools/) to find. The rule is
 * mechanical, so it can be enforced mechanically: do the work in a
 * `setTimeout(fn, 0)` instead. A macrotask is required — a microtask still
 * drains before the awaiting lock holder returns.
 */

const root = resolve(__dirname, '../../..')
const SCAN_DIRS = ['app', 'components', 'contexts', 'hooks', 'lib']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Slices out the body of each `onAuthStateChange(...)` argument list by
 * matching brackets, tracking string/template state so a brace or paren
 * inside a literal doesn't throw the depth count off.
 */
function callbackBodies(src: string): { body: string; line: number }[] {
  const out: { body: string; line: number }[] = []
  const needle = /\.onAuthStateChange\s*\(/g
  let m: RegExpExecArray | null
  while ((m = needle.exec(src))) {
    let depth = 1
    let quote: string | null = null
    let hole = 0
    let i = m.index + m[0].length
    for (; i < src.length && depth > 0; i++) {
      const c = src[i]
      const prev = src[i - 1]
      if (quote) {
        if (c === quote && prev !== '\\') quote = null
        else if (quote === '`' && c === '{' && prev === '$') hole++
        else if (quote === '`' && c === '}' && hole > 0) hole--
        continue
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '(' || c === '{' || c === '[') depth++
      else if (c === ')' || c === '}' || c === ']') depth--
    }
    out.push({
      body: src.slice(m.index, i),
      line: src.slice(0, m.index).split('\n').length,
    })
  }
  return out
}

/** Strips comments, which routinely discuss the very `await` being banned. */
function stripComments(body: string): string {
  return body
    .split('\n')
    .filter(l => !/^\s*(\/\/|\/?\*)/.test(l))
    .join('\n')
}

const files = SCAN_DIRS
  .map(d => join(root, d))
  .filter(existsSync)
  .flatMap(d => walk(d))
  .filter(f => readFileSync(f, 'utf-8').includes('.onAuthStateChange'))

describe('onAuthStateChange callbacks never await (AUDIT #775)', () => {
    it('finds the call sites it is meant to guard', () => {
    // A scanner that silently matches nothing passes forever. Both known
    // listeners must be in range: if either file is renamed or the API is
    // wrapped, this fails loudly rather than going quiet.
    expect(files.length).toBeGreaterThanOrEqual(2)
    const rel = files.map(f => f.slice(root.length + 1))
    expect(rel).toContain('contexts/AuthContext.tsx')
    expect(rel).toContain('app/auth/confirm/page.tsx')
  })

  it.each(files.map(f => [f.slice(root.length + 1), f] as const))('%s holds no async work inside the auth lock', (rel, full) => {
    const offenders: string[] = []
    for (const { body, line } of callbackBodies(readFileSync(full, 'utf-8'))) {
      const code = stripComments(body)
      // `async (event, session) =>` / `async function (…)` as the argument.
      if (/onAuthStateChange\s*\(\s*async\b/.test(code)) {
        offenders.push(`${rel}:${line} — callback declared async`)
      }
      if (/\bawait\b/.test(code)) {
        offenders.push(`${rel}:${line} — await inside the callback`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
