import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * AUDIT #747 — the browser half of push notifications.
 *
 * This logic previously existed twice: once in `lib/push-notifications.ts`
 * with zero callers (nothing marked `'use client'` can import that module —
 * it pulls in `web-push` and `createServiceClient`), and once copied inline
 * into `PushNotificationBanner`. The copies had already drifted: only the
 * dead one had an unsubscribe path, and nothing could reach it.
 *
 * Now there is one implementation, shared by the banner and the Settings
 * toggle, so it is worth pinning down. The two behaviours that matter are
 * both about not lying to the user:
 *
 *  - A failed server registration must undo the browser subscription. A
 *    browser holding a live subscription with no `push_subscriptions` row is
 *    permanently, invisibly broken — it looks enabled and never delivers
 *    (AUDIT #256).
 *  - Unsubscribe must delete the server row BEFORE dropping the browser
 *    subscription, or a failure orphans the row and every send to it fails
 *    until a 410 prunes it.
 */

const VAPID = 'BEl62iUYgUivxIkv69yViEuiBIa1HI0wYQ' // shape only; never used against a real server

function setupBrowser({
  subscribeResult,
  existingSubscription = null,
}: {
  subscribeResult?: () => unknown
  existingSubscription?: unknown
} = {}) {
  const unsubscribe = vi.fn().mockResolvedValue(true)
  const subscription = {
    endpoint: 'https://push.example/abc',
    toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe,
  }
  const pushManager = {
    subscribe: vi.fn(subscribeResult ?? (async () => subscription)),
    getSubscription: vi.fn(async () => existingSubscription),
  }
  const register = vi.fn().mockResolvedValue({ pushManager })

  vi.stubGlobal('navigator', { serviceWorker: { register, ready: Promise.resolve({ pushManager }) } })
  vi.stubGlobal('Notification', Object.assign(
    vi.fn(),
    { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') },
  ))
  vi.stubGlobal('PushManager', function PushManager() {})

  return { subscription, unsubscribe, pushManager, register }
}

/** Loads the module fresh so the module-level VAPID key reflects the current env. */
async function loadModule(vapid: string | undefined = VAPID) {
  vi.resetModules()
  if (vapid === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = vapid
  return import('@/lib/push-client')
}

const originalVapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalVapid === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = originalVapid
})

beforeEach(() => vi.unstubAllGlobals())

describe('isPushSupported', () => {
  it('is false when the browser has no PushManager', async () => {
    setupBrowser()
    vi.unstubAllGlobals()
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('Notification', vi.fn())
    const mod = await loadModule()
    expect(mod.isPushSupported()).toBe(false)
  })

  it('is true when every piece is present', async () => {
    setupBrowser()
    const mod = await loadModule()
    expect(mod.isPushSupported()).toBe(true)
  })
})

describe('subscribeToPush', () => {
  it('registers the subscription with the server', async () => {
    const { subscription } = setupBrowser()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const mod = await loadModule()
    await expect(mod.subscribeToPush()).resolves.toBe(subscription)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/push/subscribe')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).endpoint).toBe('https://push.example/abc')
  })

  it('undoes the browser subscription when the server rejects it', async () => {
    // AUDIT #256. Without this the browser keeps a live subscription that has
    // no row behind it: permanently enabled-looking and permanently silent.
    const { unsubscribe } = setupBrowser()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const mod = await loadModule()
    await expect(mod.subscribeToPush()).rejects.toThrow(/failed to register/i)
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('refuses, without subscribing, when permission is denied', async () => {
    const { pushManager } = setupBrowser()
    vi.stubGlobal('Notification', Object.assign(vi.fn(), {
      permission: 'denied',
      requestPermission: vi.fn().mockResolvedValue('denied'),
    }))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const mod = await loadModule()
    // The message has to say what to do about it — "failed" leaves the user
    // clicking a button that can never work.
    await expect(mod.subscribeToPush()).rejects.toThrow(/blocked/i)
    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses when the server has no VAPID key configured', async () => {
    setupBrowser()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const mod = await loadModule('')
    await expect(mod.subscribeToPush()).rejects.toThrow(/not configured/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('unsubscribeFromPush', () => {
  it('deletes the server row before dropping the browser subscription', async () => {
    // Order matters: reversed, a failed DELETE orphans the row and every
    // send to it fails until a 410 eventually prunes it.
    const order: string[] = []
    const unsubscribe = vi.fn(async () => { order.push('browser'); return true })
    const existing = { endpoint: 'https://push.example/abc', unsubscribe }
    setupBrowser({ existingSubscription: existing })
    vi.stubGlobal('fetch', vi.fn(async () => { order.push('server'); return { ok: true } }))

    const mod = await loadModule()
    await mod.unsubscribeFromPush()

    expect(order).toEqual(['server', 'browser'])
  })

  it('sends the endpoint so only this device is removed', async () => {
    // Deleting by user id would silently sign every other device out of push.
    const existing = { endpoint: 'https://push.example/abc', unsubscribe: vi.fn().mockResolvedValue(true) }
    setupBrowser({ existingSubscription: existing })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const mod = await loadModule()
    await mod.unsubscribeFromPush()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/push/subscribe')
    expect(init.method).toBe('DELETE')
    expect(JSON.parse(init.body)).toEqual({ endpoint: 'https://push.example/abc' })
  })

  it('is a no-op when this browser has no subscription', async () => {
    setupBrowser({ existingSubscription: null })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const mod = await loadModule()
    await expect(mod.unsubscribeFromPush()).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('module boundary', () => {
  it('pulls in no server-only dependency', async () => {
    // The whole reason this file exists. If `web-push` or the Supabase
    // service client ever get imported here, the client helpers become
    // unimportable from a component again and someone re-inlines them.
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(__dirname, '../../../lib/push-client.ts'), 'utf-8')
    // Strip comments first — the module's own header explains WHY it must not
    // import web-push, and a check that reads prose would flag that
    // explanation as the violation it warns about.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    const imports = [...code.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1])
    expect(imports).toEqual([])
    expect(code).not.toMatch(/web-push|createServiceClient|SERVICE_ROLE/)
  })
})
