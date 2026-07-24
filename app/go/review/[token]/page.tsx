import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import { getSettings } from '@/lib/settings'
import ReviewFlow from './ReviewFlow'

interface Props {
  params: Promise<{ token: string }>
}

export default async function PublicReviewPage({ params }: Props) {
  const { token } = await params
  const db = createServiceClient()

  const { data: request } = await db
    .from('review_requests')
    .select('id, token, customer_name, company_name, google_review_url, status, campaign_id, opened_at')
    .eq('token', token)
    .maybeSingle()

  if (!request) notFound()

  // AUDIT #348 — this page is the actual thing a customer opens; the
  // /api/reputation/review-request/[token] GET route also has "mark
  // opened" logic, but nothing ever called it (this page reads
  // review_requests directly, never through that route), so campaign
  // "Opened" counts were permanently 0. Do the same atomic
  // conditional-update + counter increment here, on the real page load.
  if (request.campaign_id && !request.opened_at) {
    const { data: claimed } = await db
      .from('review_requests')
      .update({ opened_at: new Date().toISOString() })
      .eq('token', token)
      .is('opened_at', null)
      .select('id')
      .maybeSingle()
    if (claimed) {
      const { error: rpcErr } = await db.rpc('increment_review_campaign_counts', {
        p_campaign_id: request.campaign_id, p_sent: 0, p_opened: 1, p_reviews: 0,
      })
      if (rpcErr) {
        console.error(`[review-request page] increment_review_campaign_counts (opened) failed for campaign ${request.campaign_id}:`, rpcErr.message)
      }
    }
  }

  const settings = await getSettings()
  const companyName = request.company_name || settings.company.name

  return (
    <ReviewFlow
      token={request.token}
      customerName={request.customer_name}
      companyName={companyName}
      alreadyCompleted={request.status === 'completed'}
    />
  )
}
