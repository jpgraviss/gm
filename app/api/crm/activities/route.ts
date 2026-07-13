import { NextRequest, NextResponse } from 'next/server'
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

export const GET = withErrorHandler('crm/activities GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get('companyId')
  const contactId = searchParams.get('contactId')
  const db = createServiceClient()
  let query = db.from('crm_activities').select('*').order('timestamp', { ascending: false })
  if (companyId) query = query.eq('company_id', companyId)
  if (contactId) query = query.eq('contact_id', contactId)
  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch activities')
  }
  return NextResponse.json((data ?? []).map(mapActivity))
})

export const POST = withErrorHandler('crm/activities POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()

  const result = validate(body, {
    type:     { required: true, type: 'string' },
    title:    { required: true, type: 'string', maxLength: 300 },
    // Raised from 5000 — call transcripts logged as "Call Notes" activities
    // routinely run much longer than a typical activity note.
    body:     { type: 'string', maxLength: 50_000 },
    user:     { required: true, type: 'string' },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('crm_activities')
    .insert({
      id:           `act-${Date.now()}`,
      type:         body.type,
      title:        body.title,
      body:         body.body ?? null,
      company_id:   body.companyId ?? null,
      company_name: body.companyName ?? null,
      contact_id:   body.contactId ?? null,
      contact_name: body.contactName ?? null,
      deal_id:      body.dealId ?? null,
      user_name:    body.user ?? '',
      timestamp:    body.timestamp ?? new Date().toISOString(),
      duration:     body.duration ?? null,
      outcome:      body.outcome ?? null,
      next_step:    body.nextStep ?? null,
      pinned:       body.pinned ?? false,
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create activity')
  }
  return NextResponse.json(mapActivity(data), { status: 201 })
})
