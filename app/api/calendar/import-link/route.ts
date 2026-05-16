import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { link } = await req.json()
  if (!link || typeof link !== 'string') {
    return NextResponse.json({ error: 'Missing link' }, { status: 400 })
  }

  let title = 'Google Calendar Event'
  let date = new Date().toISOString().slice(0, 10)
  let startTime = '09:00'
  let endTime = '10:00'
  let description = ''

  try {
    const eidMatch = link.match(/eid=([A-Za-z0-9_-]+)/)
    if (eidMatch) {
      const decoded = Buffer.from(eidMatch[1], 'base64').toString('utf-8')
      const parts = decoded.split(' ')
      if (parts.length >= 1) title = parts[0] || title
    }

    const dateMatch = link.match(/dates=(\d{8}T\d{6})(?:Z)?\/(\d{8}T\d{6})/)
    if (dateMatch) {
      const start = dateMatch[1]
      const end = dateMatch[2]
      date = `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`
      startTime = `${start.slice(9, 11)}:${start.slice(11, 13)}`
      endTime = `${end.slice(9, 11)}:${end.slice(11, 13)}`
    }

    const textMatch = link.match(/text=([^&]+)/)
    if (textMatch) title = decodeURIComponent(textMatch[1])

    const detailsMatch = link.match(/details=([^&]+)/)
    if (detailsMatch) description = decodeURIComponent(detailsMatch[1])
  } catch {
    // best-effort parsing
  }

  const db = createServiceClient()
  const id = `gcal-import-${Date.now()}`

  const { data, error } = await db.from('bookings').insert({
    id,
    calendar_slug: 'imported',
    client_name: title,
    client_email: '',
    date,
    start_time: startTime,
    end_time: endTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    status: 'confirmed',
    notes: description || `Imported from Google Calendar link`,
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
