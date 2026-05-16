import { NextRequest, NextResponse } from 'next/server'

type ReviewSource = 'Google' | 'Yelp' | 'Facebook'
type ReviewStatus = 'pending' | 'responded'

interface Review {
  id: string
  workspace_id: string
  source: ReviewSource
  reviewer_name: string
  rating: number
  text: string
  date: string
  response: string | null
  response_date: string | null
  status: ReviewStatus
}

export async function GET(_req: NextRequest) {
  // TODO: Replace with real Google / review-platform integration
  const reviews: Review[] = []
  return NextResponse.json(reviews)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { reviewId, response } = body as { reviewId: string; response: string }

  if (!reviewId || !response) {
    return NextResponse.json({ error: 'reviewId and response are required' }, { status: 400 })
  }

  // No reviews exist yet — cannot find the target review
  return NextResponse.json({ error: 'Review not found' }, { status: 404 })
}
