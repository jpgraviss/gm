import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

// GET /api/calendar/settings/[slug] — public, returns only non-sensitive fields
export const GET = withErrorHandler('calendar/settings/[slug] GET', async (_req, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('calendar_settings')
    .select('slug, user_name, title, description, duration, timezone, available_days, available_start, available_end, active')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (error?.code === 'PGRST116') {
    return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  }
  if (error) {
    throw new Error(error?.message || 'Failed to fetch calendar settings')
  }
  return NextResponse.json(data)
})
