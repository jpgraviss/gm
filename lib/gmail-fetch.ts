// Shared Gmail list+metadata fetch — used by both /api/gmail/messages (the
// staff member's own inbox page) and /api/inbox/unified (merging Gmail into
// the cross-channel contact-keyed thread view). GravHub never mirrors Gmail
// messages into Postgres, so both call sites hit the live Gmail API with a
// per-user access token rather than reading from a local table.

export interface GmailMessageSummary {
  id: string
  threadId: string
  snippet: string
  labelIds: string[]
  from: string
  to: string
  subject: string
  date: string
  internalDate: string
}

export interface FetchGmailMessagesResult {
  messages: GmailMessageSummary[]
  nextPageToken: string | null
}

/**
 * Carries the real Gmail API HTTP status (e.g. 401 for an expired/revoked
 * token) so callers can react the same way the original inline
 * implementation did — app/inbox/page.tsx specifically checks for 401 to
 * trigger a reconnect prompt, so this can't be flattened to a generic error.
 */
export class GmailFetchError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Fetches a page of message IDs, then metadata (From/To/Subject/Date) for
 * up to `detailLimit` of them in parallel. Gmail's list endpoint alone
 * doesn't return headers, so this is always a list call plus N metadata
 * calls — kept small (default 20) since it's an unavoidable N+1 against a
 * live rate-limited external API.
 */
export async function fetchGmailMessages(
  accessToken: string,
  opts: { maxResults?: number; pageToken?: string; query?: string; detailLimit?: number } = {},
): Promise<FetchGmailMessagesResult> {
  const { maxResults = 30, pageToken, query = '', detailLimit = 20 } = opts

  const params = new URLSearchParams({ maxResults: String(maxResults) })
  if (pageToken) params.set('pageToken', pageToken)
  if (query) params.set('q', query)

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}))
    console.error('[gmail-fetch] list failed', err)
    throw new GmailFetchError(listRes.status, 'Gmail API error')
  }

  const listData = await listRes.json() as { messages?: { id: string; threadId: string }[]; nextPageToken?: string }
  const messageIds = listData.messages ?? []
  const batch = messageIds.slice(0, detailLimit)

  const details = await Promise.all(
    batch.map(async ({ id }) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!msgRes.ok) return null
      const msg = await msgRes.json() as {
        id: string
        threadId: string
        snippet: string
        labelIds?: string[]
        payload?: { headers?: { name: string; value: string }[] }
        internalDate?: string
      }

      const headers: Record<string, string> = {}
      for (const h of msg.payload?.headers ?? []) {
        headers[h.name.toLowerCase()] = h.value
      }

      return {
        id: msg.id,
        threadId: msg.threadId,
        snippet: msg.snippet ?? '',
        labelIds: msg.labelIds ?? [],
        from: headers['from'] ?? '',
        to: headers['to'] ?? '',
        subject: headers['subject'] ?? '(no subject)',
        date: headers['date'] ?? '',
        internalDate: msg.internalDate ?? '',
      }
    }),
  )

  return {
    messages: details.filter((m): m is GmailMessageSummary => m !== null),
    nextPageToken: listData.nextPageToken ?? null,
  }
}

/**
 * Pulls the bare email address out of a header value like
 * `"Jane Doe" <jane@example.com>` or a bare `jane@example.com`. Returns
 * lowercase, or null if nothing email-shaped is found.
 */
export function extractEmailAddress(headerValue: string): string | null {
  const angleMatch = headerValue.match(/<([^>]+)>/)
  const candidate = (angleMatch ? angleMatch[1] : headerValue).trim()
  const emailMatch = candidate.match(/[^\s<>]+@[^\s<>]+\.[^\s<>]+/)
  return emailMatch ? emailMatch[0].toLowerCase() : null
}

/**
 * The first To-header address that isn't the given self address — good
 * enough for the common single-recipient case; CC/BCC and multi-recipient
 * threads aren't split into separate contacts (matches the same
 * one-contact-per-thread simplification the rest of the unified inbox uses).
 */
export function extractFirstOtherAddress(headerValue: string, selfEmail: string): string | null {
  const self = selfEmail.toLowerCase()
  const parts = headerValue.split(',')
  for (const part of parts) {
    const addr = extractEmailAddress(part)
    if (addr && addr !== self) return addr
  }
  return null
}
