import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireExtensionToken, isExtensionCaller } from '@/lib/extension-auth'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * Called by the browser extension right before it rewrites the compose
 * body (pixel + link tokens both need a real tracked_emails.id to embed).
 * Resolves the recipient against crm_contacts by email, best-effort — an
 * unmatched recipient still gets tracked, it just won't show up on any CRM
 * timeline (mirrorTrackedEmailActivity no-ops without a contact_id).
 */
export const POST = withErrorHandler('extension/track-send POST', async (req) => {
  const caller = await requireExtensionToken(req)
  if (!isExtensionCaller(caller)) return caller

  const body = await req.json().catch(() => ({}))
  const result = validate(body, {
    recipientEmail: { required: true, type: 'string', maxLength: 320 },
    subject:        { type: 'string', maxLength: 500 },
  })
  if (!result.valid) return validationError(result.error)

  const recipientEmail = (body.recipientEmail as string).trim().toLowerCase()
  const db = createServiceClient()

  const { data: contact } = await db
    .from('crm_contacts')
    .select('id, company_id')
    .contains('emails', [recipientEmail])
    .maybeSingle()

  const id = `te-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const { error } = await db.from('tracked_emails').insert({
    id,
    team_member_id: caller.teamMemberId,
    recipient_email: recipientEmail,
    contact_id: contact?.id ?? null,
    company_id: contact?.company_id ?? null,
    subject: body.subject ?? null,
  })
  if (error) throw new Error(error.message)

  return NextResponse.json({ trackedEmailId: id }, { status: 201 })
})
