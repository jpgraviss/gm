import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { getSettings } from '@/lib/settings'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const db = createServiceClient()
    const normalizedEmail = email.toLowerCase().trim()

    const { data: client } = await db
      .from('portal_clients')
      .select('id, company, contact')
      .ilike('email', normalizedEmail)
      .limit(1)
      .maybeSingle()

    if (!client) {
      return NextResponse.json({ error: 'No portal account found for this email' }, { status: 404 })
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const { error: tokenErr } = await db.from('portal_magic_tokens').insert({
      id: `pmt-${Date.now()}`,
      token,
      email: normalizedEmail,
      portal_client_id: client.id,
      expires_at: expiresAt,
      used: false,
    })

    if (tokenErr) {
      console.error('[magic-link POST] token insert error:', tokenErr)
      return NextResponse.json({ error: 'Failed to create magic link' }, { status: 500 })
    }

    const settings = await getSettings()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
    const magicUrl = `${appUrl}/portal/auth/verify?token=${token}`

    const result = await sendEmail({
      to: normalizedEmail,
      subject: `Your ${settings.company.name} portal sign-in link`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${settings.branding.primaryColor};padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">${settings.company.name.toUpperCase()}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">CLIENT PORTAL</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;font-family:'Syncopate',sans-serif;letter-spacing:0.04em;">Sign In Link</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Hi ${client.contact?.split(' ')[0] || 'there'}, click the button below to sign in to your ${client.company} client portal.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${magicUrl}" style="display:inline-block;background:${settings.branding.primaryColor};color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Sign In to Portal &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} ${settings.company.name}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })

    if (!result.success) {
      console.error('[magic-link POST] email error:', result.error)
      return NextResponse.json({ error: 'Failed to send magic link email' }, { status: 500 })
    }

    logAudit({ userName: 'system', action: 'portal_magic_link_sent', module: 'portal', type: 'info', metadata: { email: normalizedEmail } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[magic-link POST] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
