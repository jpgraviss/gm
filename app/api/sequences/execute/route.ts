import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'
import { sendViaGmail } from '@/lib/gmail-send'

const resend = new Resend(process.env.RESEND_API_KEY)

// ─── Merge-field replacement ─────────────────────────────────────────────────

interface MergeContext {
  contactName: string
  contactEmail: string
  company?: string
  senderName?: string
  senderEmail?: string
}

function replaceMergeFields(text: string, ctx: MergeContext): string {
  const parts = (ctx.contactName || '').split(' ')
  const firstName = parts[0] || ''
  const lastName = parts.slice(1).join(' ') || ''

  return text
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{last_name\}\}/gi, lastName)
    .replace(/\{\{full_name\}\}/gi, ctx.contactName || '')
    .replace(/\{\{email\}\}/gi, ctx.contactEmail || '')
    .replace(/\{\{company\}\}/gi, ctx.company || '')
    .replace(/\{\{sender_name\}\}/gi, ctx.senderName || '')
    .replace(/\{\{sender_email\}\}/gi, ctx.senderEmail || '')
}

// ─── HTML template renderers ─────────────────────────────────────────────────

type HtmlTemplate = 'branded' | 'minimal' | 'plain'

function renderEmailHtml(
  template: HtmlTemplate,
  opts: { body: string; contactName: string; sequenceName: string; fromName?: string },
): string {
  switch (template) {
    case 'plain':
      return opts.body.replace(/\n/g, '<br>')

    case 'minimal':
      return minimalEmailHtml(opts)

    case 'branded':
    default:
      return brandedEmailHtml(opts)
  }
}

function minimalEmailHtml({
  body,
  contactName,
}: {
  body: string
  contactName: string
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px;">
    <tr><td style="max-width:600px;margin:0 auto;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi ${contactName || 'there'},</p>
      <div style="color:#374151;font-size:15px;line-height:1.7;">${body.replace(/\n/g, '<br>')}</div>
    </td></tr>
  </table>
</body>
</html>`
}

function brandedEmailHtml({
  body,
  contactName,
  sequenceName,
}: {
  body: string
  contactName: string
  sequenceName: string
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#012b1e;padding:28px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.08em;font-family:Georgia,serif;">GRAVISS MARKETING</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">${sequenceName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi ${contactName || 'there'},</p>
            <div style="color:#374151;font-size:15px;line-height:1.7;">${body.replace(/\n/g, '<br>')}</div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} Graviss Marketing &nbsp;&middot;&nbsp;
              <a href="mailto:info@gravissmarketing.com" style="color:#015035;">info@gravissmarketing.com</a>
              &nbsp;&middot;&nbsp; To unsubscribe, reply with &ldquo;unsubscribe&rdquo;.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Gmail token lookup ──────────────────────────────────────────────────────

interface GmailTokenResult {
  accessToken: string | null
  gmailEmail: string | null
}

async function lookupGmailToken(
  db: ReturnType<typeof createServiceClient>,
  repEmail: string,
): Promise<GmailTokenResult> {
  const { data } = await db
    .from('team_members')
    .select('gmail_access_token, gmail_email, gmail_token_expires_at')
    .eq('email', repEmail)
    .single()

  if (!data?.gmail_access_token) return { accessToken: null, gmailEmail: null }

  // Check expiry with 5-minute buffer
  if (data.gmail_token_expires_at) {
    const expiresAt = new Date(data.gmail_token_expires_at)
    const buffer = new Date(Date.now() + 5 * 60 * 1000)
    if (expiresAt < buffer) {
      return { accessToken: null, gmailEmail: data.gmail_email }
    }
  }

  return { accessToken: data.gmail_access_token, gmailEmail: data.gmail_email }
}

// ─── Rep lookup ──────────────────────────────────────────────────────────────

interface RepInfo {
  name: string
  email: string
}

async function lookupRep(
  db: ReturnType<typeof createServiceClient>,
  repId: string | null | undefined,
): Promise<RepInfo | null> {
  if (!repId) return null
  const { data } = await db
    .from('team_members')
    .select('name, email')
    .eq('id', repId)
    .single()
  return data ?? null
}

// ─── Main execution endpoint ─────────────────────────────────────────────────

export async function POST() {
  const db = createServiceClient()
  const now = new Date()

  // Fetch all active enrollments that are due
  const { data: enrollments, error: fetchErr } = await db
    .from('sequence_enrollments')
    .select('*')
    .eq('status', 'active')
    .lte('next_send_at', now.toISOString())

  if (fetchErr) {
    console.error('[sequences/execute POST]', fetchErr)
    return NextResponse.json({ error: fetchErr?.message || 'Failed to execute sequences' }, { status: 500 })
  }
  if (!enrollments?.length) return NextResponse.json({ processed: 0, sent: 0, completed: 0 })

  // Fetch all relevant sequences in one query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seqIds = [...new Set(enrollments.map((e: any) => e.sequence_id as string))]
  const { data: sequences } = await db
    .from('sequences')
    .select('id, name, status, steps, active_count, completed_count, send_via, from_name, from_email, assigned_rep_id')
    .in('id', seqIds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seqMap = new Map((sequences ?? []).map((s: any) => [s.id as string, s]))

  // Pre-fetch rep info for all sequences that have an assigned rep
  const repCache = new Map<string, RepInfo | null>()

  let sent = 0
  let completed = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const enrollment of enrollments as any[]) {
    const seq = seqMap.get(enrollment.sequence_id)
    // Only process active sequences
    if (!seq || seq.status !== 'Active') continue

    const steps: {
      id: string
      type: string
      day: number
      subject?: string
      body?: string
      cc?: string[]
      bcc?: string[]
      replyTo?: string
      fromName?: string
      fromEmail?: string
      htmlTemplate?: HtmlTemplate
    }[] = seq.steps ?? []
    const step = steps[enrollment.current_step]
    if (!step) continue

    const update: Record<string, unknown> = {}

    if (step.type === 'email') {
      // Resolve assigned rep (from enrollment, then sequence)
      const repId = enrollment.assigned_rep_id ?? seq.assigned_rep_id
      if (repId && !repCache.has(repId)) {
        repCache.set(repId, await lookupRep(db, repId))
      }
      const rep = repId ? repCache.get(repId) ?? null : null

      // Build merge context
      const mergeCtx: MergeContext = {
        contactName: enrollment.contact_name ?? '',
        contactEmail: enrollment.contact_email ?? '',
        company: enrollment.company ?? '',
        senderName: rep?.name ?? '',
        senderEmail: rep?.email ?? '',
      }

      // Apply merge fields to subject and body
      const subject = replaceMergeFields(
        step.subject ?? `Message from ${seq.name}`,
        mergeCtx,
      )
      const bodyText = replaceMergeFields(step.body ?? '', mergeCtx)

      // Resolve sender info (step overrides sequence overrides defaults)
      const fromName = step.fromName ?? seq.from_name ?? 'Graviss Marketing'
      const fromEmail = step.fromEmail ?? seq.from_email ?? 'noreply@app.gravissmarketing.com'
      const replyTo = step.replyTo ?? (rep?.email || 'info@gravissmarketing.com')

      // Resolve HTML template
      const template: HtmlTemplate = step.htmlTemplate ?? 'branded'
      const html = renderEmailHtml(template, {
        body: bodyText,
        contactName: enrollment.contact_name ?? '',
        sequenceName: seq.name,
        fromName,
      })

      // CC/BCC
      const cc = step.cc?.length ? step.cc : undefined
      const bcc = step.bcc?.length ? step.bcc : undefined

      // Determine send channel: Gmail preferred, Resend fallback
      const useGmail = seq.send_via === 'gmail'
      let emailErr: string | null = null
      let gmailSent = false

      if (useGmail && rep?.email) {
        const { accessToken, gmailEmail } = await lookupGmailToken(db, rep.email)

        if (accessToken) {
          const gmailFrom = `${fromName} <${gmailEmail || rep.email}>`
          try {
            await sendViaGmail({
              accessToken,
              to: enrollment.contact_email,
              subject,
              htmlBody: html,
              from: gmailFrom,
              replyTo,
              cc: cc?.join(', '),
              bcc: bcc?.join(', '),
            })
            gmailSent = true
          } catch (gmailErr) {
            const msg = gmailErr instanceof Error ? gmailErr.message : String(gmailErr)
            console.warn(`[sequences/execute] Gmail send failed, falling back to Resend: ${msg}`)
          }
        } else {
          console.warn(`[sequences/execute] Gmail token missing/expired for ${rep.email}, falling back to Resend`)
        }
      }

      // Send via Resend if Gmail wasn't used or failed
      if (!gmailSent) {
        const resendPayload: Parameters<typeof resend.emails.send>[0] = {
          from: `${fromName} <${fromEmail}>`,
          replyTo,
          to: [enrollment.contact_email],
          subject,
          html,
        }
        if (cc) resendPayload.cc = cc
        if (bcc) resendPayload.bcc = bcc

        const { error: resendErr } = await resend.emails.send(resendPayload)
        emailErr = resendErr ? (resendErr as Error).message ?? 'Resend error' : null
      }

      if (!emailErr) {
        sent++
        update.last_sent_at = now.toISOString()
      }
    }
    // wait/task/condition steps: no email — just advance

    // Advance to next step
    const nextStepIndex = enrollment.current_step + 1
    if (nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex]
      const daysDiff = Math.max(1, nextStep.day - step.day)
      const nextSendAt = new Date(now.getTime() + daysDiff * 24 * 60 * 60 * 1000)
      update.current_step = nextStepIndex
      update.next_send_at = nextSendAt.toISOString()
    } else {
      // All steps complete
      update.status = 'completed'
      completed++
      await db
        .from('sequences')
        .update({
          active_count: Math.max(0, (seq.active_count ?? 1) - 1),
          completed_count: (seq.completed_count ?? 0) + 1,
        })
        .eq('id', seq.id)
    }

    await db
      .from('sequence_enrollments')
      .update(update)
      .eq('id', enrollment.id)
  }

  return NextResponse.json({ processed: enrollments.length, sent, completed })
}
