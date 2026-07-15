import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getGBPReviews, replyToGBPReview, STAR_TO_NUMBER } from '@/lib/google-business-profile'
import type { GBPStarRating } from '@/lib/google-business-profile'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

interface MappedReview {
  id: string
  source: 'Google'
  reviewer_name: string
  rating: number
  text: string
  date: string
  response: string | null
  response_date: string | null
  status: 'pending' | 'responded'
  google_review_id: string
  location_name: string
}

function mapGBPReview(review: {
  reviewId: string
  reviewer: { displayName: string }
  starRating: GBPStarRating
  comment: string
  createTime: string
  reviewReply?: { comment: string; updateTime: string }
}, locationName: string): MappedReview {
  return {
    id: `gbp-${review.reviewId}`,
    source: 'Google',
    reviewer_name: review.reviewer.displayName,
    rating: STAR_TO_NUMBER[review.starRating],
    text: review.comment,
    date: review.createTime,
    response: review.reviewReply?.comment ?? null,
    response_date: review.reviewReply?.updateTime ?? null,
    status: review.reviewReply ? 'responded' : 'pending',
    google_review_id: review.reviewId,
    location_name: locationName,
  }
}

export const GET = withErrorHandler('integrations/google-reviews GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const locationName = searchParams.get('location')

  if (!locationName) {
    const db = createServiceClient()
    const { data: settings } = await db
      .from('app_settings')
      .select('google_reviews')
      .eq('id', 'global')
      .maybeSingle()

    const config = settings?.google_reviews as { locationName?: string } | null
    if (!config?.locationName) {
      return NextResponse.json(
        { error: 'No Google Business location configured. Go to Settings > Integrations to set it up.' },
        { status: 400 },
      )
    }

    return fetchAndReturn(config.locationName)
  }

  return fetchAndReturn(locationName)
})

async function fetchAndReturn(locationName: string) {
  const { reviews } = await getGBPReviews(locationName, 50)
  const mapped = reviews.map((r) => mapGBPReview(r, locationName))
  return NextResponse.json(mapped)
}

export const POST = withErrorHandler('integrations/google-reviews POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  let body: { location?: string; reviewId?: string; comment?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { location, reviewId, comment } = body
  if (!location || !reviewId || !comment) {
    return NextResponse.json(
      { error: 'location, reviewId, and comment are required' },
      { status: 400 },
    )
  }

  const reply = await replyToGBPReview(location, reviewId, comment)
  return NextResponse.json({ ok: true, reply })
})
