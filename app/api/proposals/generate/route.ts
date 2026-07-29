import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { generateProposal, buildIntakeTextFromSubmission, parsePriceLabel } from '@/lib/proposal-generator'

interface GenerateBody {
  submissionId?: string
  intakeText?: string
  clientName?: string
}

// AUDIT — the AI draft (up to 3 provider tiers) + headless Chromium PDF
// render can take a while; declaring this explicitly avoids the platform's
// undeclared default cutting the request off mid-render with no response.
export const maxDuration = 180

export const POST = withErrorHandler('proposals/generate POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  let body: GenerateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const db = createServiceClient()
  let intakeText = body.intakeText?.trim() ?? ''
  let clientName = body.clientName?.trim() ?? ''
  let submissionId: string | null = null
  // AUDIT — this route (the sole "New Proposal" entry point on the
  // standalone Proposals page — no CompanySelect anywhere in it) never set
  // company_id on the proposals it inserted, defeating company_id for the
  // majority of new proposals. Resolved two ways below: directly off the
  // submitting contact's own company_id when available (most precise), or
  // by name-matching the resolved clientName against crm_companies
  // otherwise — same fallback pattern the add_company_id_fks.sql backfill
  // itself used. Left null (existing behavior) if neither resolves.
  let companyId: string | null = null

  if (body.submissionId) {
    const { data: submission } = await db
      .from('form_submissions')
      .select('id, form_id, data, contact_id')
      .eq('id', body.submissionId)
      .maybeSingle()
    if (!submission) {
      return NextResponse.json({ error: 'Form submission not found' }, { status: 404 })
    }
    const { data: form } = await db
      .from('forms')
      .select('name, fields')
      .eq('id', submission.form_id)
      .maybeSingle()
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }
    const fields = (form.fields ?? []) as { name: string; label: string; mapsTo?: string }[]
    intakeText = buildIntakeTextFromSubmission(fields, submission.data ?? {})
    submissionId = submission.id

    if (!clientName) {
      for (const f of fields) {
        if (f.mapsTo === 'company' && submission.data?.[f.name]) { clientName = String(submission.data[f.name]); break }
      }
    }
    if (submission.contact_id) {
      const { data: contact } = await db.from('crm_contacts').select('company_name, company_id').eq('id', submission.contact_id).maybeSingle()
      if (!clientName) clientName = contact?.company_name ?? ''
      companyId = contact?.company_id ?? null
    }
    if (!clientName) clientName = form.name
  }

  if (!companyId && clientName) {
    // .limit(1) rather than .maybeSingle() — crm_companies.name has no
    // unique constraint (AUDIT #96/#513), and maybeSingle() throws if a
    // name collision returns more than one row.
    const { data: matchedCompanies } = await db.from('crm_companies').select('id').ilike('name', clientName).limit(1)
    companyId = matchedCompanies?.[0]?.id ?? null
  }

  if (!intakeText) {
    return NextResponse.json({ error: 'intakeText or submissionId is required' }, { status: 400 })
  }
  if (!clientName) {
    return NextResponse.json({ error: 'clientName is required (could not be inferred from the submission)' }, { status: 400 })
  }

  const result = await generateProposal({ intakeText, clientName })

  const pdfPath = `${clientName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`
  const { error: uploadErr } = await db.storage.from('proposal-pdfs').upload(pdfPath, result.pdf, { contentType: 'application/pdf' })
  if (uploadErr) {
    throw new Error(`Failed to upload generated PDF: ${String(uploadErr)}`)
  }

  const recommended = result.draft.options.find(o => o.recommended) ?? result.draft.options[0]
  const value = parsePriceLabel(recommended?.priceLabel)
  const today = new Date().toISOString().split('T')[0]

  const { data: saved, error: insertErr } = await db
    .from('proposals')
    .insert({
      id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      company: clientName,
      company_id: companyId,
      status: 'Draft',
      value,
      service_type: 'Custom',
      assigned_rep: '',
      items: [],
      form_submission_id: submissionId,
      pdf_path: pdfPath,
      generation_notes: result.notes,
      created_date: today,
    })
    .select()
    .single()
  if (insertErr) {
    throw new Error(insertErr.message || 'Failed to save generated proposal')
  }

  const { data: signedUrlData } = await db.storage.from('proposal-pdfs').createSignedUrl(pdfPath, 3600)

  return NextResponse.json({
    proposal: saved,
    pdfUrl: signedUrlData?.signedUrl ?? null,
    source: result.source,
    notes: result.notes,
  })
})
