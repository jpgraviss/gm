import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sendEmail } from '@/lib/email'
import { getSettings } from '@/lib/settings'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const POST = withErrorHandler('reputation/send-request POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const { name, email, companyName: reqCompanyName } = body as {
    name?: string
    email?: string
    companyName?: string
  }

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: 'Name and email are required' },
      { status: 400 },
    )
  }

  const settings = await getSettings()
  const companyName = reqCompanyName?.trim() || settings.company.name

  // Get Google review URL from app_settings
  let googleReviewUrl: string | null = null
  const db = createServiceClient()
  try {
    const { data } = await db
      .from('app_settings')
      .select('google_reviews')
      .eq('id', 'global')
      .maybeSingle()

    const config = data?.google_reviews as {
      locationName?: string
      googleReviewUrl?: string
    } | null

    if (config?.googleReviewUrl) {
      googleReviewUrl = config.googleReviewUrl
    }
  } catch {
    // Non-fatal
  }

  // Generate a unique token for this review request
  const token = randomBytes(24).toString('base64url')

  // Store the review request in the database
  const { error: insertErr } = await db.from('review_requests').insert({
    token,
    customer_name: name.trim(),
    customer_email: email.trim(),
    company_name: companyName,
    google_review_url: googleReviewUrl,
    status: 'pending',
  })

  if (insertErr) {
    throw new Error(insertErr?.message || 'Failed to create review request')
  }

  // Build the review link pointing to the public review page
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`
  const reviewPageUrl = `${baseUrl}/go/review/${token}`

  const firstName = name.trim().split(' ')[0]

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
        <a href="${reviewPageUrl}" style="display:inline-block;padding:14px 32px;background-color:#015035;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">Share Your Experience</a>
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
    throw new Error(result.error || 'Failed to send email')
  }

  return NextResponse.json({ success: true, id: result.id, token })
})
