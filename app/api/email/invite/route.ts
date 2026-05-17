import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { createServiceClient } from '@/lib/supabase'
import { getSettings } from '@/lib/settings'

export async function POST(req: NextRequest) {
  try {
    const settings = await getSettings()
    const { name, email, role, unit, invitedBy } = await req.json()

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
    }

    const db = createServiceClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await db
      .from('team_members')
      .update({
        verification_code: verificationCode,
        verification_expires: verificationExpires,
      })
      .ilike('email', email.toLowerCase().trim())

    const setupUrl = `${appUrl}/setup-account?email=${encodeURIComponent(email)}&token=${verificationCode}`

    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${appUrl}/auth/confirm` },
    })

    let magicLinkUrl = `${appUrl}/team-login`
    if (!linkError && linkData?.properties?.hashed_token) {
      const token = linkData.properties.hashed_token
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      magicLinkUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=magiclink&redirect_to=${encodeURIComponent(`${appUrl}/auth/confirm`)}`
    }

    const result = await sendEmail({
      to: email,
      subject: `You've been invited to ${settings.branding.appName}`,
      html: inviteEmailHtml({
        name,
        role,
        unit,
        invitedBy: invitedBy ?? `the ${settings.branding.appName} admin`,
        signInUrl: magicLinkUrl,
        setupUrl,
        verificationCode,
        settings,
      }),
    })

    if (!result.success) {
      console.error('[email/invite POST]', result.error)
      return NextResponse.json({ error: result.error || 'Failed to send invite email' }, { status: 500 })
    }

    const { data: admins } = await db
      .from('team_members')
      .select('email, name')
      .eq('is_admin', true)
      .eq('status', 'active')

    if (admins && admins.length > 0) {
      const { data: settingsRow } = await db
        .from('app_settings')
        .select('approval_config')
        .eq('id', 'global')
        .maybeSingle()
      const approvalConfig = settingsRow?.approval_config as { teamMemberApprovals?: string[] } | null
      const configuredEmails = approvalConfig?.teamMemberApprovals
      const adminEmails = (configuredEmails?.length ? configuredEmails : admins.map((a: { email: string }) => a.email)).filter(Boolean)
      await sendEmail({
        to: adminEmails,
        subject: `New team member setup: ${name}`,
        html: adminNotificationHtml({ name, email, role, unit, verificationCode, settings }),
      })
    }

    return NextResponse.json({ success: true, id: result.id })
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
  setupUrl,
  verificationCode,
  settings,
}: {
  name: string
  role: string
  unit: string
  invitedBy: string
  signInUrl: string
  setupUrl: string
  verificationCode: string
  settings: Awaited<ReturnType<typeof getSettings>>
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
          <td style="background:${settings.branding.primaryColor};padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">${settings.branding.appName.toUpperCase()}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">${settings.company.name.toUpperCase()} OPERATIONS</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;font-family:'Syncopate',sans-serif;letter-spacing:0.04em;">Welcome to ${settings.branding.appName}, ${name}!</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              ${invitedBy} has added you to ${settings.branding.appName} — the internal operations platform for ${settings.company.name}.
              Set up your account using the verification code below.
            </p>

            <!-- Verification Code -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:2px solid ${settings.branding.primaryColor};border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:24px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Your Verification Code</p>
                  <p style="margin:0;font-size:36px;font-weight:800;color:${settings.branding.primaryColor};letter-spacing:0.2em;font-family:'Montserrat',sans-serif;">${verificationCode}</p>
                </td>
              </tr>
            </table>

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
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td align="center">
                  <a href="${setupUrl}" style="display:inline-block;background:${settings.branding.primaryColor};color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Set Up Your Account &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">or <a href="${signInUrl}" style="color:${settings.branding.primaryColor};">sign in directly</a> if your account is already set up</p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:1.5;">
              This verification code expires in 24 hours. If you weren't expecting this invitation, you can safely ignore this email.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              Need help? Contact <a href="mailto:${settings.email.supportEmail}" style="color:${settings.branding.primaryColor};">${settings.email.supportEmail}</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} ${settings.company.name} &middot; ${settings.branding.appName} Platform
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function adminNotificationHtml({
  name,
  email,
  role,
  unit,
  verificationCode,
  settings,
}: {
  name: string
  email: string
  role: string
  unit: string
  verificationCode: string
  settings: Awaited<ReturnType<typeof getSettings>>
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${settings.branding.primaryColor};padding:24px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">ADMIN NOTIFICATION</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:700;">New Team Member Setup</h2>
            <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.6;">
              <strong>${name}</strong> (${email}) is setting up their ${settings.branding.appName} account. Please review and approve their access in the admin panel.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:20px;">
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="33%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Role</p>
                        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${role}</p>
                      </td>
                      <td width="33%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Unit</p>
                        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${unit}</p>
                      </td>
                      <td width="33%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Code</p>
                        <p style="margin:0;font-size:14px;font-weight:700;color:${settings.branding.primaryColor};">${verificationCode}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${appUrl}/admin" style="display:inline-block;background:${settings.branding.primaryColor};color:#ffffff;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">
                    Review in Admin Panel &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${settings.company.name}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
