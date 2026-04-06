import { NextRequest, NextResponse } from 'next/server'
import { getResend } from '@/lib/resend'

export async function POST(req: NextRequest) {
  try {
    const { token, signerEmail, signerName, company, value } = await req.json()

    if (!token || !signerEmail) {
      return NextResponse.json({ error: 'token and signerEmail are required' }, { status: 400 })
    }

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
    const signUrl = `${portalUrl}/sign/${token}`
    const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
    const contactName = signerName || 'there'

    const { data, error } = await getResend().emails.send({
      from: 'Graviss Marketing <contracts@gravissmarketing.com>',
      replyTo: 'info@gravissmarketing.com',
      to: [signerEmail],
      subject: `Signature Requested — ${company} | Graviss Marketing`,
      html: signRequestEmailHtml({ contactName, company, formattedValue, signUrl }),
    })

    if (error) {
      console.error('[email/sign-request POST]', error)
      return NextResponse.json({ error: error?.message || 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    console.error('Sign-request email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function signRequestEmailHtml({
  contactName,
  company,
  formattedValue,
  signUrl,
}: {
  contactName: string
  company: string
  formattedValue: string
  signUrl: string
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
          <td style="background:#015035;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">GRAVISS MARKETING</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">SIGNATURE REQUESTED</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;font-family:'Syncopate',sans-serif;letter-spacing:0.04em;">Hi ${contactName},</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Your signature is requested on a service agreement with Graviss Marketing. Please review the details below and sign at your earliest convenience.
            </p>

            <!-- Contract Details Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Company</p>
                        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${company}</p>
                      </td>
                      <td width="50%" style="text-align:right;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Contract Value</p>
                        <p style="margin:0;font-size:20px;font-weight:700;color:#015035;">${formattedValue}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${signUrl}" style="display:inline-block;background:#015035;color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Sign Now &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 12px;color:#9ca3af;font-size:13px;line-height:1.5;">
              This signature link will expire in 30 days. If you have any questions, reply to this email or contact us at <a href="mailto:info@gravissmarketing.com" style="color:#015035;">info@gravissmarketing.com</a>.
            </p>
            <p style="margin:0;color:#d1d5db;font-size:11px;line-height:1.4;">
              If you did not expect this email, please ignore it.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} Graviss Marketing
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
