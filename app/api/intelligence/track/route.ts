import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { isGeolocationConfigured, lookupIpGeolocation } from '@/lib/geolocation'
import { getClientIp } from '@/lib/request-ip'

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

  // AUDIT #653 — this used to reimplement request-ip.ts's IP extraction
  // inline, taking the client-spoofable leftmost x-forwarded-for entry;
  // now shares the same helper (Vercel-set headers preferred, last hop of
  // x-forwarded-for as the fallback) as proxy.ts/lib/rbac.ts.
  const resolvedIp = getClientIp(req)
  const ip = resolvedIp === 'unknown' ? null : resolvedIp
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

  // AUDIT.md #455 — GravIntel.identify(email, meta)'s `meta` param is
  // documented (app/intelligence/page.tsx's "Setup & Embed" section, e.g.
  // `GravIntel.identify('user@email.com', { name: 'Jane Doe' })`) and sent
  // by public/gi.js as `identifyMeta`, but nothing here ever read it — the
  // email landed on the visitor row while the name (or any other meta
  // field) was silently dropped with no error, for a call this app's own
  // docs tell developers to make. gi_visitors already has name/phone/
  // company/title columns (used by the form_submit path below), so no
  // migration is needed — identifyMeta just needed to feed the same
  // columns, falling back to form-submission data when both are present.
  const identifyMeta = (body.identifyMeta ?? null) as Record<string, unknown> | null
  const identifyMetaName = typeof identifyMeta?.name === 'string' ? identifyMeta.name : null
  const identifyMetaPhone = typeof identifyMeta?.phone === 'string' ? identifyMeta.phone : null
  const identifyMetaCompany = typeof identifyMeta?.company === 'string' ? identifyMeta.company : null
  const identifyMetaTitle = typeof identifyMeta?.title === 'string' ? identifyMeta.title : null

  const formName = (body.formData as Record<string, string>)?.formName || identifyMetaName || null
  const formPhone = (body.formData as Record<string, string>)?.formPhone || identifyMetaPhone || null
  const formCompany = (body.formData as Record<string, string>)?.formCompany || identifyMetaCompany || null
  const formTitle = identifyMetaTitle || null

  // AUDIT.md #453 — .select() here lets us tell an actual first-ever INSERT
  // apart from a no-op conflict: with ignoreDuplicates, Postgrest only
  // returns a row for visitors it just inserted, never for ones it skipped.
  // That distinction is what lets the gi_increment_visits RPC below apply
  // only to returning visitors — the insert above already seeds visit_count
  // at 1, so incrementing again on the same request double-counted every
  // visitor's first page_view forever (1 -> 2), inflating lead_score by 5
  // points (gi_score_visitor's visit_count * 5 term) from the very first hit.
  const { data: insertedRows } = await db.from('gi_visitors').upsert({
    visitor_id: visitorId,
    site_id: siteId || 'default',
    email: identifiedEmail,
    name: formName,
    phone: formPhone,
    company: formCompany,
    title: formTitle,
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
  }).select('visitor_id')
  const isNewVisitor = (insertedRows?.length ?? 0) > 0

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
  if (formTitle) returningUpdates.title = formTitle
  await db.from('gi_visitors').update(returningUpdates).eq('visitor_id', visitorId)

  // Increment visit count on page_view — but only for a visitor the insert
  // above did NOT just create, since that insert already seeds visit_count
  // at 1. Incrementing unconditionally here bumped every brand-new visitor
  // straight to 2 on their very first page_view (AUDIT.md #453).
  if (body.eventType === 'page_view') {
    if (!isNewVisitor) {
      try { await db.rpc('gi_increment_visits', { vid: visitorId }) } catch { /* function may not exist yet */ }
    }

    // Geolocation — no-op until IPINFO_API_KEY is set (see lib/geolocation.ts;
    // AUDIT.md #33). Looked up once per visitor (skipped once city is already
    // known) to stay bounded, rather than on every page_view forever.
    if (isGeolocationConfigured() && ip) {
      const { data: visitorRow } = await db.from('gi_visitors').select('city').eq('visitor_id', visitorId).maybeSingle()
      if (!visitorRow?.city) {
        const geo = await lookupIpGeolocation(ip)
        if (geo) {
          await db.from('gi_visitors').update({
            city: geo.city,
            region: geo.region,
            country: geo.country,
            isp: geo.isp,
            rdns_company: geo.rdnsCompany,
          }).eq('visitor_id', visitorId)
        }
      }
    }
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
