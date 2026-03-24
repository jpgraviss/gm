import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { contractId } = await req.json()

    if (!contractId) {
      return NextResponse.json({ error: 'contractId is required' }, { status: 400 })
    }

    const db = createServiceClient()

    // Fetch the contract
    const { data: contract, error: cErr } = await db
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single()
    if (cErr || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Find the primary contact for this company
    const { data: contacts } = await db
      .from('crm_contacts')
      .select('*')
      .eq('company_name', contract.company)
      .order('is_primary', { ascending: false })
      .limit(1)

    const contact = contacts?.[0]
    const recipientEmail = contact?.emails?.[0]

    if (!recipientEmail) {
      return NextResponse.json({ error: `No contact email found for ${contract.company}` }, { status: 400 })
    }

    const contactName = contact.full_name || `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'there'
    const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

    const { data, error } = await resend.emails.send({
      from: 'GravHub <noreply@app.gravissmarketing.com>',
      replyTo: 'info@gravissmarketing.com',
      to: [recipientEmail],
      subject: `Contract for Review — ${contract.service_type} | Graviss Marketing`,
      html: contractEmailHtml({
        contactName,
        company: contract.company,
        serviceType: contract.service_type,
        value: contract.value,
        billingStructure: contract.billing_structure,
        startDate: contract.start_date,
        duration: contract.duration,
        portalUrl,
      }),
    })

    if (error) {
      console.error('[email/send-contract POST]', error)
      return NextResponse.json({ error: error?.message || 'Failed to send contract email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id, sentTo: recipientEmail })
  } catch (err) {
    console.error('Send contract email error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function contractEmailHtml({
  contactName,
  company,
  serviceType,
  value,
  billingStructure,
  startDate,
  duration,
  portalUrl,
}: {
  contactName: string
  company: string
  serviceType: string
  value: number
  billingStructure: string
  startDate: string
  duration: number
  portalUrl: string
}) {
  const formattedValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  const formattedDate = startDate ? new Date(startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'

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
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.04em;">CONTRACT FOR REVIEW</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;">Hi ${contactName},</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Your ${serviceType} service agreement with Graviss Marketing is ready for review. Please find the details below.
            </p>

            <!-- Contract Details Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%" style="padding-bottom:16px;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Service</p>
                        <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${serviceType}</p>
                      </td>
                      <td width="50%" style="padding-bottom:16px;text-align:right;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Contract Value</p>
                        <p style="margin:0;font-size:20px;font-weight:700;color:#015035;">${formattedValue}</p>
                      </td>
                    </tr>
                    <tr>
                      <td width="33%">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Billing</p>
                        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${billingStructure}</p>
                      </td>
                      <td width="33%" style="text-align:center;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Start Date</p>
                        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${formattedDate}</p>
                      </td>
                      <td width="33%" style="text-align:right;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Term</p>
                        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${duration} months</p>
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
                  <a href="${portalUrl}" style="display:inline-block;background:#015035;color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;">
                    Review Contract &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              If you have any questions about the terms, reply to this email or contact us at <a href="mailto:info@gravissmarketing.com" style="color:#015035;">info@gravissmarketing.com</a>.
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
