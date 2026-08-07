// Routes AppShell renders without the sidebar/auth chrome — public
// marketing, demo, and pre-auth pages meant to be reachable by people with
// no GravHub session, styled with hardcoded brand colors rather than the
// app's dark-mode CSS variable system. Shared with ThemeContext so it can
// force light mode on the same set AppShell treats as public — otherwise
// a visitor's OS/browser dark-mode preference applies `.dark`'s card/text
// overrides to pages that were never designed to support it.
const PUBLIC_ROUTES = ['/login', '/team-login', '/setup-account', '/portal/setup', '/portal/auth/verify', '/what-we-do']

export function isPublicRoute(pathname: string, isLoggedIn: boolean): boolean {
  return (pathname === '/' && !isLoggedIn)
    || PUBLIC_ROUTES.includes(pathname)
    || pathname.startsWith('/book/')
    || pathname.startsWith('/unsubscribe/')
    || pathname.startsWith('/go/')
    // AUDIT #773 — these were missing, so an external recipient following a
    // contract-signature or proposal link was bounced to /login for an app
    // they have no account in. The server side already treats them as
    // public (`/api/signatures/` and `/api/proposals/view/` are both in
    // proxy.ts's PUBLIC_PREFIXES); only this client-side list disagreed,
    // and the two lists live in different files with nothing pairing them.
    || pathname.startsWith('/sign/')
    || pathname.startsWith('/proposal/')
    // Legacy short links. Each is a server component that redirects to its
    // /go/* equivalent, but they are still evaluated by this gate first.
    || pathname.startsWith('/p/')
    || pathname.startsWith('/b/')
    || pathname.startsWith('/f/')
    || pathname === '/demo'
    || pathname.startsWith('/demo/')
}
