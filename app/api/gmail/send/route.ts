import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendViaGmail } from '@/lib/gmail-send'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { resolveGmailSettings } from '@/lib/gmail-settings'
import { type EmailSignatureData, SIGNATURE_MARKER, generateSignatureHtml } from '@/lib/email-signature'
import { rewriteLinksForExtensionTracking, trackingPixelTag } from '@/lib/tracked-emails'

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

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
      .select('id, name, gmail_access_token, gmail_email, gmail_token_expires_at, status, gmail_settings, email_signature')
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

    // ── AUDIT.md #407 — gmail_settings was write-only; this is the real send
    // path, so it's where autoLogSent/insertSignature/trackOpens/trackClicks/
    // notifyOnReply actually get enforced. ──────────────────────────────────
    const gmailSettings = resolveGmailSettings(member.gmail_settings)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

    let finalHtmlBody = String(htmlBody)

    // insertSignature — skip if the caller already appended one itself (the
    // Inbox compose UI's manual "Signature" button, app/inbox/page.tsx, sets
    // the same marker) so a sender never gets two signatures.
    if (gmailSettings.insertSignature && !finalHtmlBody.includes(SIGNATURE_MARKER)) {
      const sig = member.email_signature as EmailSignatureData | null
      if (sig?.name) finalHtmlBody += generateSignatureHtml(sig)
    }

    // Best-effort CRM contact match for the recipient — feeds autoLogSent's
    // CRM timeline entry and the tracked_emails row's contact/company link.
    // Only bothered with when something actually needs it.
    let contact: { id: string; company_id: string | null } | null = null
    if (gmailSettings.autoLogSent || gmailSettings.trackOpens || gmailSettings.trackClicks || gmailSettings.notifyOnReply) {
      const { data: contactRow } = await db
        .from('crm_contacts')
        .select('id, company_id')
        .contains('emails', [String(to).toLowerCase()])
        .maybeSingle()
      contact = contactRow ?? null
    }

    // trackOpens/trackClicks — reuses the same tracked_emails table +
    // /api/track/open|click/ext endpoints the browser extension already
    // uses for HubSpot-style Gmail tracking, so opens/clicks on a native
    // GravHub-sent email show up exactly the same way.
    let trackedEmailId: string | null = null
    if (gmailSettings.trackOpens || gmailSettings.trackClicks) {
      trackedEmailId = uid('te')
      const { error: teErr } = await db.from('tracked_emails').insert({
        id: trackedEmailId,
        team_member_id: member.id,
        recipient_email: String(to).toLowerCase(),
        contact_id: contact?.id ?? null,
        company_id: contact?.company_id ?? null,
        subject,
      })
      // A tracking-row failure must never block sending real mail — just
      // send untracked (same "degrade silently, never block send" tradeoff
      // browser-extension/content.js documents for its own tracking).
      if (teErr) trackedEmailId = null
    }
    if (trackedEmailId && gmailSettings.trackClicks) {
      finalHtmlBody = rewriteLinksForExtensionTracking(finalHtmlBody, trackedEmailId, baseUrl)
    }
    if (trackedEmailId && gmailSettings.trackOpens) {
      finalHtmlBody += trackingPixelTag(trackedEmailId, baseUrl)
    }

    // ── Send the email ────────────────────────────────────────────────────
    const from = member.gmail_email ?? userEmail
    const { messageId, threadId } = await sendViaGmail({
      accessToken: member.gmail_access_token,
      from,
      to,
      subject,
      htmlBody: finalHtmlBody,
      replyTo,
      cc,
      bcc,
    })

    // notifyOnReply needs thread_id to later recognize an inbound reply in
    // the same thread (app/api/gmail/message POST) — only knowable once
    // Gmail's own send response comes back, so this always runs after the
    // send above, either backfilling the tracked_emails row already created
    // for trackOpens/trackClicks or creating a lightweight one just for
    // reply-matching. Best-effort: a failure here must not turn a real,
    // successful send into an error response to the caller.
    if (gmailSettings.notifyOnReply) {
      try {
        if (trackedEmailId) {
          await db.from('tracked_emails').update({ thread_id: threadId }).eq('id', trackedEmailId)
        } else {
          await db.from('tracked_emails').insert({
            id: uid('te'),
            team_member_id: member.id,
            recipient_email: String(to).toLowerCase(),
            contact_id: contact?.id ?? null,
            company_id: contact?.company_id ?? null,
            subject,
            thread_id: threadId,
          })
        }
      } catch (err) {
        console.error('[gmail/send] failed to record thread for reply tracking:', err)
      }
    }

    // autoLogSent — mirrors app/inbox/page.tsx's manual "Log as Activity"
    // flow, using the same `gmail_${messageId}` activity id convention so a
    // message auto-logged here shows as already "Logged" if the user later
    // views it in the Inbox, instead of offering to log it a second time.
    if (gmailSettings.autoLogSent && contact?.id) {
      try {
        await db.from('crm_activities').insert({
          id: `gmail_${messageId}`,
          type: 'email',
          title: `Email: ${subject}`,
          company_id: contact.company_id,
          contact_id: contact.id,
          user_name: member.name ?? 'System',
          timestamp: new Date().toISOString(),
        })
      } catch (err) {
        console.error('[gmail/send] auto-log-sent failed:', err)
      }
    }

    return NextResponse.json({ ok: true, messageId })
  } catch (err) {
    throw err instanceof Error ? err : new Error('Operation failed')
  }
})
