import { createServiceClient } from '@/lib/supabase'
import { encrypt, decrypt } from '@/lib/encryption'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { isWithinReauthWindow } from '@/lib/oauth-expiry'

/**
 * Shared Google OAuth helper for the Phase C marketing products:
 * Search Console, Analytics 4, Ads, Business Profile.
 *
 * Kept separate from lib/google-calendar.ts and lib/google-drive.ts so
 * the existing Calendar/Drive/Gmail flows are unaffected.
 */

export type GoogleMarketingProduct =
  | 'search_console'
  | 'analytics'
  | 'ads'
  | 'business_profile'

const SCOPES_PER_PRODUCT: Record<GoogleMarketingProduct, string[]> = {
  search_console:   ['https://www.googleapis.com/auth/webmasters.readonly'],
  analytics:        [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/analytics.edit',
  ],
  ads:              ['https://www.googleapis.com/auth/adwords'],
  business_profile: ['https://www.googleapis.com/auth/business.manage'],
}

/**
 * Combined list of all scopes requested when connecting the "Google Marketing"
 * integration. One OAuth flow → all 4 products unlocked at once.
 */
export function allMarketingScopes(): string[] {
  return [
    'openid',
    'email',
    'profile',
    ...SCOPES_PER_PRODUCT.search_console,
    ...SCOPES_PER_PRODUCT.analytics,
    ...SCOPES_PER_PRODUCT.ads,
    ...SCOPES_PER_PRODUCT.business_profile,
  ]
}

export function googleMarketingAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirect = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'}/api/integrations/google-marketing/callback`
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: allMarketingScopes().join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
  id_token?: string
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeGoogleMarketingCode(code: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirect = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'}/api/integrations/google-marketing/callback`

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    }).toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google token exchange failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<GoogleTokenResponse>
}

/**
 * Refresh an expired access token using the refresh token. Returns the new
 * access token and its expiry.
 */
export async function refreshGoogleMarketingToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google token refresh failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

interface StoredIntegration {
  id: string
  workspaceId: string
  product: GoogleMarketingProduct
  accountEmail: string | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: Date | null
  scopes: string[]
  metadata: Record<string, unknown>
  status: 'connected' | 'disconnected' | 'expired'
}

/**
 * Persist/upsert tokens for a given product row. One row per
 * (workspace_id, product) — we keep them separate rows so the user can
 * disconnect a single product without touching the others.
 */
export async function upsertGoogleIntegration(
  product: GoogleMarketingProduct,
  params: {
    accountEmail?: string
    accessToken: string
    refreshToken: string
    expiresAt: Date
    scopes: string[]
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const db = createServiceClient()
  const workspaceId = DEFAULT_WORKSPACE_ID
  const id = `gi-${workspaceId}-${product}`

  await db.from('google_integrations').upsert({
    id,
    workspace_id: workspaceId,
    product,
    account_email: params.accountEmail ?? null,
    access_token: encrypt(params.accessToken),
    refresh_token: encrypt(params.refreshToken),
    expires_at: params.expiresAt.toISOString(),
    scopes: params.scopes,
    metadata: params.metadata ?? {},
    status: 'connected',
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,product' })
}

/**
 * Load a valid access token for a product, refreshing if near-expiry.
 * Returns null if the integration hasn't been connected.
 */
export async function getValidMarketingToken(
  product: GoogleMarketingProduct,
): Promise<{ accessToken: string; metadata: Record<string, unknown> } | null> {
  const db = createServiceClient()
  const workspaceId = DEFAULT_WORKSPACE_ID

  const { data } = await db
    .from('google_integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('product', product)
    .maybeSingle()

  if (!data || !data.refresh_token) return null

  // Enforce 6-month re-auth policy — tokens silently expire after 180 days
  // regardless of refresh token validity, forcing a fresh consent.
  if (!isWithinReauthWindow(data.connected_at)) {
    await db
      .from('google_integrations')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', data.id)
    return null
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at) : new Date(0)
  const now = Date.now()
  const metadata = (data.metadata ?? {}) as Record<string, unknown>

  // Token still valid? (>5 min remaining)
  if (data.access_token && expiresAt.getTime() - now > 5 * 60 * 1000) {
    return {
      accessToken: decrypt(data.access_token),
      metadata,
    }
  }

  // Refresh
  try {
    const refreshToken = decrypt(data.refresh_token)
    const { accessToken, expiresAt: newExpiresAt } = await refreshGoogleMarketingToken(refreshToken)

    await db
      .from('google_integrations')
      .update({
        access_token: encrypt(accessToken),
        expires_at: newExpiresAt.toISOString(),
        status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)

    return { accessToken, metadata }
  } catch (err) {
    console.error('[google-marketing] refresh failed', err)
    await db
      .from('google_integrations')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', data.id)
    return null
  }
}

/**
 * Load the status for all 4 products so a Settings page can show what's
 * connected.
 */
export async function getMarketingIntegrationStatuses(): Promise<Array<{
  product: GoogleMarketingProduct
  connected: boolean
  accountEmail: string | null
  lastSyncAt: string | null
  connectedAt: string | null
  reauthRequired: boolean
}>> {
  const db = createServiceClient()
  const workspaceId = DEFAULT_WORKSPACE_ID

  const { data } = await db
    .from('google_integrations')
    .select('product, account_email, status, last_sync_at, connected_at')
    .eq('workspace_id', workspaceId)

  const products: GoogleMarketingProduct[] = ['search_console', 'analytics', 'ads', 'business_profile']
  return products.map((product) => {
    const row = (data ?? []).find((r) => r.product === product)
    const isConnected = row?.status === 'connected'
    const withinWindow = isWithinReauthWindow(row?.connected_at ?? null)
    return {
      product,
      connected: isConnected && withinWindow,
      accountEmail: row?.account_email ?? null,
      lastSyncAt: row?.last_sync_at ?? null,
      connectedAt: row?.connected_at ?? null,
      reauthRequired: isConnected && !withinWindow,
    }
  })
}

/**
 * Disconnect a single product — clears tokens but keeps the row for audit.
 */
export async function disconnectGoogleIntegration(product: GoogleMarketingProduct): Promise<void> {
  const db = createServiceClient()
  const workspaceId = DEFAULT_WORKSPACE_ID
  await db
    .from('google_integrations')
    .update({
      access_token: null,
      refresh_token: null,
      expires_at: null,
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('product', product)
}

export { SCOPES_PER_PRODUCT }
