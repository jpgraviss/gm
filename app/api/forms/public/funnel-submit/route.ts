import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { fireTrigger } from '@/lib/automation-triggers'
import { extractUtmFromBody } from '@/lib/attribution'

interface FunnelFormField {
  name: string
  label: string
  type: string
}

// Funnel form-block fields don't carry the `mapsTo` property lib/forms.ts's
// submissionToContact relies on (that's specific to the generic Forms
// builder's schema) — resolve by field `type` instead, same convention the
// funnel editor (app/funnels/editor/page.tsx) already uses for email fields.
function resolveContactFromFunnelSubmission(
  fields: FunnelFormField[],
  data: Record<string, unknown>,
): { email: string; name: string } {
  let email = ''
  let name = ''
  for (const field of fields) {
    const raw = data[field.name]
    if (raw === undefined || raw === null || raw === '') continue
    const value = String(raw).trim()
    if (field.type === 'email' && !email) email = value.toLowerCase()
    else if (!name && (field.type === 'text') && /name/i.test(field.name)) name = value
  }
  return { email, name }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export const POST = withErrorHandler('forms/public/funnel-submit POST', async (req: NextRequest) => {
  const body = await req.json()
  const { funnelSlug, pageId, data, utm } = body

  if (!funnelSlug || !data) {
    return NextResponse.json({ error: 'Missing funnelSlug or data' }, { status: 400, headers: corsHeaders })
  }

  const db = createServiceClient()

  const { data: funnel } = await db
    .from('funnels')
    .select('id')
    .eq('slug', funnelSlug)
    .single()

  if (!funnel) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404, headers: corsHeaders })
  }

  const submissionId = `fsub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  // Resolve the submitting page's form-block field schema (if we know which
  // page it was) so we can tell which submitted value is the email vs. name
  // — funnel form fields don't carry the mapsTo hint the generic Forms
  // builder schema does.
  let contactId: string | null = null
  if (pageId) {
    const { data: pageRow } = await db
      .from('funnel_pages')
      .select('blocks')
      .eq('id', pageId)
      .eq('funnel_id', funnel.id)
      .maybeSingle()
    const blocks = (pageRow?.blocks ?? []) as Array<{ type: string; data: { fields?: FunnelFormField[] } }>
    const formBlock = blocks.find(b => b.type === 'form')
    const fields = formBlock?.data.fields ?? []
    const { email, name } = resolveContactFromFunnelSubmission(fields, data)

    if (email) {
      const { data: existing } = await db
        .from('crm_contacts')
        .select('id')
        .contains('emails', [email])
        .maybeSingle()

      if (existing?.id) {
        contactId = existing.id
      } else {
        const newContactId = `ct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        await db.from('crm_contacts').insert({
          id: newContactId,
          first_name: name,
          last_name: '',
          full_name: name || email,
          emails: [email],
          owner: '',
          tags: [],
          lifecycle_stage: 'Lead',
          created_date: new Date().toISOString().split('T')[0],
          ...extractUtmFromBody(utm),
        })
        contactId = newContactId
      }
    }
  }

  await db.from('form_submissions').insert({
    id: submissionId,
    form_id: `funnel:${funnel.id}`,
    data,
    source_url: req.headers.get('referer') ?? null,
    status: 'new',
    contact_id: contactId,
  })

  if (contactId) {
    fireTrigger('form_submitted', {
      formId: `funnel:${funnel.id}`,
      formName: `Funnel: ${funnelSlug}`,
      submissionId,
      contactId,
      data,
      // Public, unauthenticated endpoint — an attacker who knows a funnel
      // slug and an existing contact's email can reach this trigger. Lets
      // the engine refuse actions that shouldn't be forgeable this way
      // (AUDIT.md #46) without having to authenticate the endpoint itself,
      // which has to stay public since funnels are embedded on external sites.
      _publicSource: true,
    })
  }

  // Credit the page the form was actually submitted from. Falls back to the
  // funnel's first page only if the caller didn't send pageId (e.g. a stale
  // cached embed) or sent one that doesn't belong to this funnel.
  let targetPage: { id: string; conversions: number | null } | null = null
  if (pageId) {
    const { data: page } = await db
      .from('funnel_pages')
      .select('id, conversions')
      .eq('id', pageId)
      .eq('funnel_id', funnel.id)
      .maybeSingle()
    targetPage = page
  }
  if (!targetPage) {
    const { data: firstPage } = await db
      .from('funnel_pages')
      .select('id, conversions')
      .eq('funnel_id', funnel.id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single()
    targetPage = firstPage
  }

  if (targetPage) {
    await db
      .from('funnel_pages')
      .update({ conversions: (targetPage.conversions ?? 0) + 1 })
      .eq('id', targetPage.id)
  }

  return NextResponse.json({ success: true, id: submissionId }, { status: 201, headers: corsHeaders })
})
