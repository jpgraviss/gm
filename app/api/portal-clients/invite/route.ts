import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { getSettings } from '@/lib/settings'
import { logAudit } from '@/lib/audit'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { requireAdmin } from '@/lib/admin-auth'
import { getAuthUser } from '@/lib/rbac'

export const POST = withErrorHandler('portal-clients/invite POST', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const actor = await getAuthUser(req)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const result = validate(body, {
    name:      { required: true, type: 'string', maxLength: 200 },
    email:     { required: true, type: 'string', pattern: EMAIL_PATTERN },
    company:   { required: true, type: 'string', maxLength: 200 },
    role:      { required: true, type: 'string', enum: ['Admin', 'Viewer'] },
    companyId: { required: false, type: 'string', maxLength: 100 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const email = (body.email as string).toLowerCase().trim()
  const company = body.company as string
  const name = body.name as string
  const role = body.role as string

  const { data: existingUser } = await db
    .from('portal_clients')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (existingUser) {
    return NextResponse.json({ error: 'A portal account already exists for this email' }, { status: 409 })
  }

  const tempPassword = crypto.randomBytes(16).toString('base64url')
  const { error: authError } = await db.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })
  if (authError && !authError.message.includes('already')) {
    throw new Error(authError?.message || 'Failed to create auth account')
  }

  // A caller-supplied portalConfig (e.g. the new-client wizard's
  // showAgreement/showInvoices/showReports toggles) wins over inheriting
  // an existing member's config for this company.
  // AUDIT #187 — this was matched by `company` name alone; two distinct
  // companies sharing a display name could inherit each other's
  // portal_config/service. Scope by company_id when known, matching the
  // fix applied to app/api/portal-clients/route.ts's POST.
  const companyId = body.companyId as string | undefined
  let portalConfig = (body.portalConfig as Record<string, unknown> | undefined) ?? null
  let existingMembersQuery = db
    .from('portal_clients')
    .select('portal_config, service')
    .not('portal_config', 'is', null)
  existingMembersQuery = companyId
    ? existingMembersQuery.eq('company_id', companyId)
    : existingMembersQuery.eq('company', company).is('company_id', null)
  const { data: existingMembers } = await existingMembersQuery.limit(1)
  if (!portalConfig && existingMembers && existingMembers.length > 0) {
    portalConfig = existingMembers[0].portal_config
  }

  const services = Array.isArray(body.services) ? body.services as string[] : []
  const service = (body.service as string | undefined) ?? (services.length ? services.join(', ') : undefined) ?? existingMembers?.[0]?.service ?? ''
  const clientId = `pc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const { data: newClient, error: insertErr } = await db
    .from('portal_clients')
    .insert({
      id:            clientId,
      company,
      company_id:    (body.companyId as string | undefined) ?? null,
      contact:       name,
      email,
      service,
      services,
      access:        'Not Setup',
      last_login:    'Never',
      portal_role:   role,
      portal_config: portalConfig,
    })
    .select()
    .single()

  if (insertErr) {
    throw new Error(insertErr?.message || 'Failed to create portal account')
  }

  const settings = await getSettings()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await db.from('portal_magic_tokens').insert({
    id: `pmt-${Date.now()}`,
    token,
    email,
    portal_client_id: clientId,
    expires_at: expiresAt,
    used: false,
  })

  const magicUrl = `${appUrl}/portal/auth/verify?token=${token}`

  const emailResult = await sendEmail({
    to: email,
    subject: `You're invited to the ${company} client portal`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@400;500;600;700;800&display=swap');</style></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#012b1e;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">${settings.company.name.toUpperCase()}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">CLIENT PORTAL INVITATION</p>
          </td>
        </tr>
        <tr>
          <td style="background:#e8f5e9;border-bottom:1px solid #c8e6c9;padding:16px 40px;">
            <p style="margin:0;font-size:14px;color:#1b5e20;font-weight:600;">You've been invited to your team's client portal</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;font-family:'Syncopate',sans-serif;letter-spacing:0.04em;">Hi ${name.split(' ')[0]},</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              You've been added to the <strong>${company}</strong> client portal on ${settings.company.name}. Click below to set up your account and access your project dashboard.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${magicUrl}" style="display:inline-block;background:${settings.branding.primaryColor};color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Set Up Your Account &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              This invitation link expires in 7 days. After signing in, you can use Google Sign-In or magic links for future access.
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

  // AUDIT.md #186 — this result was previously discarded entirely. The
  // portal account + magic-link token are already committed by this point
  // (real, working), so a failed send shouldn't roll those back — but the
  // caller needs to know the invitee has no working email in hand, instead
  // of the admin UI unconditionally showing "Invite sent to {email}".
  const emailSent = emailResult.success

  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action:   emailSent ? 'portal_invite_sent' : 'portal_invite_email_failed',
    module:   'portal',
    type:     emailSent ? 'action' : 'warning',
    metadata: { email, company, role, emailError: emailSent ? undefined : emailResult.error },
  })

  return NextResponse.json({
    id: newClient.id,
    company: newClient.company,
    contact: newClient.contact,
    email: newClient.email,
    role,
    emailSent,
  }, { status: 201 })
})
