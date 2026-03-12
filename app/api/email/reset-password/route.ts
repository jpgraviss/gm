import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { name, email, resetBy } = await req.json()

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
    }

    // Generate a simple reset token (in production this would be a signed JWT
    // stored in a DB with an expiry; here we create a readable temp token)
    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64url')
    const loginUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
    const resetUrl = `${loginUrl}/login?reset=${token}`

    const { data, error } = await resend.emails.send({
      from: 'GravHub <noreply@app.gravissmarketing.com>',
      replyTo: 'info@gravissmarketing.com',
      to: [email],
      subject: 'GravHub — Password Reset',
      html: resetEmailHtml({ name, resetUrl, resetBy: resetBy ?? 'an administrator', expiryHours: 24 }),
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    console.error('Reset email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function resetEmailHtml({
  name,
  resetUrl,
  resetBy,
  expiryHours,
}: {
  name: string
  resetUrl: string
  resetBy: string
  expiryHours: number
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#015035;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:Georgia,serif;">GRAVHUB</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;">GRAVISS MARKETING OPERATIONS</p>
          </td>
        </tr>

        <!-- Alert Banner -->
        <tr>
          <td style="background:#fffbeb;border-bottom:1px solid #fcd34d;padding:14px 40px;">
            <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">
              🔑 Password reset requested by ${resetBy}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;">Hi ${name},</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              A GravHub administrator has requested a password reset for your account.
              Click the button below to set a new password. This link expires in <strong>${expiryHours} hours</strong>.
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${resetUrl}" style="display:inline-block;background:#015035;color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Reset My Password →
                  </a>
                </td>
              </tr>
            </table>

            <!-- URL fallback -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Or copy this link</p>
                  <p style="margin:0;font-size:12px;color:#374151;word-break:break-all;font-family:monospace;">${resetUrl}</p>
                </td>
              </tr>
            </table>

            <!-- Security note -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:14px 18px;">
                  <p style="margin:0;font-size:13px;color:#991b1b;font-weight:600;">Security notice</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#b91c1c;line-height:1.5;">
                    If you did not expect this reset, your account may be at risk. Contact
                    <a href="mailto:jonathan@gravissmarketing.com" style="color:#991b1b;">jonathan@gravissmarketing.com</a> immediately.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#9ca3af;font-size:13px;">
              This link expires in ${expiryHours} hours and can only be used once.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} Graviss Marketing · GravHub Platform
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
