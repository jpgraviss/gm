import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const db = createServiceClient()
  const { searchParams } = new URL(req.url)

  const source = searchParams.get('source')
  const rating = searchParams.get('rating')
  const status = searchParams.get('status')

  let query = db
    .from('reviews')
    .select('*')
    .order('date', { ascending: false })

  if (source) query = query.eq('source', source)
  if (rating) query = query.eq('rating', parseInt(rating, 10))
  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    console.error('[reviews GET]', error)
    return NextResponse.json([], { status: 200 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const db = createServiceClient()
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.action === 'add_review') {
    const { source, reviewer_name, rating, text, date } = body as {
      source: string
      reviewer_name: string
      rating: number
      text: string
      date: string
    }
    if (!source || !reviewer_name || !rating) {
      return NextResponse.json({ error: 'source, reviewer_name, and rating are required' }, { status: 400 })
    }
    const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const { data, error } = await db
      .from('reviews')
      .insert({
        id,
        workspace_id: 'default',
        source,
        reviewer_name,
        rating,
        text: text || '',
        date: date || new Date().toISOString(),
        response: null,
        response_date: null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('[reviews POST add]', error)
      return NextResponse.json({ error: 'Failed to add review' }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  const { reviewId, response, postToGoogle } = body as {
    reviewId?: string
    response?: string
    postToGoogle?: boolean
  }

  if (!reviewId || !response) {
    return NextResponse.json({ error: 'reviewId and response are required' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data, error } = await db
    .from('reviews')
    .update({
      response,
      response_date: now,
      status: 'responded',
      updated_at: now,
    })
    .eq('id', reviewId)
    .select()
    .single()

  if (error) {
    console.error('[reviews POST respond]', error)
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  if (postToGoogle && data.google_review_id && data.location_name) {
    try {
      const { replyToGBPReview } = await import('@/lib/google-business-profile')
      await replyToGBPReview(data.location_name, data.google_review_id, response)
    } catch (err) {
      console.error('[reviews POST google-reply]', err)
    }
  }

  return NextResponse.json(data)
}
