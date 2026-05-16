import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getGBPReviews, STAR_TO_NUMBER } from '@/lib/google-business-profile'
import type { GBPStarRating } from '@/lib/google-business-profile'

export async function POST() {
  const db = createServiceClient()

  const { data: settings } = await db
    .from('app_settings')
    .select('google_reviews')
    .eq('id', 'global')
    .maybeSingle()

  const config = settings?.google_reviews as {
    locationName?: string
    lastSyncAt?: string
  } | null

  if (!config?.locationName) {
    return NextResponse.json(
      { error: 'No Google Business location configured. Go to Settings > Integrations to set it up.' },
      { status: 400 },
    )
  }

  try {
    const { reviews: gbpReviews } = await getGBPReviews(config.locationName, 50)

    let newCount = 0
    let updatedCount = 0

    for (const review of gbpReviews) {
      const rating = STAR_TO_NUMBER[review.starRating as GBPStarRating]
      const reviewerName = review.reviewer.displayName
      const date = review.createTime
      const text = review.comment
      const response = review.reviewReply?.comment ?? null
      const responseDate = review.reviewReply?.updateTime ?? null
      const status = review.reviewReply ? 'responded' : 'pending'

      const { data: existing } = await db
        .from('reviews')
        .select('id')
        .eq('reviewer_name', reviewerName)
        .eq('date', date)
        .eq('source', 'Google')
        .maybeSingle()

      if (existing) {
        await db
          .from('reviews')
          .update({
            rating,
            text,
            response,
            response_date: responseDate,
            status,
            google_review_id: review.reviewId,
            location_name: config.locationName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
        updatedCount++
      } else {
        await db
          .from('reviews')
          .insert({
            id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            workspace_id: 'default',
            source: 'Google',
            reviewer_name: reviewerName,
            rating,
            text,
            date,
            response,
            response_date: responseDate,
            status,
            google_review_id: review.reviewId,
            location_name: config.locationName,
          })
        newCount++
      }
    }

    const now = new Date().toISOString()
    await db
      .from('app_settings')
      .update({
        google_reviews: { ...config, lastSyncAt: now },
        updated_at: now,
      })
      .eq('id', 'global')

    return NextResponse.json({
      ok: true,
      new: newCount,
      updated: updatedCount,
      total: gbpReviews.length,
      lastSyncAt: now,
    })
  } catch (err) {
    console.error('[reputation/sync]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 },
    )
  }
}
