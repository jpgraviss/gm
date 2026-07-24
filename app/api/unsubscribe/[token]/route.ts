import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { verifyToken } from '@/lib/signed-token'

interface TokenPayload {
  contactId: string
  email: string
}

// AUDIT — previously plain base64(JSON), no signature. Combined with
// crm_contacts ids being a guessable `ct-${Date.now()}` millisecond
// timestamp, anyone who knew a contact's email and roughly when they were
// created could construct a valid-looking token offline and
// unsubscribe/resubscribe them without consent. Now rejects anything not
// signed by this server.
function decodeToken(token: string): TokenPayload | null {
  const parsed = verifyToken<TokenPayload>(token)
  if (parsed && parsed.contactId && parsed.email) return parsed
  return null
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

  let body: { action: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const db = createServiceClient()

  // AUDIT — GET already re-verifies the token's email against the contact's
  // real emails; POST (the handler that actually writes the opt-in state)
  // never did, so a token whose payload didn't match its own contactId
  // could still flip that contact's subscription state.
  const { data: contact } = await db
    .from('crm_contacts')
    .select('id, emails')
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
