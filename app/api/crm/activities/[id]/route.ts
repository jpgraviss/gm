import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivity(row: any) {
  return {
    id:          row.id,
    type:        row.type,
    title:       row.title,
    body:        row.body ?? undefined,
    companyId:   row.company_id ?? undefined,
    companyName: row.company_name ?? undefined,
    contactId:   row.contact_id ?? undefined,
    contactName: row.contact_name ?? undefined,
    dealId:      row.deal_id ?? undefined,
    user:        row.user_name,
    timestamp:   row.timestamp,
    duration:    row.duration ?? undefined,
    outcome:     row.outcome ?? undefined,
    nextStep:    row.next_step ?? undefined,
    pinned:      row.pinned ?? false,
  }
}

// Lets a logged activity (e.g. a "Call Notes" entry with a pasted
// transcript) be corrected after the fact — previously there was no way
// to fix a typo or add detail to a note once saved.
export const PATCH = withErrorHandler('crm/activities/[id] PATCH', async (req, ctx) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await ctx!.params
  const body = await req.json()

  const result = validate(body, {
    title: { type: 'string', maxLength: 300 },
    body:  { type: 'string', maxLength: 50_000 },
  })
  if (!result.valid) return validationError(result.error)

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title
  if (body.body !== undefined) update.body = body.body

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db.from('crm_activities').update(update).eq('id', id).select().single()
  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }
    throw new Error(error?.message || 'Failed to update activity')
  }

  return NextResponse.json(mapActivity(data))
})
