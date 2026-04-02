import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSequence(row: any) {
  return {
    id:               row.id,
    name:             row.name,
    status:           row.status,
    trigger:          row.trigger,
    targetSegment:    row.target_segment,
    enrolledCount:    row.enrolled_count,
    activeCount:      row.active_count,
    completedCount:   row.completed_count,
    openRate:         row.open_rate,
    clickRate:        row.click_rate,
    replyRate:        row.reply_rate,
    steps:            row.steps ?? [],
    createdDate:      row.created_date ?? '',
    lastModified:     row.last_modified ?? '',
    sendVia:          row.send_via ?? 'gmail',
    fromName:         row.from_name ?? '',
    fromEmail:        row.from_email ?? '',
    assignedRepId:    row.assigned_rep_id ?? null,
    meetingRate:      row.meeting_rate ?? 0,
    bounceRate:       row.bounce_rate ?? 0,
    unsubscribeRate:  row.unsubscribe_rate ?? 0,
    owner:            row.owner ?? '',
    dailySendLimit:   row.daily_send_limit ?? 200,
    perMinuteLimit:   row.per_minute_limit ?? 3,
    sendWindowStart:  row.send_window_start ?? 8,
    sendWindowEnd:    row.send_window_end ?? 18,
    sendOnWeekends:   row.send_on_weekends ?? false,
    timezone:         row.timezone ?? 'America/New_York',
    threadMode:       row.thread_mode ?? true,
    sharing:          row.sharing ?? 'private',
    folder:           row.folder ?? null,
  }
}

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('sequences')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[sequences GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch sequences' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapSequence))
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const result = validate(body, {
    name:          { required: true, type: 'string', maxLength: 200 },
    trigger:       { type: 'string', maxLength: 200 },
    targetSegment: { type: 'string', maxLength: 200 },
  })
  if (!result.valid) return validationError(result.error)

  const today = new Date().toISOString().split('T')[0]
  const db = createServiceClient()
  const { data, error } = await db
    .from('sequences')
    .insert({
      id:              body.id ?? `seq-${Date.now()}`,
      name:            body.name,
      status:          body.status ?? 'Draft',
      trigger:         body.trigger ?? '',
      target_segment:  body.targetSegment ?? '',
      enrolled_count:  body.enrolledCount ?? 0,
      active_count:    body.activeCount ?? 0,
      completed_count: body.completedCount ?? 0,
      open_rate:       body.openRate ?? 0,
      click_rate:      body.clickRate ?? 0,
      reply_rate:      body.replyRate ?? 0,
      steps:           body.steps ?? [],
      created_date:    body.createdDate ?? today,
      last_modified:   body.lastModified ?? today,
    })
    .select()
    .single()
  if (error) {
    console.error('[sequences POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create sequence' }, { status: 500 })
  }
  return NextResponse.json(mapSequence(data), { status: 201 })
}
