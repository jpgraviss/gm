import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { proposalId } = await req.json()

    if (!proposalId) {
      return NextResponse.json({ error: 'proposalId is required' }, { status: 400 })
    }

    const db = createServiceClient()

    // Fetch the proposal
    const { data: proposal, error: pErr } = await db
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single()
    if (pErr || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Find the primary contact for this company
    const { data: contacts } = await db
      .from('contacts')
      .select('*')
      .eq('company_name', proposal.company)
      .order('is_primary', { ascending: false })
      .limit(1)

    const contact = contacts?.[0]
    const recipientEmail = contact?.emails?.[0]

    if (!recipientEmail) {
      return NextResponse.json({ error: `No contact email found for ${proposal.company}` }, { status: 400 })
    }

    const contactName = contact.full_name || `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'there'
    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
    const items = proposal.items ?? []

    const { data, error } = await resend.emails.send({
      from: 'GravHub <noreply@app.gravissmarketing.com>',
      replyTo: 'info@gravissmarketing.com',
      to: [recipientEmail],
      subject: `Proposal from Graviss Marketing — ${proposal.service_type}`,
      html: proposalEmailHtml({
        contactName,
        company: proposal.company,
        serviceType: proposal.service_type,
        value: proposal.value,
        items,
        portalUrl,
      }),
    })

    if (error) {
      console.error('[email/send-proposal POST]', error)
      return NextResponse.json({ error: 'Failed to send proposal email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id, sentTo: recipientEmail })
  } catch (err) {
    console.error('Send proposal email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function proposalEmailHtml({
  contactName,
  company,
  serviceType,
  value,
  items,
  portalUrl,
}: {
  contactName: string
  company: string
  serviceType: string
  value: number
  items: { name: string; type: string; amount: number }[]
  portalUrl: string
}) {
  const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  const recurring = items.filter(i => i.type === 'recurring')
  const oneTime = items.filter(i => i.type === 'one-time')

  const itemRows = (list: typeof items, label: string) => {
    if (list.length === 0) return ''
    return `
      <tr><td colspan="2" style="padding:12px 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">${label}</td></tr>
      ${list.map(i => `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#374151;">${i.name}</td>
          <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;">${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(i.amount)}</td>
        </tr>
      `).join('')}
    `
  }

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
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.08em;font-family:Georgia,serif;">GRAVISS MARKETING</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;">PROPOSAL</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;">Hi ${contactName},</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Thank you for your interest in working with Graviss Marketing. We&rsquo;ve prepared a ${serviceType} proposal for ${company}.
            </p>

            <!-- Summary Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Service</p>
                        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${serviceType}</p>
                      </td>
                      <td style="text-align:right;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Total Value</p>
                        <p style="margin:0;font-size:20px;font-weight:700;color:#015035;">${formattedValue}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${items.length > 0 ? `
            <!-- Line Items -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              ${itemRows(recurring, 'Recurring Services')}
              ${itemRows(oneTime, 'One-Time Services')}
            </table>` : ''}

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${portalUrl}" style="display:inline-block;background:#015035;color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    View Full Proposal &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              Have questions? Reply to this email or contact us at <a href="mailto:info@gravissmarketing.com" style="color:#015035;">info@gravissmarketing.com</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
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
</html>`
}
