import { getResend } from '@/lib/resend'
import { getSettings } from '@/lib/settings'

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  headers?: Record<string, string>
  cc?: string[]
  bcc?: string[]
}

export interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const settings = await getSettings()
    const from = options.from ?? `${settings.email.fromName} <${settings.email.fromEmail}>`
    const replyTo = options.replyTo ?? settings.email.replyTo

    const { data, error } = await (await getResend()).emails.send({
      from,
      replyTo,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      headers: options.headers,
      cc: options.cc,
      bcc: options.bcc,
    })

    if (error) {
      return { success: false, error: (error as Error).message ?? 'Resend error' }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/*
 * AUDIT #749 — sendBatchEmails() / sendBroadcast() were removed here.
 *
 * They had zero callers. Broadcasts actually send through
 * sendBroadcastNow() in lib/broadcasts.ts, which loops sendEmail() per
 * contact because it has to do per-recipient work the batch API cannot:
 * check email_suppressions, render merge fields, append the unsubscribe
 * footer and List-Unsubscribe header, and insert a broadcast_recipients
 * row that the send route's double-send guard reads.
 *
 * Deleted rather than left in place because sendBroadcast() is the name
 * someone reaches for, and it did none of that — a bulk send through it
 * would have gone to suppressed addresses with no unsubscribe link,
 * which is a CAN-SPAM problem, not just a missing feature. If batch
 * sending is ever wanted for throughput, it belongs inside
 * sendBroadcastNow() where the per-recipient work already lives.
 */
