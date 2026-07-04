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
    .select('id, token, customer_name, company_name, google_review_url, status')
    .eq('token', token)
    .maybeSingle()

  if (!request) notFound()

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
