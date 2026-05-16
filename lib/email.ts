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

    const { data, error } = await getResend().emails.send({
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

export interface BatchEmail {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  headers?: Record<string, string>
}

export interface BatchEmailResult {
  success: boolean
  results: SendEmailResult[]
}

const BATCH_LIMIT = 100

export async function sendBatchEmails(emails: BatchEmail[]): Promise<BatchEmailResult> {
  if (emails.length === 0) {
    return { success: true, results: [] }
  }

  const settings = await getSettings()
  const defaultFrom = `${settings.email.fromName} <${settings.email.fromEmail}>`
  const defaultReplyTo = settings.email.replyTo
  const resend = getResend()

  const allResults: SendEmailResult[] = []

  for (let i = 0; i < emails.length; i += BATCH_LIMIT) {
    const chunk = emails.slice(i, i + BATCH_LIMIT)
    try {
      const { data, error } = await resend.batch.send(
        chunk.map(e => ({
          from: e.from ?? defaultFrom,
          replyTo: e.replyTo ?? defaultReplyTo,
          to: Array.isArray(e.to) ? e.to : [e.to],
          subject: e.subject,
          html: e.html,
          headers: e.headers,
        })),
      )

      if (error) {
        chunk.forEach(() => allResults.push({ success: false, error: (error as Error).message ?? 'Batch error' }))
      } else {
        const ids = (data as { data: { id: string }[] })?.data ?? []
        chunk.forEach((_, idx) => {
          allResults.push({ success: true, id: ids[idx]?.id })
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      chunk.forEach(() => allResults.push({ success: false, error: message }))
    }
  }

  const anySuccess = allResults.some(r => r.success)
  return { success: anySuccess, results: allResults }
}

export interface SendBroadcastOptions {
  broadcastId: string
  subject: string
  html: string
  recipients: { email: string; name?: string }[]
  from?: string
  replyTo?: string
}

export interface BroadcastResult {
  sent: number
  failed: number
  results: SendEmailResult[]
}

export async function sendBroadcast(options: SendBroadcastOptions): Promise<BroadcastResult> {
  const settings = await getSettings()
  const from = options.from ?? `${settings.email.fromName} <${settings.email.fromEmail}>`
  const replyTo = options.replyTo ?? settings.email.replyTo

  const emails: BatchEmail[] = options.recipients.map(r => ({
    to: r.email,
    subject: options.subject,
    html: options.html,
    from,
    replyTo,
    headers: {
      'X-Broadcast-Id': options.broadcastId,
    },
  }))

  const { results } = await sendBatchEmails(emails)
  const sent = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  return { sent, failed, results }
}
