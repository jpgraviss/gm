import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendViaGmail } from '@/lib/gmail-send'

// POST /api/gmail/send — send an email via the authenticated user's Gmail
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userEmail, to, subject, htmlBody, cc, bcc, replyTo } = body

    if (!userEmail) {
      return NextResponse.json({ error: 'userEmail is required' }, { status: 400 })
    }
    if (!to || !subject || !htmlBody) {
      return NextResponse.json(
        { error: 'to, subject, and htmlBody are required' },
        { status: 400 },
      )
    }

    // ── Look up the user's Gmail token from team_members ──────────────────
    const db = createServiceClient()
    const { data: member, error: memberErr } = await db
      .from('team_members')
      .select('gmail_access_token, gmail_email, gmail_token_expires_at')
      .eq('email', userEmail)
      .single()

    if (memberErr || !member) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!member.gmail_access_token) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 })
    }

    // ── Check token expiry (with 5-minute buffer) ─────────────────────────
    if (member.gmail_token_expires_at) {
      const expiresAt = new Date(member.gmail_token_expires_at)
      const buffer = new Date(Date.now() + 5 * 60 * 1000)
      if (expiresAt < buffer) {
        return NextResponse.json(
          { error: 'Gmail token expired. Please reconnect Gmail.' },
          { status: 401 },
        )
      }
    }

    // ── Send the email ────────────────────────────────────────────────────
    const from = member.gmail_email ?? userEmail
    const { messageId } = await sendViaGmail({
      accessToken: member.gmail_access_token,
      from,
      to,
      subject,
      htmlBody,
      replyTo,
      cc,
      bcc,
    })

    return NextResponse.json({ ok: true, messageId })
  } catch (err) {
    console.error('[gmail/send POST]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
