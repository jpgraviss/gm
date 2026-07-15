import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { withErrorHandler } from '@/lib/api-handler'

async function verifyOwnership(req: NextRequest, targetEmail: string): Promise<NextResponse | null> {
  const callerEmail = await getAuthenticatedEmail(req)
  if (!callerEmail) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (callerEmail !== targetEmail.toLowerCase()) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // getAuthenticatedEmail() only verifies the caller HOLDS a valid session
  // — it never checks team_members.status, so a suspended employee's
  // still-valid Supabase session (suspending someone doesn't revoke it)
  // could otherwise keep reading/rotating/clearing their own Gmail token.
  const db = createServiceClient()
  const { data: member } = await db
    .from('team_members')
    .select('status')
    .eq('email', targetEmail)
    .maybeSingle()
  if (member && member.status !== 'active') {
    return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
  }

  return null
}

// BCC-log domain. Must be a dedicated subdomain configured with Resend
// Inbound (MX records) — cannot reuse the outbound sending domain, which
// already has SPF/DKIM and likely shares MX with real company mail.
const BCC_DOMAIN = 'log.gravissmarketing.com'

function generateBccEmail(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'user'
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${slug}-${suffix}@${BCC_DOMAIN}`
}

// GET /api/gmail/token?email=user@example.com — retrieve stored Gmail token
export const GET = withErrorHandler('gmail/token GET', async (req) => {
  const email = new URL(req.url).searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const denied = await verifyOwnership(req, email)
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('team_members')
    .select('id, name, gmail_access_token, gmail_email, gmail_token_expires_at, gmail_settings, bcc_email')
    .eq('email', email)
    .single()

  if (error || !data) {
    return NextResponse.json({ gmailToken: null, gmailEmail: null })
  }

  let bccEmail = data.bcc_email
  if (!bccEmail) {
    bccEmail = generateBccEmail(data.name)
    const { error: bccErr } = await db.from('team_members').update({ bcc_email: bccEmail }).eq('id', data.id)
    // A unique-constraint collision is vanishingly unlikely given the random
    // suffix; if it happens, just skip persisting rather than fail the whole
    // request — the caller sees no bcc_email this time and retries later.
    if (bccErr) bccEmail = null
  }

  // Check if token is expired (with 5-minute buffer)
  if (data.gmail_token_expires_at) {
    const expiresAt = new Date(data.gmail_token_expires_at)
    const buffer = new Date(Date.now() + 5 * 60 * 1000)
    if (expiresAt < buffer) {
      return NextResponse.json({ gmailToken: null, gmailEmail: data.gmail_email, expired: true, bccEmail })
    }
  }

  return NextResponse.json({
    gmailToken: data.gmail_access_token,
    gmailEmail: data.gmail_email,
    gmailSettings: data.gmail_settings ?? null,
    bccEmail,
  })
})

// POST /api/gmail/token — store Gmail token and/or settings for a team member
export const POST = withErrorHandler('gmail/token POST', async (req) => {
  const { userEmail, gmailToken, gmailEmail, expiresIn, gmailSettings } = await req.json()
  if (!userEmail) {
    return NextResponse.json({ error: 'userEmail is required' }, { status: 400 })
  }

  const denied = await verifyOwnership(req, userEmail)
  if (denied) return denied

  const db = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}

  if (gmailToken) {
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()
    update.gmail_access_token = gmailToken
    update.gmail_email = gmailEmail ?? null
    update.gmail_token_expires_at = expiresAt
  }

  if (gmailSettings !== undefined) {
    update.gmail_settings = gmailSettings
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await db
    .from('team_members')
    .update(update)
    .eq('email', userEmail)

  if (error) {
    throw new Error(error?.message || 'Failed to store token')
  }

  return NextResponse.json({ ok: true })
})

// DELETE /api/gmail/token — clear stored Gmail token
export const DELETE = withErrorHandler('gmail/token DELETE', async (req) => {
  const { userEmail } = await req.json()
  if (!userEmail) return NextResponse.json({ error: 'userEmail is required' }, { status: 400 })

  const denied = await verifyOwnership(req, userEmail)
  if (denied) return denied

  const db = createServiceClient()
  await db
    .from('team_members')
    .update({
      gmail_access_token: null,
      gmail_email: null,
      gmail_token_expires_at: null,
    })
    .eq('email', userEmail)

  return NextResponse.json({ ok: true })
})
