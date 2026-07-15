/**
 * Real dispatch mechanism for the "Review Campaigns" bulk-send feature
 * (app/reputation/requests/page.tsx). Resolves a campaign's `audience`
 * label into an actual list of client contacts, sends each a tokenized
 * review-request email (same public flow as the single-send "Request
 * Review" button — app/api/reputation/send-request/route.ts), and tracks
 * real sent/opened/reviews counts via review_requests.campaign_id.
 */
import { randomBytes } from 'crypto'
import { sendEmail } from '@/lib/email'
import { getSettings } from '@/lib/settings'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any

interface ReviewTemplateDef {
  subject: (firstName: string) => string
  /** Plain-text preview shown in the Review Campaigns UI before send. */
  previewText: string
  intro: string
}

// Keyword match against deals.service_type / deals.service_types (free
// text, no shared enum with the audience dropdown's labels — see
// lib/services.ts's LEGACY_SERVICE_NAMES for why these stay loose).
const AUDIENCE_SERVICE_KEYWORDS: Record<string, string[]> = {
  'Web Design Clients':    ['web'],
  'SEO Clients':           ['seo'],
  'PPC Clients':           ['ppc', 'paid'],
  'Social Media Clients':  ['social'],
}

export const REVIEW_TEMPLATES: Record<string, ReviewTemplateDef> = {
  'Happy Client Follow-Up': {
    subject: firstName => `${firstName}, we'd love your feedback!`,
    previewText:
      "Hi {{first_name}},\nThank you for choosing {{company}}! We truly appreciate your business and hope we exceeded your expectations. If you have a moment, we'd love to hear about your experience — your feedback helps us improve and helps others find us too.",
    intro:
      "Thank you for choosing {{company}}! We truly appreciate your business and hope we exceeded your expectations.<br/><br/>If you have a moment, we&rsquo;d love to hear about your experience. Your feedback helps us improve and helps others find us too.",
  },
  'Post-Project Review': {
    subject: firstName => `${firstName}, how did we do on your project?`,
    previewText:
      "Hi {{first_name}},\nYour project with {{company}} just wrapped up — we hope you love the results! We'd be grateful if you could share a quick review about your experience working with our team.",
    intro:
      "Your project with {{company}} just wrapped up &mdash; we hope you love the results!<br/><br/>We&rsquo;d be grateful if you could share a quick review about your experience working with our team.",
  },
  'Annual Check-In': {
    subject: firstName => `${firstName}, checking in after a year together!`,
    previewText:
      "Hi {{first_name}},\nIt's been a year since we started working together, and we wanted to say thank you! If you have a minute, we'd love to hear how things have been going.",
    intro:
      "It&rsquo;s been a year since we started working together, and we wanted to say thank you!<br/><br/>If you have a minute, we&rsquo;d love to hear how things have been going.",
  },
}

export const DEFAULT_REVIEW_TEMPLATE = 'Happy Client Follow-Up'

function fillMergeTags(text: string, firstName: string, companyName: string): string {
  return text.replace(/\{\{\s*first_name\s*\}\}/gi, firstName).replace(/\{\{\s*company\s*\}\}/gi, companyName)
}

function buildEmailHtml(templateName: string, firstName: string, companyName: string, reviewPageUrl: string, footerText: string): string {
  const def = REVIEW_TEMPLATES[templateName] ?? REVIEW_TEMPLATES[DEFAULT_REVIEW_TEMPLATE]
  const intro = fillMergeTags(def.intro, firstName, companyName)
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h2 style="color:#1a1a1a;font-size:22px;margin-bottom:8px;">Hi ${firstName},</h2>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:24px;">${intro}</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${reviewPageUrl}" style="display:inline-block;padding:14px 32px;background-color:#015035;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">Share Your Experience</a>
      </div>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-top:24px;">Thank you for your time &mdash; it means a lot to us!</p>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;">Warm regards,<br/><strong>The ${companyName} Team</strong></p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px;" />
      <p style="color:#999;font-size:12px;line-height:1.5;">${footerText}</p>
    </div>
  `
}

interface CampaignRecipient {
  companyId: string
  companyName: string
  contactName: string
  email: string
}

/** Resolve an audience label into real, emailable client contacts. */
export async function resolveCampaignAudience(db: DB, audience: string): Promise<CampaignRecipient[]> {
  let companyQuery = db.from('crm_companies').select('id, name, created_date').eq('status', 'Active Client')

  if (audience === 'Clients 12+ Months') {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 12)
    companyQuery = companyQuery.lte('created_date', cutoff.toISOString().split('T')[0])
  } else if (audience === 'New Clients (< 3 Months)') {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 3)
    companyQuery = companyQuery.gte('created_date', cutoff.toISOString().split('T')[0])
  }

  const { data: companies, error } = await companyQuery
  if (error) throw new Error(error.message || 'Failed to resolve audience companies')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let matched = (companies ?? []) as any[]

  const keywords = AUDIENCE_SERVICE_KEYWORDS[audience]
  if (keywords) {
    const { data: deals } = await db
      .from('deals')
      .select('company_id, service_type, service_types')
      .not('company_id', 'is', null)

    const matchingCompanyIds = new Set<string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const deal of (deals ?? []) as any[]) {
      const haystack = [deal.service_type, ...(deal.service_types ?? [])]
        .filter(Boolean)
        .map((s: string) => s.toLowerCase())
      if (haystack.some(s => keywords.some(k => s.includes(k)))) {
        matchingCompanyIds.add(deal.company_id)
      }
    }
    matched = matched.filter(c => matchingCompanyIds.has(c.id))
  }

  if (matched.length === 0) return []

  const companyIds = matched.map(c => c.id)
  const { data: contacts } = await db
    .from('crm_contacts')
    .select('company_id, full_name, emails, is_primary')
    .in('company_id', companyIds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byCompany = new Map<string, any[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const contact of (contacts ?? []) as any[]) {
    if (!contact.company_id) continue
    const list = byCompany.get(contact.company_id) ?? []
    list.push(contact)
    byCompany.set(contact.company_id, list)
  }

  const recipients: CampaignRecipient[] = []
  for (const company of matched) {
    const companyContacts = byCompany.get(company.id) ?? []
    const primary = companyContacts.find(c => c.is_primary) ?? companyContacts[0]
    const email = primary?.emails?.[0]
    if (!primary || !email) continue
    recipients.push({
      companyId: company.id,
      companyName: company.name,
      contactName: primary.full_name || 'there',
      email,
    })
  }

  return recipients
}

/**
 * Send a campaign to its resolved audience — creates a tokenized
 * review_requests row per recipient (same mechanism as the single-send
 * flow) and increments the campaign's real sent_count. Best-effort per
 * recipient: one failed send doesn't block the rest.
 */
export async function dispatchReviewCampaign(
  db: DB,
  campaign: { id: string; name: string; template: string; audience: string },
): Promise<{ sent: number; failed: number; recipients: number }> {
  const recipients = await resolveCampaignAudience(db, campaign.audience)

  const settings = await getSettings()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.gravissmarketing.com'

  let googleReviewUrl: string | null = null
  try {
    const { data } = await db.from('app_settings').select('google_reviews').eq('id', 'global').maybeSingle()
    const config = data?.google_reviews as { googleReviewUrl?: string } | null
    if (config?.googleReviewUrl) googleReviewUrl = config.googleReviewUrl
  } catch {
    // Non-fatal — email still sends without a review link.
  }

  const def = REVIEW_TEMPLATES[campaign.template] ?? REVIEW_TEMPLATES[DEFAULT_REVIEW_TEMPLATE]
  let sent = 0
  let failed = 0

  for (const recipient of recipients) {
    try {
      const token = randomBytes(24).toString('base64url')
      const { error: insertErr } = await db.from('review_requests').insert({
        token,
        customer_name: recipient.contactName,
        customer_email: recipient.email,
        company_name: recipient.companyName,
        google_review_url: googleReviewUrl,
        status: 'pending',
        campaign_id: campaign.id,
      })
      if (insertErr) throw new Error(insertErr.message)

      const reviewPageUrl = `${baseUrl}/go/review/${token}`
      const firstName = recipient.contactName.split(' ')[0] || 'there'
      const html = buildEmailHtml(campaign.template, firstName, recipient.companyName, reviewPageUrl, settings.email.footerText || '')

      const result = await sendEmail({ to: recipient.email, subject: def.subject(firstName), html })
      if (!result.success) throw new Error(result.error || 'Failed to send email')
      sent++
    } catch (err) {
      console.error(`[review-campaigns] failed to send campaign ${campaign.id} to ${recipient.email}:`, err)
      failed++
    }
  }

  if (sent > 0) {
    // supabase-js resolves {error} on an RPC failure rather than
    // rejecting — an unchecked call here would silently freeze
    // sent_count forever even though every email actually sent,
    // recreating the exact bug this feature was built to fix.
    const { error: rpcErr } = await db.rpc('increment_review_campaign_counts', { p_campaign_id: campaign.id, p_sent: sent, p_opened: 0, p_reviews: 0 })
    if (rpcErr) {
      console.error(`[review-campaigns] increment_review_campaign_counts failed for campaign ${campaign.id}:`, rpcErr.message)
    }
  }

  return { sent, failed, recipients: recipients.length }
}

/** Plain-text template previews for the "Templates" panel in the UI. */
export function getTemplatePreviews(companyName = 'Graviss Marketing'): Record<string, string> {
  const previews: Record<string, string> = {}
  for (const [name, def] of Object.entries(REVIEW_TEMPLATES)) {
    previews[name] = fillMergeTags(def.previewText, 'Alex', companyName)
  }
  return previews
}
