import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { name, email, role, unit, invitedBy } = await req.json()

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
    }

    // Generate a magic link for the user
    const db = createServiceClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${appUrl}/auth/confirm` },
    })

    // Build the magic link URL from the token
    let magicLinkUrl = `${appUrl}/team-login`
    if (!linkError && linkData?.properties?.hashed_token) {
      const token = linkData.properties.hashed_token
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      magicLinkUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=magiclink&redirect_to=${encodeURIComponent(`${appUrl}/auth/confirm`)}`
    }

    const { data, error } = await resend.emails.send({
      from: 'GravHub <noreply@app.gravissmarketing.com>',
      replyTo: 'info@gravissmarketing.com',
      to: [email],
      subject: `You've been invited to GravHub`,
      html: inviteEmailHtml({ name, role, unit, invitedBy: invitedBy ?? 'the GravHub admin', signInUrl: magicLinkUrl }),
    })

    if (error) {
      console.error('[email/invite POST]', error)
      return NextResponse.json({ error: error?.message || 'Failed to send invite email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    console.error('Invite email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function inviteEmailHtml({
  name,
  role,
  unit,
  invitedBy,
  signInUrl,
}: {
  name: string
  role: string
  unit: string
  invitedBy: string
  signInUrl: string
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

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;">Welcome to GravHub, ${name}!</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              ${invitedBy} has added you to GravHub — the internal operations platform for Graviss Marketing.
              Your account is ready. Click the button below to sign in instantly.
            </p>

            <!-- Role Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Role</p>
                        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${role}</p>
                      </td>
                      <td width="50%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Team</p>
                        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${unit}</p>
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
                  <a href="${signInUrl}" style="display:inline-block;background:#015035;color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Sign In to GravHub →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:1.5;">
              No password needed — just click the button above to sign in. Future sign-ins work the same way: enter your email and we'll send you a link.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              If you weren't expecting this invitation, you can safely ignore this email.
              Need help? Contact <a href="mailto:jonathan@gravissmarketing.com" style="color:#015035;">jonathan@gravissmarketing.com</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} Graviss Marketing &middot; GravHub Platform
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
