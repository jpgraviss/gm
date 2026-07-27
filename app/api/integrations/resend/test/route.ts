import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSettings } from '@/lib/settings'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const POST = withErrorHandler('integrations/resend/test POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  try {
    const { apiKey, to } = await req.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'apiKey is required' }, { status: 400 })
    }

    const settings = await getSettings()
    const testClient = new Resend(apiKey)
    const recipientEmail = to || settings.email.replyTo || 'delivered@resend.dev'

    const { data, error } = await testClient.emails.send({
      from: `${settings.email.fromName} <${settings.email.fromEmail}>`,
      to: [recipientEmail],
      subject: 'GravHub - Resend Connection Test',
      html: testEmailHtml(settings.company.name),
    })

    if (error) {
      return NextResponse.json({
        connected: false,
        error: (error as Error).message ?? 'Failed to send test email',
      })
    }

    return NextResponse.json({
      connected: true,
      id: data?.id,
      sentTo: recipientEmail,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ connected: false, error: message })
  }
})

function testEmailHtml(companyName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#015035;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.08em;">RESEND CONNECTION TEST</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              This is a test email from <strong>${companyName}</strong> to verify that Resend is configured correctly.
            </p>
            <p style="margin:0;color:#059669;font-size:14px;font-weight:600;">If you received this, your Resend integration is working.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">Sent via GravHub &middot; Powered by Resend</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
