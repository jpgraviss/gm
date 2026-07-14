import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { getSettings } from '@/lib/settings'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('portal-clients/complete-setup POST', async (req) => {
  const { email, code, password, displayName } = await req.json()
  if (!email || !code || !password) {
    return NextResponse.json({ error: 'Email, verification code, and password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const db = createServiceClient()
  const normalizedEmail = email.toLowerCase().trim()

  const { data: client, error: clientErr } = await db
    .from('portal_clients')
    .select('id, company, contact, verification_code, verification_expires')
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'No portal account found' }, { status: 404 })
  }

  // Re-validate the verification code server-side — the setup page's
  // earlier /verify-code call only gated which step of the wizard is shown
  // client-side; it never actually gated this route, which is the one that
  // sets a real password. Without this, anyone who knows/guesses a portal
  // client's email could set that account's password directly.
  if (!client.verification_code || client.verification_code !== String(code).trim()) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }
  if (client.verification_expires && new Date(client.verification_expires) < new Date()) {
    return NextResponse.json({ error: 'Verification code has expired. Please contact your administrator for a new invite.' }, { status: 400 })
  }

  const { data: { users }, error: listErr } = await db.auth.admin.listUsers()
  if (listErr) {
    throw new Error(listErr?.message || 'Failed to list users')
  }

  const authUser = users?.find(u => u.email?.toLowerCase() === normalizedEmail)
  if (authUser) {
    const { error: updateErr } = await db.auth.admin.updateUserById(authUser.id, { password })
    if (updateErr) {
      throw new Error(updateErr?.message || 'Failed to set password')
    }
  }

  const update: Record<string, unknown> = {
    setup_completed: true,
    pending_approval: true,
    verification_code: null,
    verification_expires: null,
  }
  if (displayName) update.contact = displayName

  const { error: updateClientErr } = await db
    .from('portal_clients')
    .update(update)
    .eq('id', client.id)

  if (updateClientErr) {
    throw new Error(updateClientErr?.message || 'Failed to complete setup')
  }

  const settings = await getSettings()

  const { data: admins } = await db
    .from('team_members')
    .select('email, name')
    .eq('is_admin', true)

  if (admins && admins.length > 0) {
    const { data: settingsRow } = await db
      .from('app_settings')
      .select('approval_config')
      .eq('id', 'global')
      .maybeSingle()
    const approvalConfig = settingsRow?.approval_config as { portalClientApprovals?: string[] } | null
    const configuredEmails = approvalConfig?.portalClientApprovals
    const adminEmails = (configuredEmails?.length ? configuredEmails : admins.map(a => a.email)).filter(Boolean)
    const clientName = displayName || client.contact || normalizedEmail
    for (const adminEmail of adminEmails) {
      await sendEmail({
        to: adminEmail,
        subject: `Portal Client Pending Approval: ${clientName}`,
        html: `<!DOCTYPE html>
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
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">PORTAL APPROVAL REQUIRED</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fff7ed;border-bottom:1px solid #fed7aa;padding:16px 40px;">
            <p style="margin:0;font-size:14px;color:#9a3412;font-weight:600;">A new portal client is waiting for your approval</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Client Name</p>
                        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${clientName}</p>
                      </td>
                      <td width="50%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Company</p>
                        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${client.company}</p>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-top:16px;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Email</p>
                        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${normalizedEmail}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'}/admin" style="display:inline-block;background:${settings.branding.primaryColor};color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Review in Admin Panel &rarr;
                  </a>
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
</html>`,
      })
    }
  }

  logAudit({
    userName: displayName || client.contact || normalizedEmail,
    action: 'portal_client_setup_completed',
    module: 'portal',
    type: 'info',
    metadata: { email: normalizedEmail, company: client.company },
  })

  return NextResponse.json({ success: true })
})
