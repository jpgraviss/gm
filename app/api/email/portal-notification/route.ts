import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { to, clientName, title, message, link } = await req.json()

    if (!to || !title) {
      return NextResponse.json({ error: 'to and title are required' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
    const portalLink = link || `${appUrl}/portal`

    const { data, error } = await resend.emails.send({
      from: 'GravHub <noreply@app.gravissmarketing.com>',
      replyTo: 'info@gravissmarketing.com',
      to: [to],
      subject: title,
      html: notificationEmailHtml({ clientName, title, message, portalLink, appUrl }),
    })

    if (error) {
      console.error('[email/portal-notification POST]', error)
      return NextResponse.json({ error: error?.message || 'Failed to send notification email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    console.error('Portal notification email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function notificationEmailHtml({
  clientName,
  title,
  message,
  portalLink,
  appUrl,
}: {
  clientName: string
  title: string
  message?: string
  portalLink: string
  appUrl: string
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#012b1e;padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">GRAVISS MARKETING</h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">CLIENT NOTIFICATION</p>
                </td>
                <td align="right">
                  <div style="background:#015035;border-radius:10px;padding:10px 16px;display:inline-block;">
                    <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;">${(clientName || 'C')[0]}</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Notification Title Banner -->
        <tr>
          <td style="background:#e8f5e9;border-bottom:1px solid #c8e6c9;padding:16px 40px;">
            <p style="margin:0;font-size:14px;color:#1b5e20;font-weight:600;">
              New notification for your account
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;font-family:'Syncopate',sans-serif;letter-spacing:0.04em;">
              Hi ${clientName || 'there'},
            </h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              You have a new update from Graviss Marketing.
            </p>

            <!-- Notification card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Notification</p>
                  <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#111827;font-family:'Syncopate',sans-serif;letter-spacing:0.03em;">${title}</h3>
                  ${message ? `<p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">${message}</p>` : ''}
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${portalLink}" style="display:inline-block;background:#015035;color:#ffffff;font-size:14px;font-weight:700;padding:16px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    View in Portal &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:1.5;">
              You can view all your notifications and updates by signing into your client portal.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              Questions? Reply to this email or contact your account manager directly.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} Graviss Marketing &middot; <a href="mailto:info@gravissmarketing.com" style="color:#015035;">info@gravissmarketing.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
