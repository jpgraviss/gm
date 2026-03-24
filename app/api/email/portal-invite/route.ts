import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { company, contactName, email, service, isResend: isResendInvite } = await req.json()

    if (!company || !email) {
      return NextResponse.json({ error: 'company and email are required' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

    // Generate a magic link for the client
    const db = createServiceClient()
    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${appUrl}/auth/confirm` },
    })

    let magicLinkUrl = `${appUrl}/login`
    if (!linkError && linkData?.properties?.hashed_token) {
      const token = linkData.properties.hashed_token
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      magicLinkUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=magiclink&redirect_to=${encodeURIComponent(`${appUrl}/auth/confirm`)}`
    }

    const { data, error } = await resend.emails.send({
      from: 'GravHub <noreply@app.gravissmarketing.com>',
      replyTo: 'info@gravissmarketing.com',
      to: [email],
      subject: isResendInvite
        ? `Reminder: Your ${company} client portal is ready`
        : `Your Graviss Marketing client portal is ready`,
      html: portalInviteHtml({ company, contactName, email, service, signInUrl: magicLinkUrl, isResend: isResendInvite }),
    })

    if (error) {
      console.error('[email/portal-invite POST]', error)
      return NextResponse.json({ error: error?.message || 'Failed to send portal invite email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    console.error('Portal invite error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function portalInviteHtml({
  company,
  contactName,
  email,
  service,
  signInUrl,
  isResend,
}: {
  company: string
  contactName: string
  email: string
  service: string
  signInUrl: string
  isResend?: boolean
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
          <td style="background:#012b1e;padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:Georgia,serif;">GRAVISS MARKETING</h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:12px;letter-spacing:0.04em;">CLIENT PORTAL ACCESS</p>
                </td>
                <td align="right">
                  <div style="background:#015035;border-radius:10px;padding:10px 16px;display:inline-block;">
                    <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;">${company[0]}</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Welcome Banner -->
        <tr>
          <td style="background:#e8f5e9;border-bottom:1px solid #c8e6c9;padding:16px 40px;">
            <p style="margin:0;font-size:14px;color:#1b5e20;font-weight:600;">
              ${isResend ? 'Reminder: Your portal is waiting for you' : 'Your dedicated client portal is ready'}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;">
              Hi ${contactName || 'there'},
            </h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              ${isResend
                ? `Just a reminder that your <strong>${company}</strong> client portal is set up and ready to use. Access your project updates, invoices, and shared files anytime.`
                : `Graviss Marketing has set up a dedicated client portal for <strong>${company}</strong>. Your portal gives you real-time visibility into your project, billing, and a direct line to our team.`
              }
            </p>

            <!-- Service card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Your Company</p>
                        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${company}</p>
                      </td>
                      <td width="50%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Active Service</p>
                        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${service || 'Client Services'}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Login info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;">Your Portal Email</p>
                  <p style="margin:0;font-size:16px;font-weight:600;color:#0c4a6e;font-family:monospace;">${email}</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${signInUrl}" style="display:inline-block;background:#015035;color:#ffffff;font-size:14px;font-weight:700;padding:16px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Access Your Client Portal →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:1.5;">
              No password needed — just click the button above to sign in. Future sign-ins work the same way: enter your email and we'll send you a link.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              Questions? Reply to this email or contact your account manager directly.
              This portal is exclusively for <strong>${company}</strong>.
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
