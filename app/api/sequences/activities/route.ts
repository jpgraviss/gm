import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('sequences/activities GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
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
    throw new Error(error.message || 'Failed to fetch activities')
  }

  return NextResponse.json(data ?? [])
})
