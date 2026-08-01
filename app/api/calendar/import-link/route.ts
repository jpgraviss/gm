import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseICS, icalDateToUtc } from '@/lib/ical-parser'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser } from '@/lib/rbac'
import { fetchTextSafely } from '@/lib/ssrf-guard'
import { dateAndTimeInZone } from '@/lib/timezone'

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

// AUDIT #604 — matches the sibling calendar/subscriptions route's
// ownership check, missing here entirely: any Team Member could plant an
// ICS subscription attributed to a different colleague via userEmail.
function isOwnerOrAdmin(user: { email: string; isAdmin: boolean; role: string }, targetEmail: string): boolean {
  return user.isAdmin || user.role === 'Leadership' || user.email.toLowerCase() === (targetEmail || '').toLowerCase()
}

export const POST = withErrorHandler('calendar/import-link POST', async (req) => {
  // Matches the sibling calendar/subscriptions route's gate — without it,
  // any authenticated caller (including a portal client) could trigger a
  // server-side fetch of an attacker-supplied URL and insert fabricated
  // "imported" events into bookings.
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { link, userEmail, subscriptionName } = await req.json()
  if (!link || typeof link !== 'string') {
    return NextResponse.json({ error: 'Missing link' }, { status: 400 })
  }
  if (userEmail && !isOwnerOrAdmin(user, userEmail)) {
    return NextResponse.json({ error: 'Cannot import a calendar for another team member' }, { status: 403 })
  }

  const db = createServiceClient()

  if (isIcsUrl(link)) {
    const fetchUrl = normalizeIcsUrl(link.trim())
    let icsText: string
    try {
      icsText = await fetchTextSafely(fetchUrl, 'text/calendar')
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

    // AUDIT #620 — the booking-availability check (calendar/bookings GET)
    // compares imported rows' start_time/end_time against the connected
    // staff Google Calendar's own configured timezone, not the server's —
    // resolve and store in that same zone so the two sides agree.
    const { data: importTzCals } = await db
      .from('calendar_settings')
      .select('timezone')
      .not('google_refresh_token', 'is', null)
      .limit(1)
    const importTz = importTzCals?.[0]?.timezone || 'America/Chicago'

    // AUDIT #481 — this used to increment `imported` unconditionally
    // without checking the upsert's own error (the single-event branch
    // below already did check its insert's error — this loop was the odd
    // one out). Only count a real success; surface a failure count if any
    // occurred, matching the sibling loops in calendar/subscriptions.
    let imported = 0
    let failed = 0
    for (const event of cal.events) {
      if (!event.dtstart) continue
      const startUtc = icalDateToUtc(event.dtstart, event.dtstartTzid)
      const endUtc = event.dtend ? icalDateToUtc(event.dtend, event.dtendTzid) : startUtc
      const start = dateAndTimeInZone(startUtc, importTz)
      const end = dateAndTimeInZone(endUtc, importTz)

      const { error: upsertError } = await db.from('bookings').upsert({
        id: `ics-${subId}-${event.uid}`,
        calendar_slug: 'imported',
        client_name: event.summary,
        client_email: '',
        date: start.date,
        start_time: start.time,
        end_time: end.time === start.time ? dateAndTimeInZone(new Date(startUtc.getTime() + 3600000), importTz).time : end.time,
        timezone: importTz,
        status: 'confirmed',
        notes: event.description || (event.location ? `Location: ${event.location}` : `Imported from ${name}`),
        subscription_id: subId,
      }, { onConflict: 'id' })
      if (upsertError) {
        console.error(`[calendar/import-link] failed to upsert event ${event.uid}:`, upsertError.message)
        failed++
      } else {
        imported++
      }
    }

    return NextResponse.json({
      type: 'subscription',
      subscriptionId: subId,
      name,
      imported,
      total: cal.events.length,
      ...(failed > 0 ? { failed } : {}),
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
