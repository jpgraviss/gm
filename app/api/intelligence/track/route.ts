import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const OPTIONS = withErrorHandler('intelligence/track OPTIONS', async () => {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
})

export const POST = withErrorHandler('intelligence/track POST', async (req) => {
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

  // Upsert visitor record. visit_count must only ever be set to 1 on the
  // visitor's FIRST-ever insert — it was previously included in every
  // upsert call regardless of event type, which reset it back to 1 on
  // nearly every non-page_view event (page_leave, scroll, etc. all fire
  // per page load), corrupting the lead-score formula and "Hot Leads".
  // ignoreDuplicates: true makes this INSERT-only (ON CONFLICT DO NOTHING),
  // so existing visitors' visit_count is never touched here — only the RPC
  // call below (gated on page_view) is allowed to increment it.
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
    ignoreDuplicates: true,
  })

  // Refresh mutable per-visit fields for both new and returning visitors —
  // deliberately excludes visit_count, first_seen, and visit_count-adjacent
  // fields, which the insert-only upsert above already owns.
  const returningUpdates: Record<string, unknown> = {
    last_seen: new Date().toISOString(),
    ip_address: ip,
    user_agent: userAgent,
  }
  if (identifiedEmail) returningUpdates.email = identifiedEmail
  if (formName) returningUpdates.name = formName
  if (formPhone) returningUpdates.phone = formPhone
  if (formCompany) returningUpdates.company = formCompany
  await db.from('gi_visitors').update(returningUpdates).eq('visitor_id', visitorId)

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

  // Recompute lead score (visit frequency + identification + recency +
  // event count) and persist lead_score/is_hot_lead on the visitor row.
  // This function existed since the table migration but was never called
  // anywhere — every visitor's score/hot-lead flag sat permanently at 0/
  // false while the UI rendered a live-looking score bar and 🔥 flame.
  try { await db.rpc('gi_score_visitor', { vid: visitorId }) } catch { /* function may not exist yet */ }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
})
