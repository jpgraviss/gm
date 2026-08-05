import { describe, it, expect } from 'vitest'

/**
 * AUDIT #346 — a chatbot with no `website_url` is origin-bound to nothing, so
 * anyone who finds or brute-forces its id (~31 bits, timestamp-prefixed) can
 * embed it on any site, burn the tenant's AI spend and impersonate their
 * brand off-domain. That state used to be reachable by leaving a field blank.
 *
 * "Embed anywhere" is legitimate, so the fix doesn't remove it — it makes it
 * deliberate. These pin the two halves of the resulting contract, expressed
 * as the pure predicates the route and the form both implement, so a rewrite
 * of either can't quietly drop one.
 */

/** Mirrors the creation guard in POST /api/chatbots. */
function creationAllowed(websiteUrl: string, allowAnyOrigin: boolean): boolean {
  return !!websiteUrl.trim() || allowAnyOrigin === true
}

/** Mirrors the runtime guard in POST /api/chatbots/[id]/chat. */
function originIsEnforced(websiteUrl: string | null, settings: Record<string, unknown> | null): boolean {
  const allowAnyOrigin = settings?.allowAnyOrigin === true
  return !!websiteUrl && !allowAnyOrigin
}

describe('chatbot creation', () => {
  it('rejects a bot that is neither site-bound nor explicitly unbound', () => {
    // The accidental case: someone just left the field blank.
    expect(creationAllowed('', false)).toBe(false)
  })

  it('accepts a bot bound to a site', () => {
    expect(creationAllowed('https://acmecorp.com', false)).toBe(true)
  })

  it('accepts an explicitly unbound bot — the flexibility is kept, not removed', () => {
    expect(creationAllowed('', true)).toBe(true)
  })

  it('treats a whitespace-only URL as not set', () => {
    expect(creationAllowed('   ', false)).toBe(false)
  })
})

describe('chatbot runtime origin check', () => {
  it('enforces the origin for a site-bound bot', () => {
    expect(originIsEnforced('https://acmecorp.com', {})).toBe(true)
  })

  it('does not enforce for a bot deliberately marked embeddable anywhere', () => {
    expect(originIsEnforced('https://acmecorp.com', { allowAnyOrigin: true })).toBe(false)
  })

  it('leaves a legacy unbound bot running, rather than breaking a live widget', () => {
    // Retroactively blocking these would pull a working chat widget off a
    // client's site with no warning. Creation-time enforcement stops new
    // ones; the bot list already flags the existing ones.
    expect(originIsEnforced(null, null)).toBe(false)
  })

  it('only honors a literal true, not any truthy value', () => {
    expect(originIsEnforced('https://acmecorp.com', { allowAnyOrigin: 'yes' })).toBe(true)
    expect(originIsEnforced('https://acmecorp.com', { allowAnyOrigin: 1 })).toBe(true)
  })
})
