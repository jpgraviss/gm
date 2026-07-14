import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('sequences/[id]/enroll POST', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const { contacts } = await req.json() as { contacts: { id?: string; name: string; email: string }[] }

  if (!contacts?.length) {
    return NextResponse.json({ error: 'contacts array required' }, { status: 400 })
  }

  for (const contact of contacts) {
    const result = validate(
      { contactEmail: contact.email, contactName: contact.name } as Record<string, unknown>,
      {
        contactEmail: { required: true, type: 'string', pattern: EMAIL_PATTERN },
        contactName:  { required: true, type: 'string' },
      }
    )
    if (!result.valid) return validationError(result.error)
  }

  const db = createServiceClient()

  // Fetch the sequence to get steps and counts
  const { data: seq, error: seqErr } = await db
    .from('sequences')
    .select('steps')
    .eq('id', id)
    .single()
  if (seqErr || !seq) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })

  const steps: Array<{ day?: number }> = seq.steps ?? []
  const firstDays: number = steps[0]?.day ?? 0

  // Check for already-enrolled contacts to avoid duplicates
  const emails = contacts.filter(c => c.email).map(c => c.email)
  const { data: existing } = await db
    .from('sequence_enrollments')
    .select('contact_email')
    .eq('sequence_id', id)
    .in('contact_email', emails)
  const alreadyEnrolled = new Set((existing ?? []).map((r: { contact_email: string }) => r.contact_email))

  // Check suppression list (emails stored lowercase)
  const normalizedEmails = emails.map(e => e.toLowerCase())
  const { data: suppressed } = await db
    .from('sequence_suppression_list')
    .select('email')
    .in('email', normalizedEmails)
  const suppressedEmails = new Set((suppressed ?? []).map((r: { email: string }) => r.email))

  // Check one-at-a-time: skip contacts already active in another sequence
  const { data: activeElsewhere } = await db
    .from('sequence_enrollments')
    .select('contact_email')
    .neq('sequence_id', id)
    .eq('status', 'active')
    .in('contact_email', emails)
  const activeElsewhereEmails = new Set((activeElsewhere ?? []).map((r: { contact_email: string }) => r.contact_email))

  const toEnroll = contacts.filter(c => c.email && !alreadyEnrolled.has(c.email) && !suppressedEmails.has(c.email.toLowerCase()) && !activeElsewhereEmails.has(c.email))
  if (!toEnroll.length) return NextResponse.json({ enrolled: 0 })

  const now = new Date()
  const nextSendAt = new Date(now.getTime() + firstDays * 24 * 60 * 60 * 1000)

  // Inserted one at a time (not a single batch insert) so a unique-
  // constraint conflict on one contact doesn't fail the whole batch, and
  // so we can tell exactly how many actually got enrolled. The DB-level
  // partial unique index on (contact_email) where status='active' is the
  // real "one sequence at a time" guarantee — the checks above are a
  // fast pre-filter, not the source of truth, since another request could
  // enroll the same contact between our check and this insert.
  let enrolledCount = 0
  for (const c of toEnroll) {
    const { error: insertErr } = await db.from('sequence_enrollments').insert({
      id: `enr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sequence_id: id,
      contact_id: c.id ?? null,
      contact_name: c.name,
      contact_email: c.email,
      current_step: 0,
      status: 'active',
      next_send_at: nextSendAt.toISOString(),
      enrolled_at: now.toISOString(),
      delivery_status: 'pending',
      message_ids: [],
    })
    if (insertErr) {
      if (insertErr.code === '23505') continue // already has an active enrollment elsewhere — race with another request
      throw new Error(insertErr.message || 'Failed to enroll contacts')
    }
    enrolledCount++
    if (c.id) {
      await db.from('crm_contacts').update({
        in_sequence: true,
        current_sequence_id: id,
      }).eq('id', c.id)
    }
  }

  if (enrolledCount > 0) {
    await db.rpc('adjust_sequence_counts', {
      p_sequence_id: id,
      p_enrolled_delta: enrolledCount,
      p_active_delta: enrolledCount,
      p_last_modified: now.toISOString().split('T')[0],
    })
  }

  return NextResponse.json({ enrolled: enrolledCount })
})
