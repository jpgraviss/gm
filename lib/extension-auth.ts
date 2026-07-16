import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * Auth for the Gmail tracking browser extension. It can't share GravHub's
 * session cookie (different origin — mail.google.com vs. the app), so it
 * authenticates with its own long-lived Bearer token instead. Only the
 * SHA-256 hash is ever stored — same principle as an API key table — so a
 * database read never exposes a usable credential.
 */

export function generateExtensionToken(): { token: string; hash: string } {
  const token = `ghext_${crypto.randomBytes(32).toString('base64url')}`
  return { token, hash: hashExtensionToken(token) }
}

export function hashExtensionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export interface ExtensionCaller {
  teamMemberId: string
  teamMemberName: string
  teamMemberEmail: string
}

/**
 * Verifies the `Authorization: Bearer <token>` header against
 * extension_tokens, rejecting revoked tokens and suspended/deleted staff
 * (same fail-closed convention as every other auth path in this app —
 * suspending someone must actually cut off access, not just the cookie
 * session). Updates last_used_at on success so stale tokens are visible in
 * the Settings UI.
 */
export async function requireExtensionToken(req: NextRequest): Promise<ExtensionCaller | NextResponse> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) {
    return NextResponse.json({ error: 'Missing extension token' }, { status: 401 })
  }

  const db = createServiceClient()
  const hash = hashExtensionToken(token)
  const { data: tokenRow } = await db
    .from('extension_tokens')
    .select('id, team_member_id, revoked_at')
    .eq('token_hash', hash)
    .maybeSingle()

  if (!tokenRow || tokenRow.revoked_at) {
    return NextResponse.json({ error: 'Invalid or revoked extension token' }, { status: 401 })
  }

  const { data: member } = await db
    .from('team_members')
    .select('id, name, email, status')
    .eq('id', tokenRow.team_member_id)
    .maybeSingle()

  if (!member || member.status !== 'active') {
    return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
  }

  db.from('extension_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRow.id)
    .then(() => {}, () => {})

  return { teamMemberId: member.id, teamMemberName: member.name, teamMemberEmail: member.email }
}

export function isExtensionCaller(result: ExtensionCaller | NextResponse): result is ExtensionCaller {
  return !(result instanceof NextResponse)
}
