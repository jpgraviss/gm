import { NextRequest, NextResponse } from 'next/server'
import { getGBPReviews, getGBPSummary } from '@/lib/google-business-profile'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * GET /api/integrations/gbp/reviews?location=accounts/123/locations/456&days=28&limit=50
 * Returns reviews + summary for a given location.
 */
export const GET = withErrorHandler('integrations/gbp/reviews GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const location = searchParams.get('location')
  const days = parseInt(searchParams.get('days') ?? '28', 10)
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  if (!location) {
    return NextResponse.json({ error: 'location param required' }, { status: 400 })
  }

  const [reviewData, summary] = await Promise.all([
    getGBPReviews(location, limit),
    getGBPSummary(location, days),
  ])

  return NextResponse.json({
    reviews:          reviewData.reviews,
    totalReviewCount: reviewData.totalReviewCount,
    averageRating:    reviewData.averageRating,
    summary,
    days,
  })
})
