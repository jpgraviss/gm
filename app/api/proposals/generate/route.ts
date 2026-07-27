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
    if (!clientName && submission.contact_id) {
      const { data: contact } = await db.from('crm_contacts').select('company_name').eq('id', submission.contact_id).maybeSingle()
      clientName = contact?.company_name ?? ''
    }
    if (!clientName) clientName = form.name
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
