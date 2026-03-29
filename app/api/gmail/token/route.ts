import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/gmail/token?email=user@example.com — retrieve stored Gmail token
export async function GET(req: NextRequest) {
  const email = new URL(req.url).searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('team_members')
    .select('gmail_access_token, gmail_email, gmail_token_expires_at')
    .eq('email', email)
    .single()

  if (error || !data) {
    return NextResponse.json({ gmailToken: null, gmailEmail: null })
  }

  // Check if token is expired (with 5-minute buffer)
  if (data.gmail_token_expires_at) {
    const expiresAt = new Date(data.gmail_token_expires_at)
    const buffer = new Date(Date.now() + 5 * 60 * 1000)
    if (expiresAt < buffer) {
      return NextResponse.json({ gmailToken: null, gmailEmail: data.gmail_email, expired: true })
    }
  }

  return NextResponse.json({
    gmailToken: data.gmail_access_token,
    gmailEmail: data.gmail_email,
  })
}

// POST /api/gmail/token — store Gmail token for a team member
export async function POST(req: NextRequest) {
  const { userEmail, gmailToken, gmailEmail, expiresIn } = await req.json()
  if (!userEmail || !gmailToken) {
    return NextResponse.json({ error: 'userEmail and gmailToken are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString() // default 1 hour

  const { error } = await db
    .from('team_members')
    .update({
      gmail_access_token: gmailToken,
      gmail_email: gmailEmail ?? null,
      gmail_token_expires_at: expiresAt,
    })
    .eq('email', userEmail)

  if (error) {
    console.error('[gmail/token POST]', error)
    return NextResponse.json({ error: 'Failed to store token' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/gmail/token — clear stored Gmail token
export async function DELETE(req: NextRequest) {
  const { userEmail } = await req.json()
  if (!userEmail) return NextResponse.json({ error: 'userEmail is required' }, { status: 400 })

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
}
