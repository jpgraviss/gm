import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBroadcast(row: any) {
  return {
    id:              row.id,
    name:            row.name,
    subject:         row.subject,
    fromName:        row.from_name,
    fromEmail:       row.from_email,
    replyTo:         row.reply_to ?? undefined,
    htmlBody:        row.html_body ?? '',
    plainBody:       row.plain_body ?? undefined,
    previewText:     row.preview_text ?? undefined,
    audienceFilter:  row.audience_filter ?? {},
    audienceCount:   row.audience_count ?? 0,
    status:          row.status,
    scheduledAt:     row.scheduled_at ?? undefined,
    sentAt:          row.sent_at ?? undefined,
    resendId:        row.resend_id ?? undefined,
    totalSent:       row.total_sent ?? 0,
    totalDelivered:  row.total_delivered ?? 0,
    totalOpened:     row.total_opened ?? 0,
    totalClicked:    row.total_clicked ?? 0,
    totalBounced:    row.total_bounced ?? 0,
    totalUnsubscribed: row.total_unsubscribed ?? 0,
    createdBy:       row.created_by ?? undefined,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const { limit, cursor } = parsePagination(req)
  const db = createServiceClient()

  let query = db
    .from('broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) {
    console.error('[broadcasts GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], limit, 'created_at')
  return paginatedJson(rows.map(mapBroadcast), nextCursor)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name || !body.subject) {
    return NextResponse.json({ error: 'name and subject are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('broadcasts')
    .insert({
      id:              `bc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name:            body.name,
      subject:         body.subject,
      from_name:       body.fromName ?? 'Graviss Marketing',
      from_email:      body.fromEmail ?? 'noreply@app.gravissmarketing.com',
      reply_to:        body.replyTo ?? null,
      html_body:       body.htmlBody ?? '',
      plain_body:      body.plainBody ?? null,
      preview_text:    body.previewText ?? null,
      audience_filter: body.audienceFilter ?? {},
      status:          'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('[broadcasts POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logAudit({ userName: 'system', action: 'created_broadcast', module: 'email_marketing', type: 'action', metadata: { broadcastId: data.id } })
  return NextResponse.json(mapBroadcast(data), { status: 201 })
}
