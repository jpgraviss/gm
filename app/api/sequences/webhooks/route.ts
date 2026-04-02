import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
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

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Optional signature verification
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  if (webhookSecret) {
    const signature = req.headers.get('svix-signature') ?? req.headers.get('resend-signature')
    if (!verifySignature(rawBody, signature, webhookSecret)) {
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
  let enrollment: Record<string, unknown> | null = null

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

  // Insert activity record
  await db.from('sequence_activities').insert({
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sequence_id: enrollment.sequence_id,
    enrollment_id: enrollment.id,
    contact_email: contactEmail,
    event_type: eventType,
    metadata: { email_id: data.email_id, resend_event: type },
    created_at: new Date().toISOString(),
  })

  const seqId = enrollment.sequence_id as string

  // Handle bounces
  if (type === 'email.bounced') {
    await db.from('sequence_suppression_list').upsert(
      {
        email: contactEmail,
        reason: 'bounced',
        sequence_id: seqId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'email,sequence_id' },
    )

    await db
      .from('sequence_enrollments')
      .update({ status: 'bounced', unenroll_reason: 'bounced' })
      .eq('id', enrollment.id)

    // Decrement active count
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
  }

  // Handle complaints
  if (type === 'email.complained') {
    await db.from('sequence_suppression_list').upsert(
      {
        email: contactEmail,
        reason: 'complained',
        sequence_id: seqId,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'email,sequence_id' },
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
  }

  // Handle opens — increment open_rate
  if (type === 'email.opened') {
    const { data: seq } = await db
      .from('sequences')
      .select('open_rate, enrolled_count')
      .eq('id', seqId)
      .single()
    if (seq && seq.enrolled_count > 0) {
      // Simple increment: each open adds 1/enrolled_count to the rate
      const increment = 1 / seq.enrolled_count
      await db
        .from('sequences')
        .update({ open_rate: Math.min(100, (seq.open_rate ?? 0) + increment * 100) })
        .eq('id', seqId)
    }
  }

  // Handle clicks — increment click_rate
  if (type === 'email.clicked') {
    const { data: seq } = await db
      .from('sequences')
      .select('click_rate, enrolled_count')
      .eq('id', seqId)
      .single()
    if (seq && seq.enrolled_count > 0) {
      const increment = 1 / seq.enrolled_count
      await db
        .from('sequences')
        .update({ click_rate: Math.min(100, (seq.click_rate ?? 0) + increment * 100) })
        .eq('id', seqId)
    }
  }

  return NextResponse.json({ ok: true, event: eventType, enrollment_id: enrollment.id })
}
