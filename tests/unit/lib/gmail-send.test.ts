import { describe, it, expect, vi, beforeEach } from 'vitest'

// AUDIT #648 — sendViaGmail() built the raw RFC 2822 header block via
// direct string concatenation with no CRLF stripping, letting a caller
// inject arbitrary extra headers (e.g. a forged Bcc) via a \r\n sequence
// in any header-bound field.

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import { sendViaGmail } from '@/lib/gmail-send'

function decodeSentRaw(): string {
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  return Buffer.from(body.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

describe('sendViaGmail — header injection (#648)', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'msg-1', threadId: 'thread-1' }),
    })
  })

  it('neutralizes an injected CRLF + forged Bcc header in the subject field — no separate Bcc header line is created', async () => {
    await sendViaGmail({
      accessToken: 'tok',
      from: 'me@example.com',
      to: 'you@example.com',
      subject: 'Hello\r\nBcc: attacker@evil.com',
      htmlBody: '<p>hi</p>',
    })
    const raw = decodeSentRaw()
    const lines = raw.split('\r\n')
    expect(lines.filter(l => l.startsWith('Bcc:'))).toHaveLength(0)
    expect(lines.find(l => l.startsWith('Subject:'))).toContain('Bcc: attacker@evil.com')
  })

  it('neutralizes a bare \\n used to splice a header in without \\r — stays on the Subject line', async () => {
    await sendViaGmail({
      accessToken: 'tok',
      from: 'me@example.com',
      to: 'you@example.com',
      subject: 'Hello\nX-Injected: evil',
      htmlBody: '<p>hi</p>',
    })
    const raw = decodeSentRaw()
    const lines = raw.split('\r\n')
    expect(lines.filter(l => l.startsWith('X-Injected:'))).toHaveLength(0)
    expect(lines.find(l => l.startsWith('Subject:'))).toContain('X-Injected: evil')
  })

  it('neutralizes CRLF injected via cc — no separate forged Bcc header line', async () => {
    await sendViaGmail({
      accessToken: 'tok',
      from: 'me@example.com',
      to: 'you@example.com',
      subject: 'Hello',
      htmlBody: '<p>hi</p>',
      cc: 'cc@example.com\r\nBcc: sneaky@evil.com',
    })
    const raw = decodeSentRaw()
    const lines = raw.split('\r\n')
    expect(lines.filter(l => l.startsWith('Bcc:'))).toHaveLength(0)
    expect(lines.find(l => l.startsWith('Cc:'))).toContain('Bcc: sneaky@evil.com')
  })

  it('still sends a normal message with clean headers intact', async () => {
    await sendViaGmail({
      accessToken: 'tok',
      from: 'me@example.com',
      to: 'you@example.com',
      subject: 'Normal subject',
      htmlBody: '<p>hi</p>',
    })
    const raw = decodeSentRaw()
    expect(raw).toContain('From: me@example.com')
    expect(raw).toContain('To: you@example.com')
    expect(raw).toContain('Subject: Normal subject')
  })
})
