import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { getSettings } from '@/lib/settings'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('proposals/[id]/share POST', async (req, ctx) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await ctx!.params

  const { clientEmail } = await req.json()

  if (!clientEmail || typeof clientEmail !== 'string') {
    return NextResponse.json({ error: 'clientEmail is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Check proposal exists
  const { data: proposal, error: fetchErr } = await db
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Generate token if not already present
  const token = proposal.token || crypto.randomUUID()

  // Update proposal with token and client email
  const { error: updateErr } = await db
    .from('proposals')
    .update({
      token,
      client_email: clientEmail,
      status: proposal.status === 'Draft' || proposal.status === 'Approved' ? 'Sent' : proposal.status,
      sent_date: proposal.sent_date || new Date().toISOString().split('T')[0],
    })
    .eq('id', id)

  if (updateErr) {
    throw new Error(updateErr?.message || 'Failed to update proposal')
  }

    // Send email with viewing link
    const settings = await getSettings()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
    const viewUrl = `${appUrl}/proposal/${token}`

    const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(proposal.value ?? 0)

    const result = await sendEmail({
      to: clientEmail,
      subject: `Proposal from ${settings.company.name} — ${proposal.service_type}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#015035;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:'Syncopate',sans-serif;">GRAVISS MARKETING</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;font-family:'Syncopate',sans-serif;">PROPOSAL</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;">Hello,</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              We've prepared a ${proposal.service_type} proposal for ${proposal.company} valued at ${formattedValue}. Click below to view the full details and respond.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${viewUrl}" style="display:inline-block;background:#015035;color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    View Proposal &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              Have questions? Reply to this email or contact us at <a href="mailto:${settings.email.supportEmail}" style="color:#015035;">${settings.email.supportEmail}</a>.
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

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, token, viewUrl, emailId: result.id })
})
