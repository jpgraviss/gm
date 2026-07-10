import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

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

export const PATCH = withErrorHandler('sequences/[id] PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const body = await req.json()

  const result = validate(body, {
    name:          { type: 'string', maxLength: 200 },
    trigger:       { type: 'string', maxLength: 200 },
    targetSegment: { type: 'string', maxLength: 200 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const update: Record<string, unknown> = {
    last_modified: new Date().toISOString().split('T')[0],
  }
  if (body.name           !== undefined) update.name            = body.name
  if (body.status         !== undefined) update.status          = body.status
  if (body.trigger        !== undefined) update.trigger         = body.trigger
  if (body.targetSegment  !== undefined) update.target_segment  = body.targetSegment
  if (body.enrolledCount  !== undefined) update.enrolled_count  = body.enrolledCount
  if (body.activeCount    !== undefined) update.active_count    = body.activeCount
  if (body.completedCount !== undefined) update.completed_count = body.completedCount
  if (body.openRate       !== undefined) update.open_rate       = body.openRate
  if (body.clickRate      !== undefined) update.click_rate      = body.clickRate
  if (body.replyRate      !== undefined) update.reply_rate      = body.replyRate
  if (body.steps            !== undefined) update.steps             = body.steps
  if (body.sendVia          !== undefined) update.send_via           = body.sendVia
  if (body.fromName         !== undefined) update.from_name          = body.fromName
  if (body.fromEmail        !== undefined) update.from_email         = body.fromEmail
  if (body.assignedRepId    !== undefined) update.assigned_rep_id    = body.assignedRepId
  if (body.meetingRate      !== undefined) update.meeting_rate       = body.meetingRate
  if (body.bounceRate       !== undefined) update.bounce_rate        = body.bounceRate
  if (body.unsubscribeRate  !== undefined) update.unsubscribe_rate   = body.unsubscribeRate
  if (body.owner            !== undefined) update.owner              = body.owner
  if (body.dailySendLimit   !== undefined) update.daily_send_limit   = body.dailySendLimit
  if (body.perMinuteLimit   !== undefined) update.per_minute_limit   = body.perMinuteLimit
  if (body.sendWindowStart  !== undefined) update.send_window_start  = body.sendWindowStart
  if (body.sendWindowEnd    !== undefined) update.send_window_end    = body.sendWindowEnd
  if (body.sendOnWeekends   !== undefined) update.send_on_weekends   = body.sendOnWeekends
  if (body.timezone         !== undefined) update.timezone            = body.timezone
  if (body.threadMode       !== undefined) update.thread_mode        = body.threadMode
  if (body.sharing          !== undefined) update.sharing             = body.sharing
  if (body.folder           !== undefined) update.folder              = body.folder
  const { data, error } = await db.from('sequences').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update sequence')
  }
  return NextResponse.json(mapSequence(data))
})

export const DELETE = withErrorHandler('sequences/[id] DELETE', async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('sequences').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete sequence')
  }
  return NextResponse.json({ deleted: id })
})
