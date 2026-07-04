/**
 * LinkedIn OAuth 2.0 wrapper for publishing.
 *
 * Uses the "Sign In with LinkedIn using OpenID Connect" + "Share on LinkedIn"
 * products. Member posting uses `w_member_social`; the author URN is the
 * member's `urn:li:person:{sub}` resolved from the userinfo endpoint.
 *
 * Gated on LinkedIn Marketing Developer Platform approval. Requires
 * LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET.
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 */

const LI_AUTH_BASE = 'https://www.linkedin.com/oauth/v2/authorization'
const LI_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LI_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'

export const LINKEDIN_SCOPES = ['openid', 'profile', 'w_member_social']

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  return `${base}/api/integrations/linkedin/callback`
}

/** Build the LinkedIn consent URL. */
export function linkedinAuthUrl(state: string): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID not configured')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri(),
    scope: LINKEDIN_SCOPES.join(' '),
    state,
  })
  return `${LI_AUTH_BASE}?${params.toString()}`
}

export interface LinkedInExchangeResult {
  accessToken: string
  authorUrn: string
  displayName: string
}

/**
 * Exchange an auth code for an access token and resolve the member URN + name.
 */
export async function exchangeLinkedInCode(code: string): Promise<LinkedInExchangeResult> {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not configured')
  }

  const tokenRes = await fetch(LI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    throw new Error(`LinkedIn token exchange failed: ${tokenRes.status} ${body}`)
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string }
  const accessToken = tokenData.access_token
  if (!accessToken) throw new Error('LinkedIn token exchange returned no access_token')

  const meRes = await fetch(LI_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!meRes.ok) {
    const body = await meRes.text()
    throw new Error(`LinkedIn userinfo failed: ${meRes.status} ${body}`)
  }
  const me = (await meRes.json()) as { sub?: string; name?: string }
  if (!me.sub) throw new Error('LinkedIn userinfo returned no subject')

  return {
    accessToken,
    authorUrn: `urn:li:person:${me.sub}`,
    displayName: me.name ?? 'LinkedIn account',
  }
}
