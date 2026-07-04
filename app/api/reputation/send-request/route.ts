import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { getSettings } from '@/lib/settings'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email } = body as { name?: string; email?: string }

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: 'Name and email are required' },
      { status: 400 },
    )
  }

  const settings = await getSettings()
  const companyName = settings.company.name

  // Try to get Google review link from app_settings
  let googleReviewUrl: string | null = null
  try {
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('google_reviews')
      .eq('id', 'global')
      .maybeSingle()

    const config = data?.google_reviews as {
      locationName?: string
      googleReviewUrl?: string
    } | null

    // Use stored review URL, or construct one from location name
    if (config?.googleReviewUrl) {
      googleReviewUrl = config.googleReviewUrl
    } else if (config?.locationName) {
      // GBP location names look like "accounts/xxx/locations/xxx"
      // We can't derive a review URL from that, but we note it's configured
      googleReviewUrl = null
    }
  } catch {
    // Non-fatal — we'll send the email without a review link
  }

  const firstName = name.trim().split(' ')[0]
  const reviewLink = googleReviewUrl
    ? `<a href="${googleReviewUrl}" style="display:inline-block;padding:14px 32px;background-color:#015035;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">Leave a Google Review</a>`
    : `<a href="https://www.google.com/search?q=${encodeURIComponent(companyName)}+reviews" style="display:inline-block;padding:14px 32px;background-color:#015035;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">Leave a Google Review</a>`

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h2 style="color:#1a1a1a;font-size:22px;margin-bottom:8px;">Hi ${firstName},</h2>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:16px;">
        Thank you for choosing ${companyName}! We truly appreciate your business and hope we exceeded your expectations.
      </p>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:24px;">
        If you have a moment, we&rsquo;d love to hear about your experience. Your feedback helps us improve and helps others find us too.
      </p>
      <div style="text-align:center;margin:32px 0;">
        ${reviewLink}
      </div>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-top:24px;">
        Thank you for your time &mdash; it means a lot to us!
      </p>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;">
        Warm regards,<br/>
        <strong>The ${companyName} Team</strong>
      </p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px;" />
      <p style="color:#999;font-size:12px;line-height:1.5;">
        ${settings.email.footerText || ''}
      </p>
    </div>
  `

  const result = await sendEmail({
    to: email.trim(),
    subject: `${firstName}, we'd love your feedback!`,
    html,
  })

  if (!result.success) {
    console.error('[reputation/send-request]', result.error)
    return NextResponse.json(
      { error: result.error || 'Failed to send email' },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, id: result.id })
}
