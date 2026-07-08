import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseICS } from '@/lib/ical-parser'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('calendar/subscriptions GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const userEmail = searchParams.get('email')
  const db = createServiceClient()

  let query = db
    .from('calendar_subscriptions')
    .select('*')
    .order('created_at', { ascending: false })

  if (userEmail) query = query.eq('user_email', userEmail)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return NextResponse.json(data ?? [])
})

export const POST = withErrorHandler('calendar/subscriptions POST', async (req) => {
  const { url, name, userEmail, action } = await req.json()

  if (action === 'sync-all') {
    return syncAllSubscriptions(userEmail)
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing URL' }, { status: 400 })
  }

  const fetchUrl = url.trim().replace(/^webcal:\/\//, 'https://')
  let icsText: string
  try {
    const res = await fetch(fetchUrl, { headers: { Accept: 'text/calendar' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    icsText = await res.text()
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch ICS: ${err instanceof Error ? err.message : 'unknown'}` }, { status: 400 })
  }

  const cal = parseICS(icsText)
  const subName = name?.trim() || cal.name || 'Imported Calendar'
  const db = createServiceClient()

  const subId = `sub-${Date.now()}`
  const { error: insertError } = await db.from('calendar_subscriptions').insert({
    id: subId,
    user_email: userEmail || '',
    name: subName,
    ical_url: fetchUrl,
    last_synced_at: new Date().toISOString(),
    event_count: cal.events.length,
  })

  if (insertError) throw new Error(insertError.message)

  let imported = 0
  for (const event of cal.events) {
    if (!event.dtstart) continue
    const startDate = new Date(event.dtstart)
    const endDate = event.dtend ? new Date(event.dtend) : startDate
    const date = startDate.toISOString().split('T')[0]
    const startHHMM = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
    let endHHMM = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
    if (endHHMM === startHHMM) {
      const e = new Date(startDate.getTime() + 3600000)
      endHHMM = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`
    }

    await db.from('bookings').upsert({
      id: `ics-${subId}-${event.uid}`,
      calendar_slug: 'imported',
      client_name: event.summary,
      client_email: '',
      date,
      start_time: startHHMM,
      end_time: endHHMM,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      status: 'confirmed',
      notes: event.description || (event.location ? `Location: ${event.location}` : `Imported from ${subName}`),
      subscription_id: subId,
    }, { onConflict: 'id' })
    imported++
  }

  return NextResponse.json({
    id: subId,
    name: subName,
    imported,
    total: cal.events.length,
  }, { status: 201 })
})

export const DELETE = withErrorHandler('calendar/subscriptions DELETE', async (req) => {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = createServiceClient()

  await db.from('bookings').delete().eq('subscription_id', id)
  const { error } = await db.from('calendar_subscriptions').delete().eq('id', id)
  if (error) throw new Error(error.message)

  return NextResponse.json({ deleted: true })
})

async function syncSubscription(db: ReturnType<typeof createServiceClient>, sub: { id: string; ical_url: string; name: string }) {
  const res = await fetch(sub.ical_url, { headers: { Accept: 'text/calendar' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const icsText = await res.text()
  const cal = parseICS(icsText)

  const { data: existing } = await db
    .from('bookings')
    .select('id')
    .eq('subscription_id', sub.id)

  const existingIds = new Set((existing ?? []).map(b => b.id))
  const newIds = new Set<string>()

  let imported = 0
  for (const event of cal.events) {
    if (!event.dtstart) continue
    const bookingId = `ics-${sub.id}-${event.uid}`
    newIds.add(bookingId)

    const startDate = new Date(event.dtstart)
    const endDate = event.dtend ? new Date(event.dtend) : startDate
    const date = startDate.toISOString().split('T')[0]
    const startHHMM = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
    let endHHMM = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
    if (endHHMM === startHHMM) {
      const e = new Date(startDate.getTime() + 3600000)
      endHHMM = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`
    }

    await db.from('bookings').upsert({
      id: bookingId,
      calendar_slug: 'imported',
      client_name: event.summary,
      client_email: '',
      date,
      start_time: startHHMM,
      end_time: endHHMM,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      status: 'confirmed',
      notes: event.description || (event.location ? `Location: ${event.location}` : `Imported from ${sub.name}`),
      subscription_id: sub.id,
    }, { onConflict: 'id' })
    imported++
  }

  const toDelete = [...existingIds].filter(id => !newIds.has(id))
  if (toDelete.length > 0) {
    await db.from('bookings').delete().in('id', toDelete)
  }

  await db.from('calendar_subscriptions').update({
    last_synced_at: new Date().toISOString(),
    event_count: cal.events.length,
  }).eq('id', sub.id)

  return imported
}

async function syncAllSubscriptions(userEmail?: string) {
  const db = createServiceClient()
  let query = db.from('calendar_subscriptions').select('*')
  if (userEmail) query = query.eq('user_email', userEmail)
  const { data: subs } = await query

  if (!subs?.length) {
    return NextResponse.json({ message: 'No subscriptions to sync', synced: 0 })
  }

  let totalSynced = 0
  let errors = 0
  for (const sub of subs) {
    try {
      totalSynced += await syncSubscription(db, sub)
    } catch {
      errors++
    }
  }

  return NextResponse.json({ synced: totalSynced, errors, subscriptions: subs.length })
}

export const PATCH = withErrorHandler('calendar/subscriptions PATCH', async (req) => {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = createServiceClient()
  const { data: sub } = await db.from('calendar_subscriptions').select('*').eq('id', id).single()
  if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

  try {
    const imported = await syncSubscription(db, sub)
    return NextResponse.json({ synced: imported })
  } catch (err) {
    throw new Error(`Sync failed: ${err instanceof Error ? err.message : 'unknown'}`)
  }
})
