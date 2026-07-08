import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { createServiceClient } from '@/lib/supabase'
import { getSettings } from '@/lib/settings'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('email/portal-invite POST', async (req: NextRequest) => {
  const settings = await getSettings()
  const { company, contactName, email, service, isResend: isResendInvite } = await req.json()

  if (!company || !email) {
    return NextResponse.json({ error: 'company and email are required' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  const db = createServiceClient()

  const verificationCode = String(Math.floor(100000 + Math.random() * 900000))
  const verificationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  await db
    .from('portal_clients')
    .update({
      verification_code: verificationCode,
      verification_expires: verificationExpires,
    })
    .ilike('email', email.toLowerCase().trim())

  const setupUrl = `${appUrl}/portal/setup?email=${encodeURIComponent(email)}&token=invite`

  const result = await sendEmail({
    to: email,
    subject: isResendInvite
      ? `Reminder: Your ${company} client portal is ready`
      : `Your ${settings.company.name} client portal is ready`,
    html: portalInviteHtml({ company, contactName, email, service, signInUrl: setupUrl, isResend: isResendInvite, settings, verificationCode }),
  })

  if (!result.success) {
    throw new Error(result.error || 'Failed to send portal invite email')
  }

  const { data: admins } = await db
    .from('team_members')
    .select('email, name')
    .eq('is_admin', true)

  if (admins && admins.length > 0) {
    for (const admin of admins) {
      if (!admin.email) continue
      await sendEmail({
        to: admin.email,
        subject: `New portal client invited: ${contactName || email} (${company})`,
        html: adminNotifyHtml({ company, contactName, email, settings }),
      })
    }
  }

  return NextResponse.json({ success: true, id: result.id })
})

function adminNotifyHtml({
  company,
  contactName,
  email,
  settings,
}: {
  company: string
  contactName: string
  email: string
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
        <tr>
          <td style="background:${settings.branding.darkBg};padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">${settings.company.name.toUpperCase()}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">ADMIN NOTIFICATION</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:700;">New Portal Client Invited</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              A new portal client <strong>${contactName || email}</strong> from <strong>${company}</strong> has been invited.
              They'll need your approval to access the portal once they complete their account setup.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Client</p>
                  <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#111827;">${contactName || 'Not provided'}</p>
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Company</p>
                  <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#111827;">${company}</p>
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Email</p>
                  <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${email}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} ${settings.company.name}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function portalInviteHtml({
  company,
  contactName,
  email,
  service,
  signInUrl,
  isResend,
  settings,
  verificationCode,
}: {
  company: string
  contactName: string
  email: string
  service: string
  signInUrl: string
  isResend?: boolean
  settings: Awaited<ReturnType<typeof getSettings>>
  verificationCode: string
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
          <td style="background:${settings.branding.darkBg};padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">${settings.company.name.toUpperCase()}</h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">CLIENT PORTAL ACCESS</p>
                </td>
                <td align="right">
                  <div style="background:${settings.branding.primaryColor};border-radius:10px;padding:10px 16px;display:inline-block;">
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
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;font-family:'Syncopate',sans-serif;letter-spacing:0.04em;">
              Hi ${contactName || 'there'},
            </h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              ${isResend
                ? `Just a reminder that your <strong>${company}</strong> client portal is set up and ready to use. Access your project updates, invoices, and shared files anytime.`
                : `${settings.company.name} has set up a dedicated client portal for <strong>${company}</strong>. Your portal gives you real-time visibility into your project, billing, and a direct line to our team.`
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

            <!-- Verification Code -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;">Your Verification Code</p>
                  <p style="margin:0;font-size:28px;font-weight:800;color:#0c4a6e;font-family:monospace;letter-spacing:0.2em;">${verificationCode}</p>
                  <p style="margin:8px 0 0;font-size:12px;color:#0369a1;">This code expires in 48 hours.</p>
                </td>
              </tr>
            </table>

            <!-- Login info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Your Portal Email</p>
                  <p style="margin:0;font-size:16px;font-weight:600;color:#111827;font-family:monospace;">${email}</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${signInUrl}" style="display:inline-block;background:${settings.branding.primaryColor};color:#ffffff;font-size:14px;font-weight:700;padding:16px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Set Up Your Account →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:1.5;">
              Click the button above to set up your account. You'll need the verification code shown above to get started.
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
              &copy; ${new Date().getFullYear()} ${settings.company.name} &middot; <a href="mailto:${settings.email.supportEmail}" style="color:${settings.branding.primaryColor};">${settings.email.supportEmail}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
