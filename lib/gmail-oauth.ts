import { encrypt, decrypt } from './encryption'
import { createServiceClient } from './supabase'
import { googleRedirectUri } from './google-oauth-config'

/**
 * Server-side Gmail OAuth (authorization-code flow) — AUDIT #23.
 *
 * Gmail was connected through Google Identity Services' *browser* token
 * client (`contexts/AuthContext.tsx`), which by design never issues a refresh
 * token: it returns a bare access token that expires in about an hour. So
 * `team_members.gmail_refresh_token` has existed in the schema since the
 * beginning and was never written by anything, and every Gmail-backed feature
 * silently stopped working ~1 hour after a staff member connected, until they
 * manually reconnected. That is worst for the unattended ones — the inbox
 * poller and, more damagingly, sequence reply-detection (#37), where a
 * missing reply means a contact keeps receiving scripted emails *after*
 * they've written back.
 *
 * Only a server-side authorization-code flow with `access_type=offline`
 * yields a refresh token. This module is that flow, mirroring the same
 * pattern `lib/google-drive.ts` and `lib/google-calendar.ts` already use
 * successfully for their own Google connections.
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

/**
 * Matches the scopes the old browser flow requested, so reconnecting doesn't
 * quietly downgrade what the inbox and reply-check can see.
 */
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]

// AUDIT #784 — was `${NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/…`,
// so a deployment without that variable silently asked Google to send users
// back to localhost. Google rejects that with redirect_uri_mismatch on its
// own screen, which this app never sees, so the failure had no trace here.
export function gmailRedirectUri(): string {
  return googleRedirectUri('gmail')
}

export function isGmailOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

export function getGmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: gmailRedirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    // The two parameters the browser token client structurally cannot send,
    // and the entire reason this module exists. `prompt=consent` is required
    // as well as `access_type=offline`: Google only returns a refresh token
    // on a *fresh* grant, so a user who already approved this app would
    // otherwise reconnect and still get no refresh token.
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params}`
}

export interface GmailTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

export async function exchangeGmailCode(code: string): Promise<GmailTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: gmailRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    // Deliberately not echoing the body: Google's token errors can include
    // the code and client_id, and this string reaches logs/Sentry.
    throw new Error(`Gmail token exchange failed (${res.status})`)
  }
  return res.json()
}

async function refreshGmailToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Gmail token refresh failed (${res.status})`)
  const data = await res.json()
  if (!data.access_token) throw new Error('Gmail token refresh returned no access_token')
  return { accessToken: data.access_token as string, expiresIn: Number(data.expires_in) || 3600 }
}

/** The columns any caller needs to resolve a usable token. */
export interface GmailAccount {
  id: string
  gmail_access_token?: string | null
  gmail_refresh_token?: string | null
  gmail_token_expires_at?: string | null
}

export const GMAIL_TOKEN_COLUMNS = 'gmail_access_token, gmail_refresh_token, gmail_token_expires_at'

/** Refresh a minute before Google would, so a slow request can't straddle expiry. */
const EXPIRY_BUFFER_MS = 120_000

/**
 * The single place any Gmail-backed feature should get a token from.
 *
 * Returns a live access token, refreshing and persisting it when the stored
 * one is expired or about to be. Returns null — never throws — when the
 * account isn't connected or the refresh is rejected (a revoked grant, a
 * changed password), because every caller here is a best-effort background
 * job or a route that already degrades gracefully; the important thing is
 * that a dead token now *self-heals* instead of silently disabling the
 * feature until someone notices and reconnects.
 *
 * Accounts connected before this existed have no refresh token, so they keep
 * exactly the old behavior — a valid access token until it expires, then
 * null — until the user reconnects once through the new flow.
 */
export async function getValidGmailToken(
  account: GmailAccount,
  table: 'team_members' | 'app_settings' = 'team_members',
): Promise<string | null> {
  const storedAccess = account.gmail_access_token ? decrypt(account.gmail_access_token) : null

  const stillValid = storedAccess
    && account.gmail_token_expires_at
    && new Date(account.gmail_token_expires_at).getTime() > Date.now() + EXPIRY_BUFFER_MS
  if (stillValid) return storedAccess

  if (!account.gmail_refresh_token) {
    // Legacy browser-flow connection: nothing to refresh with.
    //
    // A *known* expired token is genuinely dead. A missing expiry is not the
    // same thing — it means we never recorded one, not that the token is
    // stale — and the callers this replaced all treated a null expiry as
    // usable. Returning null here instead would have silently disconnected
    // every account whose expiry was never stored, which is a worse bug than
    // the one this module exists to fix.
    if (!account.gmail_token_expires_at) return storedAccess
    return new Date(account.gmail_token_expires_at).getTime() > Date.now()
      ? storedAccess
      : null
  }

  try {
    const { accessToken, expiresIn } = await refreshGmailToken(decrypt(account.gmail_refresh_token))
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const db = createServiceClient()
    await db.from(table).update({
      gmail_access_token: encrypt(accessToken),
      gmail_token_expires_at: expiresAt,
    }).eq('id', account.id)
    return accessToken
  } catch (err) {
    console.error('[gmail-oauth] refresh failed for', account.id, err instanceof Error ? err.message : err)
    return null
  }
}
