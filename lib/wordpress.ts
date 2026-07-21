import { createServiceClient } from '@/lib/supabase'
import { decrypt } from '@/lib/encryption'

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

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WP_TIMEOUT)
  try {
    return await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { 'User-Agent': 'GravHub-WPCheck/1.0', ...opts.headers },
    })
  } finally {
    clearTimeout(timer)
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
    const res = await fetchWithTimeout(`${base}/wp-json/`)
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
    const res = await fetchWithTimeout(base)
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
      const res = await fetchWithTimeout('https://api.wordpress.org/core/version-check/1.7/?version=1.0')
      if (res.ok) {
        const data = await res.json()
        const latest = data?.offers?.[0]?.version as string | undefined
        if (latest) result.coreUpdateAvailable = compareVersions(latest, result.wpVersion) > 0
      }
    } catch { /* non-fatal */ }
  }

  // 3. Login page exposure
  try {
    const res = await fetchWithTimeout(`${base}/wp-login.php`, { method: 'HEAD', redirect: 'manual' })
    result.loginPageExposed = res.status === 200
  } catch { /* non-fatal */ }

  // 4. XML-RPC enabled
  try {
    const res = await fetchWithTimeout(`${base}/xmlrpc.php`, { method: 'HEAD' })
    result.xmlRpcEnabled = res.status === 200 || res.status === 405
  } catch { /* non-fatal */ }

  // 5. Authenticated checks: plugins + themes
  if (credentials?.username && credentials?.password) {
    const auth = 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

    try {
      const res = await fetchWithTimeout(`${base}/wp-json/wp/v2/plugins`, {
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
      const res = await fetchWithTimeout(`${base}/wp-json/wp/v2/themes`, {
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
