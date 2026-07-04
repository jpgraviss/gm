import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

interface Params {
  params: Promise<{ token: string }>
}

/** GET — look up a review request by token (used by the public review page) */
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('review_requests')
    .select('id, token, customer_name, company_name, google_review_url, status')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Review request not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/** POST — submit a rating (and optional feedback) for a review request */
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rating = body.rating as number | undefined
  const feedback = (body.feedback as string | undefined)?.trim() || null

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating (1-5) is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Look up the request
  const { data: request, error: lookupErr } = await db
    .from('review_requests')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (lookupErr || !request) {
    return NextResponse.json({ error: 'Review request not found' }, { status: 404 })
  }

  if (request.status === 'completed') {
    return NextResponse.json({ error: 'This review request has already been completed' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Update the review request with the rating and feedback
  const { error: updateErr } = await db
    .from('review_requests')
    .update({
      rating,
      feedback,
      status: 'completed',
      updated_at: now,
      completed_at: now,
    })
    .eq('token', token)

  if (updateErr) {
    console.error('[review-request POST] update error:', updateErr)
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
  }

  // If rating is 1-3 (negative/neutral), save as internal feedback in the reviews table
  if (rating <= 3 && feedback) {
    const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    await db.from('reviews').insert({
      id: reviewId,
      workspace_id: 'default',
      source: 'Internal',
      reviewer_name: request.customer_name,
      rating,
      text: feedback,
      date: now,
      response: null,
      response_date: null,
      status: 'pending',
      company_name: request.company_name || null,
    })
  }

  // Determine response based on rating
  const isPositive = rating >= 4
  const googleReviewUrl = request.google_review_url || null

  return NextResponse.json({
    success: true,
    isPositive,
    googleReviewUrl: isPositive ? googleReviewUrl : null,
  })
}
