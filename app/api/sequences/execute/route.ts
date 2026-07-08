import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { createServiceClient } from '@/lib/supabase'
import { sendViaGmail } from '@/lib/gmail-send'
import { fireAutomations } from '@/lib/automations-engine'
import { getSettings, type AppSettings } from '@/lib/settings'
import { withErrorHandler } from '@/lib/api-handler'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.gravissmarketing.com'

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

// ─── Unsubscribe link builder ────────────────────────────────────────────────

function buildUnsubscribeLink(email: string, sequenceId: string): string {
  return `${APP_URL}/api/sequences/unsubscribe?email=${encodeURIComponent(email)}&seq=${sequenceId}`
}

function appendUnsubscribeFooter(html: string, email: string, sequenceId: string): string {
  const link = buildUnsubscribeLink(email, sequenceId)
  const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af;">
    <a href="${link}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
  </div>`

  // Insert before closing </body> if present, otherwise append
  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`)
  }
  return html + footer
}

// ─── HTML template renderers ─────────────────────────────────────────────────

type HtmlTemplate = 'branded' | 'minimal' | 'plain'

function renderEmailHtml(
  template: HtmlTemplate,
  opts: { body: string; contactName: string; sequenceName: string; fromName?: string; settings: AppSettings },
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
  settings,
}: {
  body: string
  contactName: string
  settings: AppSettings
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px;">
    <tr><td style="max-width:600px;margin:0 auto;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi ${contactName || 'there'},</p>
      <div style="color:#374151;font-size:15px;line-height:1.7;">${body.replace(/\n/g, '<br>')}</div>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">
          &copy; ${new Date().getFullYear()} ${settings.company.name} &middot;
          <a href="mailto:${settings.email.supportEmail}" style="color:${settings.branding.primaryColor};">${settings.email.supportEmail}</a>
        </p>
      </div>
    </td></tr>
  </table>
</body>
</html>`
}

function brandedEmailHtml({
  body,
  contactName,
  sequenceName,
  settings,
}: {
  body: string
  contactName: string
  sequenceName: string
  settings: AppSettings
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${settings.branding.darkBg};padding:28px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">${settings.company.name.toUpperCase()}</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-family:'Syncopate',sans-serif;">${sequenceName}</p>
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
              &copy; ${new Date().getFullYear()} ${settings.company.name} &nbsp;&middot;&nbsp;
              <a href="mailto:${settings.email.supportEmail}" style="color:${settings.branding.primaryColor};">${settings.email.supportEmail}</a>
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

// ─── Sending window check ────────────────────────────────────────────────────

function isWithinSendingWindow(seq: {
  send_window_start?: number | string | null
  send_window_end?: number | string | null
  send_on_weekends?: boolean | null
  timezone?: string | null
}): boolean {
  const tz = seq.timezone || 'America/New_York'
  const now = new Date()

  // Get current time in the sequence's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  })
  const parts = formatter.formatToParts(now)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''

  // Check weekends
  if (!seq.send_on_weekends && (weekday === 'Sat' || weekday === 'Sun')) {
    return false
  }

  // Check time window — DB stores as integer hours (e.g. 8, 18)
  if (seq.send_window_start != null && seq.send_window_end != null) {
    const startH = typeof seq.send_window_start === 'number'
      ? seq.send_window_start
      : parseInt(String(seq.send_window_start), 10)
    const endH = typeof seq.send_window_end === 'number'
      ? seq.send_window_end
      : parseInt(String(seq.send_window_end), 10)

    if (!isNaN(startH) && !isNaN(endH)) {
      if (hour < startH || hour >= endH) {
        return false
      }
    }
  }

  return true
}

// ─── Throttling helpers ──────────────────────────────────────────────────────

async function getDailySendCount(
  db: ReturnType<typeof createServiceClient>,
  sequenceId: string,
): Promise<number> {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { count } = await db
    .from('sequence_activities')
    .select('*', { count: 'exact', head: true })
    .eq('sequence_id', sequenceId)
    .eq('event_type', 'sent')
    .gte('created_at', todayStart.toISOString())

  return count ?? 0
}

// Per-sequence in-memory per-minute counters (reset each invocation is fine for cron)
const perMinuteCounts = new Map<string, number>()

// ─── Activity logging ────────────────────────────────────────────────────────

async function logActivity(
  db: ReturnType<typeof createServiceClient>,
  params: {
    sequenceId: string
    enrollmentId: string
    contactEmail: string
    stepIndex: number
    eventType: 'sent' | 'failed' | 'skipped' | 'task_created'
    messageId?: string | null
    metadata?: Record<string, unknown>
  },
) {
  await db.from('sequence_activities').insert({
    sequence_id: params.sequenceId,
    enrollment_id: params.enrollmentId,
    contact_email: params.contactEmail,
    step_index: params.stepIndex,
    event_type: params.eventType,
    message_id: params.messageId ?? null,
    metadata: params.metadata ?? {},
  })
}

// ─── Suppression check ──────────────────────────────────────────────────────

async function isSuppressed(
  db: ReturnType<typeof createServiceClient>,
  email: string,
): Promise<boolean> {
  const { count } = await db
    .from('sequence_suppression_list')
    .select('*', { count: 'exact', head: true })
    .eq('email', email.toLowerCase())

  return (count ?? 0) > 0
}

// ─── One-at-a-time enforcement ───────────────────────────────────────────────

async function isActiveInOtherSequence(
  db: ReturnType<typeof createServiceClient>,
  contactEmail: string,
  currentSequenceId: string,
): Promise<boolean> {
  const { count } = await db
    .from('sequence_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('contact_email', contactEmail)
    .eq('status', 'active')
    .neq('sequence_id', currentSequenceId)

  return (count ?? 0) > 0
}

// ─── Main execution endpoint ─────────────────────────────────────────────────

export const POST = withErrorHandler('sequences/execute POST', async (req: NextRequest) => {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const settings = await getSettings()
  const now = new Date()

  // Fetch all active enrollments that are due
  const { data: enrollments, error: fetchErr } = await db
    .from('sequence_enrollments')
    .select('*')
    .eq('status', 'active')
    .lte('next_send_at', now.toISOString())

  if (fetchErr) {
    throw new Error(fetchErr?.message || 'Failed to execute sequences')
  }
  if (!enrollments?.length) {
    return NextResponse.json({ processed: 0, sent: 0, completed: 0, skipped: 0 })
  }

  // Fetch all relevant sequences in one query (include throttling/window columns)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seqIds = [...new Set(enrollments.map((e: any) => e.sequence_id as string))]
  const { data: sequences } = await db
    .from('sequences')
    .select(
      'id, name, status, steps, active_count, completed_count, send_via, from_name, from_email, assigned_rep_id, ' +
      'daily_send_limit, per_minute_limit, send_window_start, send_window_end, send_on_weekends, timezone, thread_mode',
    )
    .in('id', seqIds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seqMap = new Map((sequences ?? []).map((s: any) => [s.id as string, s]))

  // Pre-fetch daily send counts per sequence for throttling
  const dailySendCounts = new Map<string, number>()
  for (const seqId of seqIds) {
    dailySendCounts.set(seqId, await getDailySendCount(db, seqId))
  }

  // Pre-fetch rep info cache
  const repCache = new Map<string, RepInfo | null>()

  let sent = 0
  let completed = 0
  let skipped = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const enrollment of enrollments as any[]) {
    const seq = seqMap.get(enrollment.sequence_id)
    // Only process active sequences
    if (!seq || seq.status !== 'Active') continue

    // ── 1. Suppression check ───────────────────────────────────────────────
    if (await isSuppressed(db, enrollment.contact_email)) {
      console.log(`[sequences/execute] Skipping suppressed contact: ${enrollment.contact_email}`)
      await db
        .from('sequence_enrollments')
        .update({ status: 'unenrolled', unenroll_reason: 'suppressed' })
        .eq('id', enrollment.id)
      await logActivity(db, {
        sequenceId: seq.id,
        enrollmentId: enrollment.id,
        contactEmail: enrollment.contact_email,
        stepIndex: enrollment.current_step,
        eventType: 'skipped',
        metadata: { reason: 'suppressed' },
      })
      skipped++
      continue
    }

    // ── 2. One-at-a-time enforcement ───────────────────────────────────────
    if (await isActiveInOtherSequence(db, enrollment.contact_email, enrollment.sequence_id)) {
      console.log(`[sequences/execute] Skipping ${enrollment.contact_email}: active in another sequence`)
      await db
        .from('sequence_enrollments')
        .update({ status: 'paused', unenroll_reason: 'active_in_other_sequence' })
        .eq('id', enrollment.id)
      await logActivity(db, {
        sequenceId: seq.id,
        enrollmentId: enrollment.id,
        contactEmail: enrollment.contact_email,
        stepIndex: enrollment.current_step,
        eventType: 'skipped',
        metadata: { reason: 'active_in_other_sequence' },
      })
      skipped++
      continue
    }

    // ── 3. Sending window check ────────────────────────────────────────────
    if (!isWithinSendingWindow(seq)) {
      // Don't advance, don't update — leave for next cron run
      continue
    }

    // ── 4. Send throttling ─────────────────────────────────────────────────
    const dailyCount = dailySendCounts.get(seq.id) ?? 0
    const dailyLimit = seq.daily_send_limit ?? Infinity
    if (dailyCount >= dailyLimit) {
      console.log(`[sequences/execute] Daily limit reached for sequence ${seq.id} (${dailyCount}/${dailyLimit})`)
      skipped++
      continue
    }

    const minuteCount = perMinuteCounts.get(seq.id) ?? 0
    const minuteLimit = seq.per_minute_limit ?? Infinity
    if (minuteCount >= minuteLimit) {
      console.log(`[sequences/execute] Per-minute limit reached for sequence ${seq.id}`)
      skipped++
      continue
    }

    // ── Process current step ───────────────────────────────────────────────
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
      taskTitle?: string
      linkedinAction?: string
      linkedinMessage?: string
      callScript?: string
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
      const fromName = step.fromName ?? seq.from_name ?? settings.email.fromName
      const fromEmail = step.fromEmail ?? seq.from_email ?? settings.email.fromEmail
      const replyTo = step.replyTo ?? (rep?.email || settings.email.replyTo)

      // Resolve HTML template
      const template: HtmlTemplate = step.htmlTemplate ?? 'branded'
      let html = renderEmailHtml(template, {
        body: bodyText,
        contactName: enrollment.contact_name ?? '',
        sequenceName: seq.name,
        fromName,
        settings,
      })

      // ── 8. Append unsubscribe link ─────────────────────────────────────
      html = appendUnsubscribeFooter(html, enrollment.contact_email, seq.id)

      // CC/BCC
      const cc = step.cc?.length ? step.cc : undefined
      const bcc = step.bcc?.length ? step.bcc : undefined

      // ── 5. Email threading ─────────────────────────────────────────────
      // Retrieve existing message IDs from enrollment for threading
      const existingMessageIds: string[] = enrollment.message_ids ?? []
      const firstMessageId = existingMessageIds.length > 0 ? existingMessageIds[0] : undefined
      const inReplyTo = firstMessageId ? `<${firstMessageId}>` : undefined
      const references = firstMessageId ? `<${firstMessageId}>` : undefined

      // Determine send channel: Gmail preferred, Resend fallback
      const useGmail = seq.send_via === 'gmail'
      let emailErr: string | null = null
      let gmailSent = false
      let messageId: string | null = null

      if (useGmail && rep?.email) {
        const { accessToken, gmailEmail } = await lookupGmailToken(db, rep.email)

        if (accessToken) {
          const gmailFrom = `${fromName} <${gmailEmail || rep.email}>`
          try {
            const result = await sendViaGmail({
              accessToken,
              to: enrollment.contact_email,
              subject,
              htmlBody: html,
              from: gmailFrom,
              replyTo,
              cc: cc?.join(', '),
              bcc: bcc?.join(', '),
              inReplyTo,
              references,
            })
            gmailSent = true
            messageId = result.messageId
          } catch (gmailErr) {
            const msg = gmailErr instanceof Error ? gmailErr.message : String(gmailErr)
            console.warn(`[sequences/execute] Gmail send failed, falling back to Resend: ${msg}`)
          }
        } else {
          console.warn(`[sequences/execute] Gmail token missing/expired for ${rep.email}, falling back to Resend`)
        }
      }

      if (!gmailSent) {
        const resendHeaders: Record<string, string> = {
          'X-Sequence-Id': seq.id,
          'X-Enrollment-Id': enrollment.id,
        }
        if (inReplyTo) {
          resendHeaders['In-Reply-To'] = inReplyTo
          resendHeaders['References'] = references!
        }

        const resendResult = await sendEmail({
          from: `${fromName} <${fromEmail}>`,
          replyTo,
          to: enrollment.contact_email,
          subject,
          html,
          headers: resendHeaders,
          cc,
          bcc,
        })
        emailErr = resendResult.success ? null : (resendResult.error ?? 'Resend error')
        if (resendResult.success) {
          messageId = resendResult.id ?? null
        }
      }

      // ── 6. Activity logging ────────────────────────────────────────────
      if (!emailErr) {
        sent++
        update.last_sent_at = now.toISOString()

        // Store message ID for threading
        if (messageId) {
          const updatedMessageIds = [...existingMessageIds, messageId]
          update.message_ids = updatedMessageIds
        }

        // Update send counters for throttling
        dailySendCounts.set(seq.id, (dailySendCounts.get(seq.id) ?? 0) + 1)
        perMinuteCounts.set(seq.id, (perMinuteCounts.get(seq.id) ?? 0) + 1)

        // ── 9. Delivery status tracking ──────────────────────────────────
        update.delivery_status = 'sent'
        update.last_message_id = messageId

        await logActivity(db, {
          sequenceId: seq.id,
          enrollmentId: enrollment.id,
          contactEmail: enrollment.contact_email,
          stepIndex: enrollment.current_step,
          eventType: 'sent',
          messageId,
          metadata: {
            channel: gmailSent ? 'gmail' : 'resend',
            subject,
            from: `${fromName} <${gmailSent ? rep?.email : fromEmail}>`,
          },
        })
      } else {
        await logActivity(db, {
          sequenceId: seq.id,
          enrollmentId: enrollment.id,
          contactEmail: enrollment.contact_email,
          stepIndex: enrollment.current_step,
          eventType: 'failed',
          metadata: {
            error: emailErr,
            channel: useGmail ? 'gmail+resend_fallback' : 'resend',
          },
        })
        // Don't advance step on failure — retry next cron run
        continue
      }
    } else if (step.type === 'manual_email' || step.type === 'linkedin' || step.type === 'call' || step.type === 'task') {
      const taskTitles: Record<string, string> = {
        manual_email: `Send manual email: ${step.subject || enrollment.contact_name || 'Contact'}`,
        linkedin: `LinkedIn action (${step.linkedinAction || 'connect'}): ${enrollment.contact_name || 'Contact'}`,
        call: `Call: ${enrollment.contact_name || 'Contact'}`,
        task: step.taskTitle || `Follow up with ${enrollment.contact_name || 'Contact'}`,
      }
      const taskBodies: Record<string, string> = {
        manual_email: step.body || '',
        linkedin: step.linkedinMessage || '',
        call: step.callScript || '',
        task: step.body || '',
      }

      const activityId = `seq-${seq.id}-${enrollment.id}-step${enrollment.current_step}`
      await db.from('crm_activities').upsert({
        id: activityId,
        type: 'task',
        title: taskTitles[step.type] ?? `Sequence task: ${enrollment.contact_name}`,
        body: taskBodies[step.type] || null,
        contact_id: enrollment.contact_id || null,
        contact_name: enrollment.contact_name || '',
        company_name: enrollment.company || '',
        user_name: 'Sequence',
        timestamp: now.toISOString(),
        outcome: 'pending',
      }, { onConflict: 'id' })

      await logActivity(db, {
        sequenceId: seq.id,
        enrollmentId: enrollment.id,
        contactEmail: enrollment.contact_email,
        stepIndex: enrollment.current_step,
        eventType: 'task_created',
        metadata: { stepType: step.type, taskTitle: taskTitles[step.type] },
      })
    }
    // wait/condition steps: no action — just advance

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

      // Reset contact in_sequence flag
      if (enrollment.contact_id) {
        await db.from('crm_contacts').update({
          in_sequence: false,
          current_sequence_id: null,
          last_sequence_id: seq.id,
          last_sequence_date: now.toISOString(),
        }).eq('id', enrollment.contact_id)
      }

      // Fire automation event
      fireAutomations('sequence_completed', {
        sequenceId: seq.id,
        sequenceName: seq.name,
        contactEmail: enrollment.contact_email,
        contactName: enrollment.contact_name,
        contactId: enrollment.contact_id,
        company: enrollment.company,
      })
    }

    await db
      .from('sequence_enrollments')
      .update(update)
      .eq('id', enrollment.id)
  }

  return NextResponse.json({ processed: enrollments.length, sent, completed, skipped })
})

