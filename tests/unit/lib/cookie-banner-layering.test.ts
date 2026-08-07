import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * The cookie banner sits below modals, and does not eat clicks around itself.
 *
 * AUDIT #785. The banner is `fixed bottom-0 left-0 right-0` — a full-width bar
 * pinned to the bottom of the viewport — and it was `z-[9999]`, which put it on
 * top of every modal in the app (they start at z-50). Modal footers are at the
 * bottom of the modal, which on an ordinary laptop viewport is inside the strip
 * the banner covers. Measured on 1280x720 with the Add Keyword modal open: the
 * banner's box ran y=507→720, the "Add Keyword" submit button sat at y=626, and
 * `document.elementFromPoint` at the button's centre returned the banner. The
 * form could not be submitted at all.
 *
 * The failure is invisible from inside the app — no error, no log, the button
 * is right there and looks enabled. It only shows up when something actually
 * tries to click it, which is why `tools/interact.mjs` found it on its first
 * run and ~780 source-level findings had not.
 *
 * It also only affects people who have not yet accepted or declined, i.e. every
 * new user, exactly once, on whatever they were trying to do first.
 */

const root = resolve(__dirname, '../../..')
const banner = readFileSync(join(root, 'components/ui/CookieConsent.tsx'), 'utf-8')

/**
 * Every z-index level named in a `className`, as a number.
 *
 * Only inside `className`, deliberately: the comments in these files discuss
 * the layers they are choosing between, and a check that reads prose finds the
 * z-50 in the sentence explaining why the code is not z-50.
 */
function zLevels(source: string): number[] {
  const classNames = [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
    .map(m => m[1] ?? m[2])
  return classNames.flatMap(cls =>
    [...cls.matchAll(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?=\s|$)/g)].map(m => Number(m[1] ?? m[2])),
  )
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

describe('cookie banner layering (AUDIT #785)', () => {
  it('never outranks a modal', () => {
    // Modals in this app are z-50 and up. Anything the banner does at 50 or
    // above can cover one, and being pinned to the bottom edge means the part
    // it covers is the footer — the row with the submit button.
    const levels = zLevels(banner)
    expect(levels.length, 'CookieConsent has no z-index at all').toBeGreaterThan(0)
    for (const z of levels) {
      expect(z, `z-${z} is at or above the modal layer (z-50)`).toBeLessThan(50)
    }
  })

  it('still outranks ordinary page chrome', () => {
    // The other direction matters too: dropped below the header dropdowns and
    // the mobile sidebar backdrop (both z-40), the banner would render behind
    // them and become the unclickable thing.
    const chrome = ['components/layout', 'components/ui']
      .flatMap(d => walk(join(root, d)))
      .filter(f => !f.endsWith('CookieConsent.tsx'))
      .flatMap(f => zLevels(readFileSync(f, 'utf-8')))
      .filter(z => z < 50)
    const highestChrome = Math.max(...chrome)
    expect(Math.max(...zLevels(banner))).toBeGreaterThanOrEqual(highestChrome)
  })

  it('does not swallow clicks through its transparent padding', () => {
    // The wrapper is a full-width bar with `p-4 sm:p-6` of empty space around
    // the card. That padding is invisible and was still taking pointer events,
    // so it blocked whatever sat behind it near the bottom of any page.
    expect(banner, 'the fixed wrapper needs pointer-events-none').toMatch(
      /className="fixed bottom-0[^"]*pointer-events-none/,
    )
    expect(banner, 'the card itself needs pointer-events-auto back').toMatch(
      /pointer-events-auto/,
    )
  })
})
