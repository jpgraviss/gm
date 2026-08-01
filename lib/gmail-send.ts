// ─── Gmail Send Helper (server-side only) ─────────────────────────────────────

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1'

export interface GmailSendOptions {
  accessToken: string
  from: string        // sender email
  to: string          // recipient email
  subject: string
  htmlBody: string
  replyTo?: string
  cc?: string
  bcc?: string
  inReplyTo?: string  // Message-ID for threading
  references?: string // Space-separated Message-IDs for threading
}

// AUDIT #648 — a `\r`/`\n` in any header-bound field let a caller inject
// arbitrary extra headers (e.g. a forged Bcc) or splice content into the
// body via an early blank line, the same bug class already fixed at #606
// for lib/ics-generator.ts. Strips CR/LF entirely rather than escaping —
// header field values are never expected to legitimately contain them.
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/**
 * Build an RFC 2822 email message, base64url-encode it,
 * and send via the Gmail API.
 */
export async function sendViaGmail(
  options: GmailSendOptions,
): Promise<{ messageId: string; threadId: string }> {
  const { accessToken, htmlBody } = options
  const from = sanitizeHeader(options.from)
  const to = sanitizeHeader(options.to)
  const subject = sanitizeHeader(options.subject)
  const replyTo = options.replyTo ? sanitizeHeader(options.replyTo) : options.replyTo
  const cc = options.cc ? sanitizeHeader(options.cc) : options.cc
  const bcc = options.bcc ? sanitizeHeader(options.bcc) : options.bcc
  const inReplyTo = options.inReplyTo ? sanitizeHeader(options.inReplyTo) : options.inReplyTo
  const references = options.references ? sanitizeHeader(options.references) : options.references

  // ── Build RFC 2822 message ──────────────────────────────────────────────
  const lines: string[] = [
    `From: ${from}`,
    `To: ${to}`,
  ]
  if (cc)         lines.push(`Cc: ${cc}`)
  if (bcc)        lines.push(`Bcc: ${bcc}`)
  if (replyTo)    lines.push(`Reply-To: ${replyTo}`)
  if (inReplyTo)  lines.push(`In-Reply-To: ${inReplyTo}`)
  if (references) lines.push(`References: ${references}`)
  lines.push(
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',          // blank line separates headers from body
    htmlBody,
  )

  const rawMessage = lines.join('\r\n')

  // ── Base64url encode ────────────────────────────────────────────────────
  const encoded = Buffer.from(rawMessage, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // ── Send via Gmail API ──────────────────────────────────────────────────
  const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gmail send failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  return { messageId: data.id as string, threadId: data.threadId as string }
}
