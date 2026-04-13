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
    subject?: string
    link?: string // present on email.clicked
    click?: { link: string; ipAddress?: string; userAgent?: string }
    bounce?: { type?: string; subType?: string; message?: string }
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

  // Extract sequence/enrollment/broadcast IDs from custom headers
  const sequenceId = extractHeader(data.headers, 'X-Sequence-Id')
  const enrollmentId = extractHeader(data.headers, 'X-Enrollment-Id')
  const broadcastId = extractHeader(data.headers, 'X-Broadcast-Id')
  const recipientId = extractHeader(data.headers, 'X-Recipient-Id')
  const contactEmail = data.to?.[0]

  // ── Broadcast events ─────────────────────────────────────────────────────
  // If this is a broadcast event, update the broadcast_recipients row and the
  // aggregate counters on the parent broadcast. Then return without falling
  // through to the sequence logic.
  if (broadcastId && recipientId) {
    const eventColumnMap: Record<string, string> = {
      'email.delivered': 'delivered_at',
      'email.opened':    'opened_at',
      'email.clicked':   'clicked_at',
      'email.bounced':   'bounced_at',
      'email.complained': 'unsubscribed_at',
    }
    const statusMap: Record<string, string> = {
      'email.delivered': 'delivered',
      'email.opened':    'opened',
      'email.clicked':   'clicked',
      'email.bounced':   'bounced',
      'email.complained': 'unsubscribed',
    }
    const timestampCol = eventColumnMap[type]
    const newStatus = statusMap[type]
    if (timestampCol && newStatus) {
      await db
        .from('broadcast_recipients')
        .update({ [timestampCol]: new Date().toISOString(), status: newStatus })
        .eq('id', recipientId)

      // Increment the broadcast aggregate counter
      const counterMap: Record<string, string> = {
        'email.delivered': 'total_delivered',
        'email.opened':    'total_opened',
        'email.clicked':   'total_clicked',
        'email.bounced':   'total_bounced',
        'email.complained': 'total_unsubscribed',
      }
      const counterCol = counterMap[type]
      if (counterCol) {
        const { data: bc } = await db.from('broadcasts').select(counterCol).eq('id', broadcastId).single()
        const current = (bc as Record<string, number> | null)?.[counterCol] ?? 0
        await db.from('broadcasts').update({ [counterCol]: current + 1 }).eq('id', broadcastId)
      }

      // Bounces + complaints → global suppression
      if (type === 'email.bounced' || type === 'email.complained') {
        await db.from('sequence_suppression_list').upsert(
          {
            id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            email: contactEmail?.toLowerCase(),
            reason: type === 'email.bounced' ? 'bounced' : 'complained',
            source: `broadcast:${broadcastId}`,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'email' },
        )
      }
    }

    return NextResponse.json({ ok: true, event: newStatus, broadcast_id: broadcastId })
  }

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

  // Build event metadata — capture click URL and bounce details when present
  const metadata: Record<string, unknown> = {
    email_id: data.email_id,
    resend_event: type,
    subject: data.subject,
  }
  if (type === 'email.clicked') {
    metadata.link = data.click?.link ?? data.link ?? null
    metadata.user_agent = data.click?.userAgent ?? null
  }
  if (type === 'email.bounced') {
    metadata.bounce_type = data.bounce?.type ?? null
    metadata.bounce_subtype = data.bounce?.subType ?? null
    metadata.bounce_message = data.bounce?.message ?? null
  }

  // Insert activity record with step_index from enrollment
  await db.from('sequence_activities').insert({
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sequence_id: seqId,
    enrollment_id: enrollment.id,
    contact_email: contactEmail,
    step_index: enrollment.current_step ?? 0,
    event_type: eventType,
    metadata,
    created_at: new Date().toISOString(),
  })

  // Update enrollment delivery status on delivered event
  if (type === 'email.delivered') {
    await db
      .from('sequence_enrollments')
      .update({
        delivery_status: 'delivered',
        last_delivered_at: new Date().toISOString(),
      })
      .eq('id', enrollment.id)
  }

  // Mirror engagement events to the CRM contact timeline
  if (enrollment.contact_id && (type === 'email.opened' || type === 'email.clicked' || type === 'email.bounced')) {
    const descriptionMap: Record<string, string> = {
      'email.opened': `Opened sequence email`,
      'email.clicked': `Clicked link in sequence email${metadata.link ? ` (${metadata.link})` : ''}`,
      'email.bounced': `Sequence email bounced`,
    }
    await db.from('crm_activities').insert({
      id: `act-seq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'Email',
      description: descriptionMap[type],
      contact_id: enrollment.contact_id,
      company_id: null,
      timestamp: new Date().toISOString(),
      logged_by: 'System',
    })
  }

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
