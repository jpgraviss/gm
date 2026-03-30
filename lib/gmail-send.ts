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
}

/**
 * Build an RFC 2822 email message, base64url-encode it,
 * and send via the Gmail API.
 */
export async function sendViaGmail(
  options: GmailSendOptions,
): Promise<{ messageId: string }> {
  const { accessToken, from, to, subject, htmlBody, replyTo, cc, bcc } = options

  // ── Build RFC 2822 message ──────────────────────────────────────────────
  const lines: string[] = [
    `From: ${from}`,
    `To: ${to}`,
  ]
  if (cc)      lines.push(`Cc: ${cc}`)
  if (bcc)     lines.push(`Bcc: ${bcc}`)
  if (replyTo) lines.push(`Reply-To: ${replyTo}`)
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
  return { messageId: data.id as string }
}
