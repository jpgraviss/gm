import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

interface TokenPayload {
  contactId: string
  email: string
}

function decodeToken(token: string): TokenPayload | null {
  try {
    const json = Buffer.from(token, 'base64').toString('utf-8')
    const parsed = JSON.parse(json)
    if (parsed.contactId && parsed.email) return parsed as TokenPayload
    return null
  } catch {
    return null
  }
}

export const GET = withErrorHandler('unsubscribe/[token] GET', async (_req, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params
  const payload = decodeToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: contact } = await db
    .from('crm_contacts')
    .select('id, first_name, last_name, full_name, emails, email_preferences')
    .eq('id', payload.contactId)
    .single()

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const emailMatch = (contact.emails ?? []).some(
    (e: string) => e.toLowerCase() === payload.email.toLowerCase(),
  )
  if (!emailMatch) {
    return NextResponse.json({ error: 'Email does not match contact' }, { status: 400 })
  }

  return NextResponse.json({
    contactId: contact.id,
    firstName: contact.first_name,
    email: payload.email,
    preferences: contact.email_preferences ?? null,
  })
})

export const POST = withErrorHandler('unsubscribe/[token] POST', async (req, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params
  const payload = decodeToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  }

  let body: { action: string; reason?: string; frequency?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const db = createServiceClient()
  const email = payload.email.toLowerCase()

  if (body.action === 'unsubscribe') {
    await db
      .from('crm_contacts')
      .update({
        email_preferences: {
          unsubscribed: true,
          unsubscribedAt: new Date().toISOString(),
          reason: body.reason || 'not_specified',
        },
      })
      .eq('id', payload.contactId)

    await db.from('sequence_suppression_list').upsert(
      {
        id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        email,
        reason: body.reason || 'unsubscribed',
        source: 'unsubscribe_page',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    )

    return NextResponse.json({ ok: true, status: 'unsubscribed' })
  }

  if (body.action === 'reduce_frequency') {
    await db
      .from('crm_contacts')
      .update({
        email_preferences: {
          unsubscribed: false,
          frequency: body.frequency || 'monthly',
          updatedAt: new Date().toISOString(),
        },
      })
      .eq('id', payload.contactId)

    return NextResponse.json({ ok: true, status: 'frequency_updated' })
  }

  if (body.action === 'resubscribe') {
    await db
      .from('crm_contacts')
      .update({
        email_preferences: {
          unsubscribed: false,
          resubscribedAt: new Date().toISOString(),
        },
      })
      .eq('id', payload.contactId)

    await db.from('sequence_suppression_list').delete().eq('email', email)

    return NextResponse.json({ ok: true, status: 'resubscribed' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
})
