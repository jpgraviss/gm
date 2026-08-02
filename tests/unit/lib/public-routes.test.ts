import { describe, it, expect } from 'vitest'
import { isPublicRoute } from '@/lib/public-routes'

// Reported: on mobile Safari/in-app-browser with system dark mode on, the
// /demo walkthrough rendered with near-black cards and unreadable dark-
// green text — globals.css's `.dark .bg-white { background: var(--card-bg) }`
// override, meant for the internal app's dark-mode-aware chrome, was
// applying to public marketing pages built with hardcoded brand colors.
// ThemeContext now consults this same isPublicRoute() list (shared with
// AppShell's own public-route gate) to force light mode there regardless
// of the visitor's stored/system theme preference.
describe('isPublicRoute', () => {
  it('treats the demo walkthrough as public', () => {
    expect(isPublicRoute('/demo', false)).toBe(true)
    expect(isPublicRoute('/demo', true)).toBe(true)
    expect(isPublicRoute('/demo/pipeline', false)).toBe(true)
    expect(isPublicRoute('/demo/proposals', false)).toBe(true)
  })

  it('treats the product explainer and pre-auth pages as public', () => {
    expect(isPublicRoute('/what-we-do', false)).toBe(true)
    expect(isPublicRoute('/login', false)).toBe(true)
    expect(isPublicRoute('/team-login', false)).toBe(true)
    expect(isPublicRoute('/setup-account', false)).toBe(true)
    expect(isPublicRoute('/portal/setup', false)).toBe(true)
    expect(isPublicRoute('/portal/auth/verify', false)).toBe(true)
  })

  it('treats booking/unsubscribe/go prefixes as public', () => {
    expect(isPublicRoute('/book/abc123', false)).toBe(true)
    expect(isPublicRoute('/unsubscribe/token', false)).toBe(true)
    expect(isPublicRoute('/go/xyz', false)).toBe(true)
  })

  it('"/" is public only when logged out', () => {
    expect(isPublicRoute('/', false)).toBe(true)
    expect(isPublicRoute('/', true)).toBe(false)
  })

  it('treats real authenticated app routes as not public', () => {
    expect(isPublicRoute('/crm', true)).toBe(false)
    expect(isPublicRoute('/settings', true)).toBe(false)
    expect(isPublicRoute('/client', true)).toBe(false)
    expect(isPublicRoute('/demolition', false)).toBe(false)
  })
})
