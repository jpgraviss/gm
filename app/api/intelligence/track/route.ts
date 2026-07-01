import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    const text = await req.text()
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? null
  const userAgent = req.headers.get('user-agent') ?? null

  const db = createServiceClient()

  const visitorId = body.visitorId as string
  const sessionId = body.sessionId as string
  const siteId = body.siteId as string

  if (!visitorId || !sessionId) {
    return NextResponse.json({ error: 'Missing visitorId or sessionId' }, { status: 400, headers: CORS_HEADERS })
  }

  // Upsert visitor record
  const identifiedEmail = (body.identifiedEmail as string) || (body.formData as Record<string, string>)?.formEmail || null
  const formName = (body.formData as Record<string, string>)?.formName || null
  const formPhone = (body.formData as Record<string, string>)?.formPhone || null
  const formCompany = (body.formData as Record<string, string>)?.formCompany || null

  await db.from('gi_visitors').upsert({
    visitor_id: visitorId,
    site_id: siteId || 'default',
    email: identifiedEmail,
    name: formName,
    phone: formPhone,
    company: formCompany,
    ip_address: ip,
    user_agent: userAgent,
    language: body.language as string ?? null,
    screen_width: (body.screen as Record<string, number>)?.w ?? null,
    screen_height: (body.screen as Record<string, number>)?.h ?? null,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    visit_count: 1,
    utm_source: (body.utm as Record<string, string>)?.utm_source ?? null,
    utm_medium: (body.utm as Record<string, string>)?.utm_medium ?? null,
    utm_campaign: (body.utm as Record<string, string>)?.utm_campaign ?? null,
  }, {
    onConflict: 'visitor_id',
    ignoreDuplicates: false,
  })

  // Update visitor with identified info if available
  if (identifiedEmail || formName || formPhone || formCompany) {
    const updates: Record<string, unknown> = { last_seen: new Date().toISOString() }
    if (identifiedEmail) updates.email = identifiedEmail
    if (formName) updates.name = formName
    if (formPhone) updates.phone = formPhone
    if (formCompany) updates.company = formCompany
    await db.from('gi_visitors').update(updates).eq('visitor_id', visitorId)
  }

  // Increment visit count on page_view
  if (body.eventType === 'page_view') {
    try { await db.rpc('gi_increment_visits', { vid: visitorId }) } catch { /* function may not exist yet */ }
  }

  // Store event
  await db.from('gi_events').insert({
    visitor_id: visitorId,
    session_id: sessionId,
    site_id: siteId || 'default',
    event_type: body.eventType as string,
    url: body.url as string,
    path: body.path as string,
    title: body.title as string ?? null,
    referrer: body.referrer as string ?? null,
    time_on_page: (body.timeOnPage as number) ?? null,
    scroll_depth: (body.scrollDepth as number) ?? null,
    target_url: (body.targetUrl as string) ?? null,
    form_action: (body.formAction as string) ?? null,
    custom_event: (body.customEvent as string) ?? null,
    custom_properties: body.customProperties ? JSON.stringify(body.customProperties) : null,
    ip_address: ip,
    timestamp: body.timestamp as string ?? new Date().toISOString(),
  })

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
}
