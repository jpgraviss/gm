import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { generateExtensionToken } from '@/lib/extension-auth'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToken(row: any) {
  return {
    id:         row.id,
    label:      row.label ?? undefined,
    createdAt:  row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
    revoked:    !!row.revoked_at,
  }
}

async function currentTeamMemberId(req: NextRequest): Promise<string | null> {
  const email = await getAuthenticatedEmail(req)
  if (!email) return null
  const db = createServiceClient()
  const { data } = await db.from('team_members').select('id').eq('email', email).maybeSingle()
  return data?.id ?? null
}

// These routes are called from the Settings page inside GravHub itself
// (real session cookie), unlike everything under /api/extension/track-send,
// /activity, /contact-lookup — those are called BY the browser extension
// and authenticate with an extension token instead. This is the one place
// a real GravHub session mints/revokes those tokens.
export const GET = withErrorHandler('extension/tokens GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const teamMemberId = await currentTeamMemberId(req)
  if (!teamMemberId) return NextResponse.json({ error: 'Could not resolve caller' }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('extension_tokens')
    .select('id, label, created_at, last_used_at, revoked_at')
    .eq('team_member_id', teamMemberId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return NextResponse.json((data ?? []).map(mapToken))
})

export const POST = withErrorHandler('extension/tokens POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const teamMemberId = await currentTeamMemberId(req)
  if (!teamMemberId) return NextResponse.json({ error: 'Could not resolve caller' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const result = validate(body, { label: { type: 'string', maxLength: 100 } })
  if (!result.valid) return validationError(result.error)

  const { token, hash } = generateExtensionToken()
  const db = createServiceClient()
  const { data, error } = await db
    .from('extension_tokens')
    .insert({
      id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      team_member_id: teamMemberId,
      token_hash: hash,
      label: body.label || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // The raw token is only ever returned here, at creation — only its hash
  // is stored, so if the user navigates away without copying it, it's
  // genuinely unrecoverable (same convention as any other API-key issuer).
  return NextResponse.json({ ...mapToken(data), token }, { status: 201 })
})
