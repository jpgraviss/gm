import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const sequenceId = searchParams.get('sequenceId')
  const contactEmail = searchParams.get('contactEmail')
  const enrollmentId = searchParams.get('enrollmentId')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200)

  if (!sequenceId && !contactEmail && !enrollmentId) {
    return NextResponse.json(
      { error: 'At least one filter required: sequenceId, contactEmail, or enrollmentId' },
      { status: 400 },
    )
  }

  const db = createServiceClient()

  let query = db
    .from('sequence_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sequenceId) query = query.eq('sequence_id', sequenceId)
  if (contactEmail) query = query.eq('contact_email', contactEmail)
  if (enrollmentId) query = query.eq('enrollment_id', enrollmentId)

  const { data, error } = await query

  if (error) {
    console.error('[sequences/activities GET]', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch activities' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
