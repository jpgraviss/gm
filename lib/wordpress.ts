import { createServiceClient } from '@/lib/supabase'
import { decrypt } from '@/lib/encryption'
import { resolveSafeIp, createPinnedDispatcher } from '@/lib/ssrf-guard'
import type { Agent } from 'undici'

const WP_TIMEOUT = 12_000

export interface WPCheckResult {
  isWordPress: boolean
  wpVersion: string | null
  siteTitle: string | null
  plugins: WPPlugin[]
  themes: WPTheme[]
  coreUpdateAvailable: boolean
  securityHeaders: Record<string, boolean>
  loginPageExposed: boolean
  xmlRpcEnabled: boolean
}

export interface WPPlugin {
  name: string
  slug: string
  version: string
  status: 'active' | 'inactive'
  updateAvailable: boolean
  newVersion?: string
}

export interface WPTheme {
  name: string
  slug: string
  version: string
  active: boolean
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// AUDIT #292 — isPrivateOrInternalUrl() (#260) was only ever enforced at
// monitored-site create/update time. This function previously let fetch's
// default 'follow' behavior chase a 3xx to wherever it pointed with no
// re-validation, so a periodic recheck (or a compromised/malicious site
// 302-ing internally) could reach a private/metadata address — and the
// authenticated plugin/theme calls below attach a real WordPress
// Application Password, which a redirect off-site could exfiltrate. Every
// hop is re-validated before it's fetched; callers that explicitly want the
// raw redirect response (the wp-login.php exposure check) still get it —
// only the URL, not the follow behavior, is guarded in that case.
// Headers that carry credentials/secrets and must never cross an origin
// change on redirect. Native fetch's 'follow' mode strips Authorization
// automatically on cross-origin redirects; since this loop hand-rolls
// redirect-following (to re-validate each hop against SSRF), it has to
// replicate that stripping itself or a compromised/malicious site could
// 302 off-origin and walk away with the WordPress Application Password.
// AUDIT #764 — `x-gravhub-key` was missing. The SEO plugin authenticates
// with that header rather than Authorization, so a site could 302 off-origin
// and collect the GravHub API key even through this loop. The list is
// explicit rather than a heuristic on the header name, so adding a new
// credential header is a deliberate act.
const CREDENTIAL_HEADERS = ['authorization', 'cookie', 'x-gravhub-key']

function stripCredentialHeadersCrossOrigin(
  headers: Record<string, string>,
  fromUrl: string,
  toUrl: string,
): Record<string, string> {
  if (new URL(fromUrl).origin === new URL(toUrl).origin) return headers
  const stripped: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (CREDENTIAL_HEADERS.includes(key.toLowerCase())) continue
    stripped[key] = value
  }
  return stripped
}

// AUDIT #414 — this loop used to call isPrivateOrInternalUrl() (a boolean
// check) per hop and then hand the URL to a plain fetch(), which performs
// its own, independent DNS resolution to actually connect — the same
// DNS-rebinding TOCTOU gap #319 fixed in lib/website-fetch.ts. Each hop now
// uses resolveSafeIp() to get the exact validated address and pins the
// fetch to it via a per-hop undici Agent (createPinnedDispatcher), the same
// mechanism lib/website-fetch.ts uses. The original hostname stays in the
// request URL, so TLS SNI and the Host header sent to the origin are
// unaffected — only the socket's real destination is pinned.
//
// AUDIT #764 — exported. `app/api/wordpress/seo/sync` was reaching a
// DB-supplied site URL with a bare fetch(), which is the whole gap this
// function exists to close, and it sent the GravHub API key with redirects
// followed. `timeoutMs` is a parameter because that route's remote-sync
// call legitimately needs longer than a health check.
export async function wpSafeFetch(url: string, opts: RequestInit = {}, timeoutMs = WP_TIMEOUT): Promise<Response> {
  const wantsManual = opts.redirect === 'manual'
  const originalUrl = url
  let currentUrl = url
  let currentHeaders: Record<string, string> = { 'User-Agent': 'GravHub-WPCheck/1.0', ...(opts.headers as Record<string, string> | undefined) }
  for (let hop = 0; ; hop++) {
    const resolution = await resolveSafeIp(currentUrl)
    if (!resolution.safe) {
      throw new Error('URL resolves to a private or internal address')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const dispatcher = createPinnedDispatcher(resolution.ip, resolution.family)
    const requestInit: RequestInit & { dispatcher: Agent } = {
      ...opts,
      redirect: 'manual',
      signal: controller.signal,
      headers: currentHeaders,
      dispatcher,
    }
    let res: Response
    try {
      res = await fetch(currentUrl, requestInit)
    } finally {
      clearTimeout(timer)
    }
    if (!wantsManual && res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      // Body isn't needed for a redirect hop — safe to tear this
      // connection down immediately rather than following it.
      await dispatcher.destroy()
      if (hop >= 5) throw new Error('Too many redirects')
      const nextUrl = new URL(res.headers.get('location')!, currentUrl).toString()
      currentHeaders = stripCredentialHeadersCrossOrigin(currentHeaders, originalUrl, nextUrl)
      currentUrl = nextUrl
      continue
    }
    // Terminal response — the caller still needs to read its body
    // (res.json()/res.text()), so the dispatcher can't be destroyed here.
    // It's left to undici's own keep-alive timeout to close the idle
    // connection once the caller is done with it.
    return res
  }
}

export async function checkWordPress(
  siteUrl: string,
  credentials?: { username: string; password: string },
): Promise<WPCheckResult> {
  const base = siteUrl.replace(/\/+$/, '')
  const result: WPCheckResult = {
    isWordPress: false,
    wpVersion: null,
    siteTitle: null,
    plugins: [],
    themes: [],
    coreUpdateAvailable: false,
    securityHeaders: {},
    loginPageExposed: false,
    xmlRpcEnabled: false,
  }

  // 1. Detect WordPress via /wp-json/
  try {
    const res = await wpSafeFetch(`${base}/wp-json/`)
    if (res.ok) {
      const data = await res.json()
      if (data.namespaces?.includes('wp/v2')) {
        result.isWordPress = true
        result.siteTitle = data.name ?? null
      }
    }
    result.securityHeaders = {
      xFrameOptions: !!res.headers.get('x-frame-options'),
      xContentTypeOptions: !!res.headers.get('x-content-type-options'),
      strictTransportSecurity: !!res.headers.get('strict-transport-security'),
      contentSecurityPolicy: !!res.headers.get('content-security-policy'),
    }
  } catch { /* not WP or unreachable */ }

  if (!result.isWordPress) return result

  // 2. WP version from HTML generator meta tag
  try {
    const res = await wpSafeFetch(base)
    const html = await res.text()
    const match = html.match(/<meta name="generator" content="WordPress ([\d.]+)"/)
    if (match) result.wpVersion = match[1]
  } catch { /* non-fatal */ }

  // 2b. AUDIT #258 — coreUpdateAvailable was initialized to false and never
  // actually computed; persisted/exposed as if real. Compare the detected
  // version against WordPress.org's own public version-check API (the same
  // one wp-admin itself calls) to make this a real check.
  if (result.wpVersion) {
    try {
      const res = await wpSafeFetch('https://api.wordpress.org/core/version-check/1.7/?version=1.0')
      if (res.ok) {
        const data = await res.json()
        const latest = data?.offers?.[0]?.version as string | undefined
        if (latest) result.coreUpdateAvailable = compareVersions(latest, result.wpVersion) > 0
      }
    } catch { /* non-fatal */ }
  }

  // 3. Login page exposure
  try {
    const res = await wpSafeFetch(`${base}/wp-login.php`, { method: 'HEAD', redirect: 'manual' })
    result.loginPageExposed = res.status === 200
  } catch { /* non-fatal */ }

  // 4. XML-RPC enabled
  try {
    const res = await wpSafeFetch(`${base}/xmlrpc.php`, { method: 'HEAD' })
    result.xmlRpcEnabled = res.status === 200 || res.status === 405
  } catch { /* non-fatal */ }

  // 5. Authenticated checks: plugins + themes
  if (credentials?.username && credentials?.password) {
    const auth = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    try {
      const res = await wpSafeFetch(`${base}/wp-json/wp/v2/plugins`, {
        headers: { Authorization: auth },
      })
      if (res.ok) {
        const plugins = await res.json()
        if (Array.isArray(plugins)) {
          result.plugins = plugins.map((p: Record<string, unknown>) => ({
            name: String((p.name as string) ?? ''),
            slug: String((p.plugin as string) ?? '').split('/')[0] || '',
            version: String((p.version as string) ?? ''),
            status: p.status === 'active' ? 'active' as const : 'inactive' as const,
            updateAvailable: !!(p.update as Record<string, unknown>),
            newVersion: (p.update as Record<string, string>)?.version,
          }))
        }
      }
    } catch { /* non-fatal */ }

    try {
      const res = await wpSafeFetch(`${base}/wp-json/wp/v2/themes`, {
        headers: { Authorization: auth },
      })
      if (res.ok) {
        const themes = await res.json()
        if (Array.isArray(themes)) {
          result.themes = themes.map((t: Record<string, unknown>) => ({
            name: String(((t.name as Record<string, string>)?.rendered ?? t.name) ?? ''),
            slug: String((t.stylesheet as string) ?? ''),
            version: String((t.version as string) ?? ''),
            active: t.status === 'active',
          }))
        }
      }
    } catch { /* non-fatal */ }
  }

  return result
}

export async function runAndStoreWPCheck(siteId: string): Promise<WPCheckResult> {
  const db = createServiceClient()

  const { data: site } = await db
    .from('monitored_sites')
    .select('url, wp_username, wp_app_password')
    .eq('id', siteId)
    .single()

  if (!site) throw new Error('Site not found')

  // AUDIT.md #210 — decrypt() transparently passes through any
  // still-plaintext legacy value (no colons in the stored string), so this
  // is safe for rows saved before the write side started encrypting.
  const creds = site.wp_username && site.wp_app_password
    ? { username: site.wp_username, password: decrypt(site.wp_app_password) }
    : undefined

  const result = await checkWordPress(site.url, creds)

  await db.from('monitored_sites').update({
    is_wordpress: result.isWordPress,
    updated_at: new Date().toISOString(),
  }).eq('id', siteId)

  await db.from('wordpress_checks').insert({
    id: `wpchk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    site_id: siteId,
    is_wordpress: result.isWordPress,
    wp_version: result.wpVersion,
    site_title: result.siteTitle,
    plugins: result.plugins,
    themes: result.themes,
    core_update_available: result.coreUpdateAvailable,
    security_headers: result.securityHeaders,
    login_page_exposed: result.loginPageExposed,
    xmlrpc_enabled: result.xmlRpcEnabled,
    checked_at: new Date().toISOString(),
  })

  return result
}
