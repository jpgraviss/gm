import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Keeps the automation UI honest about what the engine can actually do.
 *
 * This is the single most-repeated bug class in AUDIT.md: a trigger or action
 * is offered in the builder, saves fine, shows as "Active" — and then does
 * nothing forever, because `lib/automations-engine.ts` has no `case` for it
 * and no error is surfaced anywhere. It has been found and fixed at least
 * four separate times (#425's TriggerType/ActionType drift, the four
 * templates removed for firing triggers nothing emits, #557's dead
 * `meeting_booked` entry, #735's missing billing actions). Each fix was
 * correct and none of them stopped the next one.
 *
 * A test is the only thing that can, because the invariant spans three files
 * that no type system connects: two React pages holding string literals, and
 * a switch statement in a library. So this parses the sources.
 */

const root = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf-8')

const engine = read('lib/automations-engine.ts')
const listPage = read('app/automation/page.tsx')
const builderPage = read('app/automation/builder/page.tsx')

/** Every `case 'X':` in the engine — the actions it can genuinely execute. */
const implementedActions = new Set([...engine.matchAll(/case\s+'([^']+)':/g)].map(m => m[1]))

/** TRIGGER_MAP's values are the human labels stored on an automation row. */
const triggerMapBlock = engine.match(/TRIGGER_MAP[^{]*\{([\s\S]*?)\n\}/)![1]
const knownTriggers = new Set([...triggerMapBlock.matchAll(/:\s*'([^']+)'/g)].map(m => m[1]))

function stringsInArray(source: string, name: string): string[] {
  const block = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\]`))
  if (!block) throw new Error(`${name} not found — the test's parser needs updating, not deleting`)
  return [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1])
}

function recordValues(source: string, name: string): string[] {
  const block = source.match(new RegExp(`const ${name}[^{]*\\{([\\s\\S]*?)\\n\\}`))
  if (!block) throw new Error(`${name} not found — the test's parser needs updating, not deleting`)
  return [...block[1].matchAll(/:\s*'([^']+)'/g)].map(m => m[1])
}

describe('automation UI ↔ engine sync', () => {
  it('parsed something — guards against a silently-passing regex', () => {
    expect(implementedActions.size).toBeGreaterThan(10)
    expect(knownTriggers.size).toBeGreaterThan(5)
  })

  it('every action offered on the automations page is implemented', () => {
    const offered = stringsInArray(listPage, 'ACTION_OPTIONS')
    expect(offered.length).toBeGreaterThan(5)
    expect(offered.filter(a => !implementedActions.has(a))).toEqual([])
  })

  it('every trigger offered on the automations page is recognized', () => {
    const offered = stringsInArray(listPage, 'TRIGGER_OPTIONS')
    expect(offered.length).toBeGreaterThan(3)
    expect(offered.filter(t => !knownTriggers.has(t))).toEqual([])
  })

  it("every action the visual builder can save is implemented", () => {
    const saved = recordValues(builderPage, 'ACTION_TO_DB')
    expect(saved.length).toBeGreaterThan(5)
    expect(saved.filter(a => !implementedActions.has(a))).toEqual([])
  })

  it('every trigger the visual builder can save is recognized', () => {
    const saved = recordValues(builderPage, 'TRIGGER_TO_DB')
    expect(saved.length).toBeGreaterThan(3)
    expect(saved.filter(t => !knownTriggers.has(t))).toEqual([])
  })

  it('every shipped template uses a real trigger and real actions', () => {
    // The case that actually bit: four templates once shipped pointing at
    // triggers nothing in the app ever fired, so they sat 'Active' forever.
    const block = listPage.match(/const AUTOMATION_TEMPLATES[^[]*\[([\s\S]*?)\n\]/)![1]
    const triggers = [...block.matchAll(/trigger:\s*'([^']+)'/g)].map(m => m[1])
    const actionLists = [...block.matchAll(/actions:\s*\[([^\]]*)\]/g)]
      .flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]))

    expect(triggers.length).toBeGreaterThan(0)
    expect(actionLists.length).toBeGreaterThan(0)
    expect(triggers.filter(t => !knownTriggers.has(t))).toEqual([])
    expect(actionLists.filter(a => !implementedActions.has(a))).toEqual([])
  })
})
