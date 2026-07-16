import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireExtensionToken, isExtensionCaller } from '@/lib/extension-auth'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * A lightweight version of HubSpot's Gmail-sidebar contact panel — given
 * the email address the extension detects you're viewing/composing to,
 * returns just enough CRM context (name, company, lifecycle stage, open
 * deals) to show inline in the extension's popup without embedding a full
 * iframe of the CRM into Gmail's DOM.
 */
export const GET = withErrorHandler('extension/contact-lookup GET', async (req) => {
  const caller = await requireExtensionToken(req)
  if (!isExtensionCaller(caller)) return caller

  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const db = createServiceClient()
  const { data: contact } = await db
    .from('crm_contacts')
    .select('id, full_name, title, company_id, company_name, lifecycle_stage, last_activity')
    .contains('emails', [email])
    .maybeSingle()

  if (!contact) {
    return NextResponse.json({ found: false })
  }

  const { data: deals } = await db
    .from('deals')
    .select('id, stage, value')
    .eq('contact_id', contact.id)
    .not('stage', 'in', '("Closed Won","Closed Lost")')

  return NextResponse.json({
    found: true,
    contactId: contact.id,
    name: contact.full_name,
    title: contact.title ?? undefined,
    company: contact.company_name ?? undefined,
    lifecycleStage: contact.lifecycle_stage ?? undefined,
    lastActivity: contact.last_activity ?? undefined,
    openDeals: (deals ?? []).map(d => ({ id: d.id, stage: d.stage, value: d.value })),
    crmUrl: `/crm/contacts?open=${contact.id}`,
  })
})
