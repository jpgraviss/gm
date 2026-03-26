import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { Resend } from 'resend'
import { logAudit } from '@/lib/audit'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

  // Generate a magic link for the client
  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl}/auth/confirm` },
  })

  if (linkError) {
    console.error('[portal-clients/reset-password POST]', linkError)
    return NextResponse.json({ error: linkError?.message || 'Failed to generate sign-in link' }, { status: 500 })
  }

  let magicLinkUrl = `${appUrl}/login`
  if (linkData?.properties?.hashed_token) {
    const token = linkData.properties.hashed_token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    magicLinkUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=magiclink&redirect_to=${encodeURIComponent(`${appUrl}/auth/confirm`)}`
  }

  // Send magic link email
  const { error: emailError } = await resend.emails.send({
    from: 'GravHub <noreply@app.gravissmarketing.com>',
    replyTo: 'info@gravissmarketing.com',
    to: [email],
    subject: 'Your Graviss Marketing sign-in link',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#015035;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">GRAVISS MARKETING</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">CLIENT PORTAL</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;font-family:'Syncopate',sans-serif;letter-spacing:0.04em;">Sign In Link</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Click the button below to sign in to your client portal. No password needed.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${magicLinkUrl}" style="display:inline-block;background:#015035;color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Sign In to Portal &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
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
</html>`,
  })

  if (emailError) {
    console.error('[portal-clients/reset-password POST] email error:', emailError)
    return NextResponse.json({ error: 'Failed to send sign-in link' }, { status: 500 })
  }

  logAudit({ userName: 'system', action: 'client_magic_link_sent', module: 'portal', type: 'info', metadata: { email } })
  return NextResponse.json({ success: true })
}
