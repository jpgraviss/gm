import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseICS } from '@/lib/ical-parser'
import { withErrorHandler } from '@/lib/api-handler'

function isIcsUrl(link: string): boolean {
  return (
    link.includes('/calendar/ical/') ||
    link.endsWith('.ics') ||
    link.includes('.ics?') ||
    link.includes('webcal://') ||
    link.includes('/basic.ics')
  )
}

function normalizeIcsUrl(url: string): string {
  return url.replace(/^webcal:\/\//, 'https://')
}

export const POST = withErrorHandler('calendar/import-link POST', async (req) => {
  const { link, userEmail, subscriptionName } = await req.json()
  if (!link || typeof link !== 'string') {
    return NextResponse.json({ error: 'Missing link' }, { status: 400 })
  }

  const db = createServiceClient()

  if (isIcsUrl(link)) {
    const fetchUrl = normalizeIcsUrl(link.trim())
    let icsText: string
    try {
      const res = await fetch(fetchUrl, { headers: { Accept: 'text/calendar' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      icsText = await res.text()
    } catch (err) {
      return NextResponse.json({ error: `Failed to fetch ICS URL: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 400 })
    }

    const cal = parseICS(icsText)
    const name = subscriptionName?.trim() || cal.name || 'Imported Calendar'
    const email = userEmail || ''

    const subId = `sub-${Date.now()}`
    await db.from('calendar_subscriptions').insert({
      id: subId,
      user_email: email,
      name,
      ical_url: fetchUrl,
      last_synced_at: new Date().toISOString(),
      event_count: cal.events.length,
    })

    let imported = 0
    for (const event of cal.events) {
      if (!event.dtstart) continue
      const startDate = new Date(event.dtstart)
      const endDate = event.dtend ? new Date(event.dtend) : startDate
      const date = startDate.toISOString().split('T')[0]
      const startHHMM = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
      const endHHMM = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

      await db.from('bookings').upsert({
        id: `ics-${subId}-${event.uid}`,
        calendar_slug: 'imported',
        client_name: event.summary,
        client_email: '',
        date,
        start_time: startHHMM,
        end_time: endHHMM === startHHMM ? (() => { const e = new Date(startDate.getTime() + 3600000); return `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}` })() : endHHMM,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        status: 'confirmed',
        notes: event.description || (event.location ? `Location: ${event.location}` : `Imported from ${name}`),
        subscription_id: subId,
      }, { onConflict: 'id' })
      imported++
    }

    return NextResponse.json({
      type: 'subscription',
      subscriptionId: subId,
      name,
      imported,
      total: cal.events.length,
    })
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
    throw new Error(error.message)
  }

  return NextResponse.json({ type: 'single', ...data })
})
