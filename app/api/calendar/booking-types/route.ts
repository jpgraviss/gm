import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('booking_types')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[booking-types GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, description, duration_minutes, location, color, availability, buffer_minutes, active, id } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const db = createServiceClient()

  if (id) {
    const { data, error } = await db
      .from('booking_types')
      .update({
        name: name.trim(),
        slug: slugify(name.trim()),
        description: description?.trim() || null,
        duration_minutes: duration_minutes ?? 30,
        location: location ?? 'zoom',
        color: color ?? '#015035',
        availability: availability ?? { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
        buffer_minutes: buffer_minutes ?? 15,
        active: active ?? true,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[booking-types POST update]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  let slug = slugify(name.trim())
  const { data: existing } = await db
    .from('booking_types')
    .select('slug')
    .eq('slug', slug)

  if (existing && existing.length > 0) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const { data, error } = await db
    .from('booking_types')
    .insert({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      duration_minutes: duration_minutes ?? 30,
      location: location ?? 'zoom',
      color: color ?? '#015035',
      availability: availability ?? { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
      buffer_minutes: buffer_minutes ?? 15,
      active: active ?? true,
    })
    .select()
    .single()

  if (error) {
    console.error('[booking-types POST create]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
