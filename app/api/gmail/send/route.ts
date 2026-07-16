import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendViaGmail } from '@/lib/gmail-send'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthenticatedEmail } from '@/lib/admin-auth'

// POST /api/gmail/send — send an email via the authenticated user's Gmail
export const POST = withErrorHandler('gmail/send POST', async (req) => {
  try {
    const body = await req.json()
    const { userEmail, to, subject, htmlBody, cc, bcc, replyTo } = body

    if (!userEmail) {
      return NextResponse.json({ error: 'userEmail is required' }, { status: 400 })
    }

    // userEmail was previously trusted from the request body with no
    // verification the caller actually IS that user — any authenticated
    // caller could send real email from any team member's connected Gmail
    // account just by naming a different userEmail.
    const callerEmail = await getAuthenticatedEmail(req)
    if (!callerEmail || callerEmail.toLowerCase() !== String(userEmail).toLowerCase()) {
      return NextResponse.json({ error: 'You may only send from your own connected Gmail account' }, { status: 403 })
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
      .select('gmail_access_token, gmail_email, gmail_token_expires_at, status')
      .eq('email', userEmail)
      .single()

    if (memberErr || !member) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // getAuthenticatedEmail() only verifies the caller HOLDS a valid
    // session — it never checks team_members.status, so a suspended
    // employee's still-valid Supabase session (suspending someone doesn't
    // revoke it) could otherwise keep sending real outbound email here.
    if (member.status !== 'active') {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 })
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
    throw err instanceof Error ? err : new Error('Operation failed')
  }
})
