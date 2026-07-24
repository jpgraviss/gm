import { createServiceClient } from '@/lib/supabase'
import { encrypt, decrypt } from '@/lib/encryption'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { isWithinReauthWindow } from '@/lib/oauth-expiry'

/**
 * Meta (Facebook/Instagram) Marketing API wrapper.
 *
 * Uses Meta's own OAuth 2.0 flow — separate from Google Marketing.
 * Long-lived tokens last ~60 days; there's no refresh token, so once a
 * long-lived token expires the user must re-auth.
 *
 * API docs: https://developers.facebook.com/docs/marketing-apis/
 */

const META_API_VERSION = 'v21.0'
const META_OAUTH_BASE = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`
const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`

export const META_SCOPES = [
  'ads_read',
  'ads_management',
  'business_management',
  // Publishing scopes (gated on Meta App Review). Requested at connect time so
  // one Meta grant covers both ads reporting and Facebook/Instagram publishing.
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
]

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  return `${base}/api/integrations/meta/callback`
}

/**
 * Build the consent URL the browser should be redirected to.
 */
export function metaAuthUrl(state: string): string {
  const clientId = process.env.META_APP_ID
  if (!clientId) throw new Error('META_APP_ID not configured')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: META_SCOPES.join(','),
    state,
  })
  return `${META_OAUTH_BASE}?${params.toString()}`
}

export interface MetaExchangeResult {
  accessToken: string
  expiresAt: Date
  scopes: string[]
  accountEmail?: string
}

interface MetaShortTokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
}

interface MetaLongTokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
}

/**
 * Exchange a short-lived auth code for a short-lived token, then swap it
 * for a long-lived (~60 day) token. Also probes /me for the account email.
 */
export async function exchangeMetaCode(code: string): Promise<MetaExchangeResult> {
  const clientId = process.env.META_APP_ID
  const clientSecret = process.env.META_APP_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('META_APP_ID / META_APP_SECRET not configured')
  }

  // Step 1: code → short-lived token
  const shortParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri(),
    code,
  })
  const shortRes = await fetch(`${META_GRAPH_BASE}/oauth/access_token?${shortParams.toString()}`, {
    method: 'GET',
  })
  if (!shortRes.ok) {
    const body = await shortRes.text()
    throw new Error(`Meta token exchange failed: ${shortRes.status} ${body}`)
  }
  const shortData = (await shortRes.json()) as MetaShortTokenResponse
  const shortToken = shortData.access_token
  if (!shortToken) throw new Error('Meta token exchange returned no access_token')

  // Step 2: short-lived → long-lived token
  const longParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortToken,
  })
  const longRes = await fetch(`${META_GRAPH_BASE}/oauth/access_token?${longParams.toString()}`, {
    method: 'GET',
  })
  if (!longRes.ok) {
    const body = await longRes.text()
    throw new Error(`Meta long-lived token exchange failed: ${longRes.status} ${body}`)
  }
  const longData = (await longRes.json()) as MetaLongTokenResponse
  const longToken = longData.access_token
  if (!longToken) throw new Error('Meta long-lived exchange returned no access_token')

  // Meta long-lived tokens typically live ~60 days. Fall back to 60d if the
  // response omits expires_in.
  const expiresInSec = Number(longData.expires_in ?? 60 * 24 * 60 * 60)
  const expiresAt = new Date(Date.now() + expiresInSec * 1000)

  // Probe /me for account email (non-blocking)
  let accountEmail: string | undefined
  try {
    const meRes = await fetch(`${META_GRAPH_BASE}/me?fields=email,name&access_token=${encodeURIComponent(longToken)}`)
    if (meRes.ok) {
      const me = (await meRes.json()) as { email?: string; name?: string }
      accountEmail = me.email ?? me.name
    }
  } catch {
    /* non-blocking */
  }

  return {
    accessToken: longToken,
    expiresAt,
    scopes: META_SCOPES,
    accountEmail,
  }
}

/**
 * Upsert the single meta_integration row for the current workspace.
 */
export async function upsertMetaIntegration(params: {
  accessToken: string
  expiresAt: Date
  scopes: string[]
  accountEmail?: string
  adAccountId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const db = createServiceClient()
  const workspaceId = DEFAULT_WORKSPACE_ID
  const id = `mi-${workspaceId}`

  await db.from('meta_integration').upsert({
    id,
    workspace_id: workspaceId,
    account_email: params.accountEmail ?? null,
    access_token: encrypt(params.accessToken),
    expires_at: params.expiresAt.toISOString(),
    scopes: params.scopes,
    ad_account_id: params.adAccountId ?? null,
    metadata: params.metadata ?? {},
    status: 'connected',
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id' })
}

/**
 * Return a valid decrypted access token, or null if no token is stored or
 * it has expired. Meta has no refresh-token mechanism, so when the
 * long-lived token expires the user must re-auth.
 */
export async function getValidMetaToken(): Promise<{
  accessToken: string
  accountEmail: string | null
  adAccountId: string | null
} | null> {
  const db = createServiceClient()
  const workspaceId = DEFAULT_WORKSPACE_ID

  const { data } = await db
    .from('meta_integration')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!data || !data.access_token) return null
  if (data.status !== 'connected') return null

  // 6-month re-auth policy — applies to all OAuth connections
  if (!isWithinReauthWindow(data.connected_at)) {
    await db
      .from('meta_integration')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', data.id)
    return null
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at) : null
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    // Mark as expired
    await db
      .from('meta_integration')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', data.id)
    return null
  }

  return {
    accessToken: decrypt(data.access_token),
    accountEmail: data.account_email ?? null,
    adAccountId: data.ad_account_id ?? null,
  }
}

/**
 * Clear tokens on disconnect. Row is kept for audit.
 */
export async function disconnectMeta(): Promise<void> {
  const db = createServiceClient()
  const workspaceId = DEFAULT_WORKSPACE_ID
  await db
    .from('meta_integration')
    .update({
      access_token: null,
      expires_at: null,
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
}

/**
 * Status helper for the settings UI.
 */
export async function getMetaIntegrationStatus(): Promise<{
  connected: boolean
  accountEmail: string | null
  lastSyncAt: string | null
  connectedAt: string | null
  reauthRequired: boolean
}> {
  const db = createServiceClient()
  const workspaceId = DEFAULT_WORKSPACE_ID

  const { data } = await db
    .from('meta_integration')
    .select('account_email, status, updated_at, expires_at, connected_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!data) {
    return { connected: false, accountEmail: null, lastSyncAt: null, connectedAt: null, reauthRequired: false }
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at) : null
  const notExpired = expiresAt ? expiresAt.getTime() > Date.now() : false
  const withinWindow = isWithinReauthWindow(data.connected_at)
  const connected = data.status === 'connected' && notExpired && withinWindow

  return {
    connected,
    accountEmail: data.account_email ?? null,
    lastSyncAt: data.updated_at ?? null,
    connectedAt: data.connected_at ?? null,
    reauthRequired: data.status === 'connected' && !withinWindow,
  }
}

// ─── Graph API calls ───────────────────────────────────────────────────────

async function metaGet<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: accessToken })
  const res = await fetch(`${META_GRAPH_BASE}${path}?${qs.toString()}`, { method: 'GET' })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Meta Graph API ${path} failed: ${res.status} ${body}`)
  }
  return (await res.json()) as T
}

interface MetaPagedResponse<Row> {
  data?: Row[]
  paging?: { next?: string }
}

// Safety cap on pagination loops so a pathological / misbehaving response
// (e.g. a paging.next cursor that never terminates) can't hang a request.
const MAX_META_PAGES = 10

/**
 * Like `metaGet`, but follows the Graph API's `paging.next` cursor (a full
 * URL, already carrying the access token and query params) until there's no
 * more next page or MAX_META_PAGES is hit. Meta's default page size is ~25,
 * so anything with more results than that would otherwise be silently
 * truncated to page 1.
 */
async function metaGetAllPages<Row>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<Row[]> {
  const qs = new URLSearchParams({ ...params, access_token: accessToken })
  let url: string | undefined = `${META_GRAPH_BASE}${path}?${qs.toString()}`

  const rows: Row[] = []
  let pages = 0

  while (url && pages < MAX_META_PAGES) {
    const res: Response = await fetch(url, { method: 'GET' })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Meta Graph API ${path} failed: ${res.status} ${body}`)
    }
    const data = (await res.json()) as MetaPagedResponse<Row>
    rows.push(...(data.data ?? []))
    url = data.paging?.next
    pages++
  }

  return rows
}

export interface MetaAdAccount {
  id: string
  name: string
  currency: string
  timezoneName: string
}

interface RawAdAccount {
  id: string
  name?: string
  currency?: string
  timezone_name?: string
}

/**
 * List ad accounts accessible to the connected user.
 */
export async function listMetaAdAccounts(): Promise<MetaAdAccount[]> {
  const auth = await getValidMetaToken()
  if (!auth) throw new Error('Meta Ads not connected')

  const rows = await metaGetAllPages<RawAdAccount>(
    '/me/adaccounts',
    auth.accessToken,
    { fields: 'id,name,currency,timezone_name' },
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? row.id,
    currency: row.currency ?? '',
    timezoneName: row.timezone_name ?? '',
  }))
}

export interface MetaPage {
  id: string
  name: string
  accessToken: string
  instagramId?: string
  instagramUsername?: string
}

interface RawMetaPage {
  id: string
  name?: string
  access_token?: string
  instagram_business_account?: { id?: string; username?: string }
}

/**
 * List the Facebook Pages the connected user manages, with each Page's own
 * access token and linked Instagram business account (if any). Used by the
 * social connection picker to choose a publish target.
 */
export async function listMetaPages(): Promise<MetaPage[]> {
  const auth = await getValidMetaToken()
  if (!auth) throw new Error('Meta not connected')

  const rows = await metaGetAllPages<RawMetaPage>(
    '/me/accounts',
    auth.accessToken,
    { fields: 'id,name,access_token,instagram_business_account{id,username}' },
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? row.id,
    accessToken: row.access_token ?? '',
    instagramId: row.instagram_business_account?.id,
    instagramUsername: row.instagram_business_account?.username,
  }))
}

export interface MetaAdsSummary {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  conversions: number
}

interface RawInsightAction {
  action_type?: string
  value?: string | number
}

interface RawInsightRow {
  spend?: string | number
  impressions?: string | number
  clicks?: string | number
  ctr?: string | number
  cpc?: string | number
  actions?: RawInsightAction[]
  campaign_id?: string
  campaign_name?: string
}

/**
 * Map a day count to one of Meta's supported `date_preset` literals.
 * Meta supports: last_7d, last_14d, last_28d, last_30d, last_90d.
 */
function datePreset(days: number): string {
  const supported = [7, 14, 28, 30, 90] as const
  const closest = supported.reduce((prev, curr) =>
    Math.abs(curr - days) < Math.abs(prev - days) ? curr : prev,
  )
  return `last_${closest}d`
}

function sumConversions(actions: RawInsightAction[] | undefined): number {
  if (!actions) return 0
  let total = 0
  for (const a of actions) {
    // Count any conversion-ish action type.
    const t = a.action_type ?? ''
    if (t.includes('conversion') || t.includes('purchase') || t.includes('lead') || t === 'complete_registration') {
      total += Number(a.value ?? 0)
    }
  }
  return total
}

/**
 * Account-level summary insights.
 */
export async function getMetaAdsSummary(adAccountId: string, days = 28): Promise<MetaAdsSummary> {
  const auth = await getValidMetaToken()
  if (!auth) throw new Error('Meta Ads not connected')

  const id = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

  const data = await metaGet<{ data?: RawInsightRow[] }>(
    `/${id}/insights`,
    auth.accessToken,
    {
      fields: 'spend,impressions,clicks,ctr,cpc,actions',
      date_preset: datePreset(days),
    },
  )

  const row = (data.data ?? [])[0] ?? {}
  return {
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    cpc: Number(row.cpc ?? 0),
    conversions: sumConversions(row.actions),
  }
}

export interface MetaCampaignRow {
  id: string
  name: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  conversions: number
}

/**
 * Per-campaign insights sorted by spend descending.
 */
export async function getMetaCampaigns(adAccountId: string, days = 28): Promise<MetaCampaignRow[]> {
  const auth = await getValidMetaToken()
  if (!auth) throw new Error('Meta Ads not connected')

  const id = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

  const insightRows = await metaGetAllPages<RawInsightRow>(
    `/${id}/insights`,
    auth.accessToken,
    {
      level: 'campaign',
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions',
      date_preset: datePreset(days),
    },
  )

  const rows: MetaCampaignRow[] = insightRows.map((row) => ({
    id: String(row.campaign_id ?? ''),
    name: row.campaign_name ?? `Campaign ${row.campaign_id ?? ''}`,
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    cpc: Number(row.cpc ?? 0),
    conversions: sumConversions(row.actions),
  }))

  return rows.sort((a, b) => b.spend - a.spend)
}
