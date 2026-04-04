import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import * as crypto from 'crypto'

// Resend webhook event types we handle
type ResendEventType =
  | 'email.delivered'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'email.complained'

interface ResendWebhookPayload {
  type: ResendEventType
  data: {
    email_id: string
    to: string[]
    headers?: { name: string; value: string }[]
  }
}

function extractHeader(headers: { name: string; value: string }[] | undefined, name: string): string | null {
  if (!headers) return null
  const h = headers.find((h) => h.name === name)
  return h?.value ?? null
}

function verifySignature(body: string, req: NextRequest, secret: string): boolean {
  // Resend uses Svix for webhooks — check svix headers first
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (svixId && svixTimestamp && svixSignature) {
    // Svix signature format: v1,<base64-signature>
    // Signed content: "{svix-id}.{svix-timestamp}.{body}"
    const signedContent = `${svixId}.${svixTimestamp}.${body}`
    const secretBytes = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64')

    // svix-signature can contain multiple signatures separated by spaces
    const signatures = svixSignature.split(' ')
    for (const sig of signatures) {
      const sigValue = sig.startsWith('v1,') ? sig.slice(3) : sig
      try {
        if (crypto.timingSafeEqual(Buffer.from(sigValue), Buffer.from(expectedSignature))) {
          return true
        }
      } catch {
        // Length mismatch — continue
      }
    }
    return false
  }

  // Fallback: simple HMAC for resend-signature header
  const resendSig = req.headers.get('resend-signature')
  if (resendSig) {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(resendSig), Buffer.from(expected))
    } catch {
      return false
    }
  }

  return false
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Optional signature verification
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (webhookSecret) {
    if (!verifySignature(rawBody, req, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: ResendWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, data } = payload
  if (!type || !data) {
    return NextResponse.json({ error: 'Missing type or data' }, { status: 400 })
  }

  const db = createServiceClient()

  // Extract sequence/enrollment IDs from custom headers
  const sequenceId = extractHeader(data.headers, 'X-Sequence-Id')
  const enrollmentId = extractHeader(data.headers, 'X-Enrollment-Id')
  const contactEmail = data.to?.[0]

  // Look up enrollment by headers or by email match
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let enrollment: Record<string, any> | null = null

  if (enrollmentId) {
    const { data: row } = await db
      .from('sequence_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .single()
    enrollment = row
  }

  if (!enrollment && sequenceId && contactEmail) {
    const { data: row } = await db
      .from('sequence_enrollments')
      .select('*')
      .eq('sequence_id', sequenceId)
      .eq('contact_email', contactEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    enrollment = row
  }

  if (!enrollment && contactEmail) {
    const { data: row } = await db
      .from('sequence_enrollments')
      .select('*')
      .eq('contact_email', contactEmail)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    enrollment = row
  }

  if (!enrollment) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'No matching enrollment found' })
  }

  const eventMap: Record<string, string> = {
    'email.delivered': 'delivered',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
  }
  const eventType = eventMap[type]
  if (!eventType) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Unhandled event type' })
  }

  const seqId = enrollment.sequence_id as string

  // Insert activity record with step_index from enrollment
  await db.from('sequence_activities').insert({
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sequence_id: seqId,
    enrollment_id: enrollment.id,
    contact_email: contactEmail,
    step_index: enrollment.current_step ?? 0,
    event_type: eventType,
    metadata: { email_id: data.email_id, resend_event: type },
    created_at: new Date().toISOString(),
  })

  // Handle bounces
  if (type === 'email.bounced') {
    // Add to global suppression list (email unique)
    await db.from('sequence_suppression_list').upsert(
      {
        id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        email: contactEmail?.toLowerCase(),
        reason: 'bounced',
        source: seqId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    )

    await db
      .from('sequence_enrollments')
      .update({ status: 'bounced', unenroll_reason: 'bounced' })
      .eq('id', enrollment.id)

    // Decrement active count
    const { data: seq } = await db
      .from('sequences')
      .select('active_count, name')
      .eq('id', seqId)
      .single()
    if (seq) {
      await db
        .from('sequences')
        .update({ active_count: Math.max(0, (seq.active_count ?? 1) - 1) })
        .eq('id', seqId)
    }

    // Reset contact in_sequence flag
    if (enrollment.contact_id) {
      await db.from('crm_contacts').update({
        in_sequence: false,
        current_sequence_id: null,
        last_sequence_id: seqId,
        last_sequence_date: new Date().toISOString(),
      }).eq('id', enrollment.contact_id)
    }

    // Fire automation event
    fireAutomations('sequence_bounce', {
      sequenceId: seqId,
      sequenceName: seq?.name ?? '',
      contactEmail,
      contactName: enrollment.contact_name,
      contactId: enrollment.contact_id,
      company: enrollment.company,
    })
  }

  // Handle complaints
  if (type === 'email.complained') {
    await db.from('sequence_suppression_list').upsert(
      {
        id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        email: contactEmail?.toLowerCase(),
        reason: 'complained',
        source: seqId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    )

    await db
      .from('sequence_enrollments')
      .update({ status: 'unenrolled', unenroll_reason: 'complained' })
      .eq('id', enrollment.id)

    const { data: seq } = await db
      .from('sequences')
      .select('active_count')
      .eq('id', seqId)
      .single()
    if (seq) {
      await db
        .from('sequences')
        .update({ active_count: Math.max(0, (seq.active_count ?? 1) - 1) })
        .eq('id', seqId)
    }

    // Reset contact in_sequence flag
    if (enrollment.contact_id) {
      await db.from('crm_contacts').update({
        in_sequence: false,
        current_sequence_id: null,
        last_sequence_id: seqId,
        last_sequence_date: new Date().toISOString(),
      }).eq('id', enrollment.contact_id)
    }
  }

  // Handle opens — calculate from activities count (accurate)
  if (type === 'email.opened') {
    await recalculateRate(db, seqId, 'open_rate', 'opened')
  }

  // Handle clicks — calculate from activities count (accurate)
  if (type === 'email.clicked') {
    await recalculateRate(db, seqId, 'click_rate', 'clicked')
  }

  return NextResponse.json({ ok: true, event: eventType, enrollment_id: enrollment.id })
}

// Recalculate rates from actual activity counts instead of naive incrementing
async function recalculateRate(
  db: ReturnType<typeof createServiceClient>,
  seqId: string,
  rateField: 'open_rate' | 'click_rate',
  eventType: string,
) {
  // Count unique contacts who had this event
  const { data: uniqueEvents } = await db
    .from('sequence_activities')
    .select('contact_email')
    .eq('sequence_id', seqId)
    .eq('event_type', eventType)

  const uniqueContacts = new Set((uniqueEvents ?? []).map(e => e.contact_email)).size

  // Get total sent
  const { count: totalSent } = await db
    .from('sequence_activities')
    .select('*', { count: 'exact', head: true })
    .eq('sequence_id', seqId)
    .eq('event_type', 'sent')

  const sent = totalSent ?? 0
  const rate = sent > 0 ? Math.round((uniqueContacts / sent) * 10000) / 100 : 0

  await db
    .from('sequences')
    .update({ [rateField]: Math.min(100, rate) })
    .eq('id', seqId)
}
