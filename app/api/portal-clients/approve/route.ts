import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { sendEmail } from '@/lib/email'
import { getSettings } from '@/lib/settings'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req)
  if (denied) return denied

  try {
    const { clientId, approved } = await req.json()
    if (!clientId || typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'clientId and approved (boolean) are required' }, { status: 400 })
    }

    const db = createServiceClient()
    const settings = await getSettings()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

    const { data: client, error: fetchErr } = await db
      .from('portal_clients')
      .select('id, email, company, contact')
      .eq('id', clientId)
      .single()

    if (fetchErr || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (approved) {
      const { error: updateErr } = await db
        .from('portal_clients')
        .update({
          pending_approval: false,
          access: 'Active',
          approved_by: 'admin',
          approved_at: new Date().toISOString(),
        })
        .eq('id', clientId)

      if (updateErr) {
        console.error('[approve POST] update error:', updateErr)
        return NextResponse.json({ error: 'Failed to approve client' }, { status: 500 })
      }

      await sendEmail({
        to: client.email,
        subject: `Your ${settings.company.name} portal access is approved!`,
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
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">CLIENT PORTAL</p>
          </td>
        </tr>
        <tr>
          <td style="background:#e8f5e9;border-bottom:1px solid #c8e6c9;padding:16px 40px;">
            <p style="margin:0;font-size:14px;color:#1b5e20;font-weight:600;">Your portal access has been approved!</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;font-family:'Syncopate',sans-serif;letter-spacing:0.04em;">Welcome, ${client.contact?.split(' ')[0] || 'there'}!</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Great news! Your ${client.company} client portal has been approved and is ready to use. You can now sign in to access your project updates, invoices, and more.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${appUrl}/portal" style="display:inline-block;background:${settings.branding.primaryColor};color:#ffffff;font-size:14px;font-weight:700;padding:16px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Sign In to Your Portal &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              Questions? Reply to this email or contact your account manager directly.
            </p>
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

      logAudit({
        userName: 'admin',
        action: `portal_client_approved: ${client.contact} (${client.company})`,
        module: 'portal',
        type: 'success',
        metadata: { clientId, email: client.email, company: client.company },
      })
    } else {
      const { error: updateErr } = await db
        .from('portal_clients')
        .update({
          pending_approval: false,
          access: 'Disabled',
        })
        .eq('id', clientId)

      if (updateErr) {
        console.error('[approve POST] deny update error:', updateErr)
        return NextResponse.json({ error: 'Failed to deny client' }, { status: 500 })
      }

      await sendEmail({
        to: client.email,
        subject: `${settings.company.name} portal access update`,
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
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">CLIENT PORTAL</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Hi ${client.contact?.split(' ')[0] || 'there'}, unfortunately your portal access request for ${client.company} was not approved at this time. If you believe this is an error, please contact us directly.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              You can reach us at <a href="mailto:${settings.email.supportEmail}" style="color:${settings.branding.primaryColor};">${settings.email.supportEmail}</a>.
            </p>
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

      logAudit({
        userName: 'admin',
        action: `portal_client_denied: ${client.contact} (${client.company})`,
        module: 'portal',
        type: 'warning',
        metadata: { clientId, email: client.email, company: client.company },
      })
    }

    return NextResponse.json({ success: true, approved })
  } catch (err) {
    console.error('[approve POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
