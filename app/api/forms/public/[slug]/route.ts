import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateSubmission, submissionToContact } from '@/lib/forms'
import { getResend } from '@/lib/resend'
import { fireTrigger } from '@/lib/automation-triggers'

// CORS — forms get embedded on external websites
const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

/**
 * GET — public form schema for client-side rendering.
 * Returns only safe fields (no notify emails, no owner).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = createServiceClient()
  const { data: form } = await db
    .from('forms')
    .select('id, name, description, fields, submit_label, success_message, redirect_url, status, primary_color, text_color, bg_color, bg_transparent, font_family')
    .eq('slug', slug)
    .single()

  if (!form || form.status !== 'Active') {
    return NextResponse.json({ error: 'Form not available' }, { status: 404, headers: corsHeaders })
  }

  return NextResponse.json(
    {
      id:             form.id,
      name:           form.name,
      description:    form.description,
      fields:         form.fields,
      submitLabel:    form.submit_label,
      successMessage: form.success_message,
      redirectUrl:    form.redirect_url,
      primaryColor:   form.primary_color,
      textColor:      form.text_color,
      bgColor:        form.bg_color,
      bgTransparent:  form.bg_transparent,
      fontFamily:     form.font_family,
    },
    { headers: corsHeaders },
  )
}

/**
 * POST — public submission. No auth required.
 * Validates against form schema, creates submission + optional CRM contact.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders })
  }

  const db = createServiceClient()
  const { data: form } = await db
    .from('forms')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!form || form.status !== 'Active') {
    return NextResponse.json({ error: 'Form not available' }, { status: 404, headers: corsHeaders })
  }

  // Validate submission data against schema
  const validationError = validateSubmission({ fields: form.fields ?? [] }, body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400, headers: corsHeaders })
  }

  // Create the submission record
  const submissionId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const sourceUrl = req.headers.get('referer') ?? null
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent') ?? null

  let contactId: string | null = null

  // Optionally create/match a CRM contact
  if (form.create_contact) {
    const contactFields = submissionToContact({ fields: form.fields ?? [] }, body)
    const email = contactFields.email?.toLowerCase().trim()

    if (email) {
      // Upsert contact by email
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
          id:           newContactId,
          first_name:   contactFields.firstName,
          last_name:    contactFields.lastName,
          full_name:    `${contactFields.firstName} ${contactFields.lastName}`.trim() || email,
          emails:       [email],
          phones:       contactFields.phone ? [contactFields.phone] : [],
          company_name: contactFields.company || null,
          owner:        form.owner || '',
          tags:         form.tags ?? [],
          notes:        contactFields.notes ?? null,
          lifecycle_stage: 'Lead',
          created_date: new Date().toISOString().split('T')[0],
          created_at:   new Date().toISOString(),
        })
        contactId = newContactId
      }
    }
  }

  // Write the submission row
  const { error: insertErr } = await db.from('form_submissions').insert({
    id:          submissionId,
    form_id:     form.id,
    data:        body,
    source_url:  sourceUrl,
    ip_address:  ip,
    user_agent:  userAgent,
    contact_id:  contactId,
    status:      'new',
  })

  if (insertErr) {
    console.error('[forms public POST]', insertErr)
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500, headers: corsHeaders })
  }

  // Bump submissions count
  await db
    .from('forms')
    .update({ submissions_count: (form.submissions_count ?? 0) + 1 })
    .eq('id', form.id)

  fireTrigger('form_submitted', {
    formId: form.id,
    formName: form.name,
    submissionId,
    contactId,
    data: body,
  })

  if (Array.isArray(form.notify_emails) && form.notify_emails.length > 0) {
    const summary = Object.entries(body)
      .map(([k, v]) => `<strong>${k}:</strong> ${String(v)}`)
      .join('<br/>')
    getResend().emails.send({
      from: 'GravHub <noreply@app.gravissmarketing.com>',
      to: form.notify_emails,
      subject: `New ${form.name} submission`,
      html: `<p>You received a new form submission:</p><p>${summary}</p>`,
    }).catch((err) => console.error('[forms notify email]', err))
  }

  return NextResponse.json(
    {
      success: true,
      successMessage: form.success_message,
      redirectUrl: form.redirect_url,
    },
    { status: 201, headers: corsHeaders },
  )
}
