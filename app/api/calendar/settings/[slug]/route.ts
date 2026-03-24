import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/calendar/settings/[slug] — public, returns only non-sensitive fields
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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
    console.error('[calendar/settings/:slug GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch calendar settings' }, { status: 500 })
  }
  return NextResponse.json(data)
}
