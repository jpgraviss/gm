import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { fireAutomations } from '@/lib/automations-engine'
import { logActivity } from '@/lib/activity-log'

export const GET = withErrorHandler('proposals/view/[token] GET', async (_req, ctx) => {
  const { token } = await ctx!.params

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: proposal, error } = await db
    .from('proposals')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Mark as viewed if not already
  if (!proposal.viewed_date) {
    await db
      .from('proposals')
      .update({
        viewed_date: new Date().toISOString().split('T')[0],
        status: proposal.status === 'Sent' ? 'Viewed' : proposal.status,
      })
      .eq('id', proposal.id)
  }

  // AUDIT — AI-generated proposals (lib/proposal-generator.ts) always save
  // items: [] (there's no line-item concept in the AI-drafted structure,
  // only the branded PDF has the real Investment Summary) and this route
  // never returned pdf_path at all, so the public client-facing page had
  // no pricing table (hidden when items is empty) AND no way to see or
  // download the actual branded PDF that was generated — the entire point
  // of the proposal was invisible to the person it was sent to.
  let pdfUrl: string | null = null
  if (proposal.pdf_path) {
    const { data: signed } = await db.storage.from('proposal-pdfs').createSignedUrl(proposal.pdf_path, 3600)
    pdfUrl = signed?.signedUrl ?? null
  }

  return NextResponse.json({
    id: proposal.id,
    company: proposal.company,
    value: proposal.value,
    items: proposal.items ?? [],
    pdfUrl,
    serviceType: proposal.service_type,
    status: proposal.status,
    notes: proposal.renewal_notes ?? null,
    clientNotes: proposal.client_notes ?? null,
    createdAt: proposal.created_at,
    createdDate: proposal.created_date,
    assignedRep: proposal.assigned_rep,
  })
})

export const PATCH = withErrorHandler('proposals/view/[token] PATCH', async (req, ctx) => {
  const { token } = await ctx!.params

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const body = await req.json()
  const { action, clientNotes } = body as { action?: string; clientNotes?: string }

  if (!action || (action !== 'accept' && action !== 'decline')) {
    return NextResponse.json({ error: 'action must be "accept" or "decline"' }, { status: 400 })
  }

  const db = createServiceClient()

  // Fetch the proposal
  const { data: proposal, error: fetchErr } = await db
    .from('proposals')
    .select('*')
    .eq('token', token)
    .single()

  if (fetchErr || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Don't allow re-response
  if (proposal.status === 'Accepted' || proposal.status === 'Declined') {
    return NextResponse.json({ error: 'This proposal has already been responded to' }, { status: 400 })
  }

  const newStatus = action === 'accept' ? 'Accepted' : 'Declined'

  // AUDIT #496 — conditional on status not already being a terminal
  // Accepted/Declined, matching the atomic-claim pattern #81 established on
  // /api/reputation/review-request/[token]. The status check above reads a
  // snapshot that a near-simultaneous second submission (e.g. the same
  // proposal link opened on two devices, or a replayed request choosing
  // "decline" after "accept" already landed) could also pass before either
  // write lands. Only the request whose UPDATE actually claims the row
  // (returns a row) proceeds to fire proposal_accepted/proposal_declined —
  // otherwise two conflicting automations could double-fire for the same
  // proposal.
  const { data: updated, error: updateErr } = await db
    .from('proposals')
    .update({
      status: newStatus,
      client_notes: clientNotes || null,
      responded_date: new Date().toISOString().split('T')[0],
    })
    .eq('id', proposal.id)
    .not('status', 'in', '(Accepted,Declined)')
    .select()
    .maybeSingle()

  if (updateErr) {
    throw new Error(updateErr?.message || 'Failed to update proposal')
  }
  if (!updated) {
    return NextResponse.json({ error: 'This proposal has already been responded to' }, { status: 400 })
  }

  // This is the real client-facing accept/decline flow (the emailed link);
  // the internal /api/proposals/[id] PATCH also fires these triggers for
  // staff-driven status changes, but that path was never reached by an
  // actual client response — proposal_accepted/proposal_declined never
  // fired in production until now.
  fireAutomations(action === 'accept' ? 'proposal_accepted' : 'proposal_declined', {
    proposalId: proposal.id,
    ...proposal,
    status: newStatus,
    clientNotes: clientNotes || null,
  })

  // Asymmetry fix: the internal "Mark Accepted" button in
  // app/proposals/page.tsx has always created a Draft contract directly,
  // but THIS route — the one real clients actually use, via the emailed
  // link — only fired an automation, so a contract appeared only if a staff
  // member had separately hand-built one. Since client acceptance is by far
  // the dominant path, "a won proposal becomes a draft contract" silently
  // didn't happen for most real wins. Mirrors the staff path's payload
  // exactly. Best-effort: a contract-creation failure must not undo the
  // client's acceptance, which is already committed above.
  if (action === 'accept') {
    try {
      const startDate = new Date().toISOString().split('T')[0]
      const renewalDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        .toISOString().split('T')[0]
      const { error: contractErr } = await db.from('contracts').insert({
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        proposal_id: proposal.id,
        company: proposal.company,
        company_id: proposal.company_id ?? null,
        status: 'Draft',
        value: proposal.value ?? 0,
        billing_structure: 'Monthly',
        start_date: startDate,
        duration: 12,
        renewal_date: renewalDate,
        assigned_rep: proposal.assigned_rep ?? '',
        service_type: proposal.service_type ?? 'General',
      })
      if (contractErr) {
        console.error('[proposals/view] draft contract creation failed:', contractErr.message)
      } else {
        logActivity({
          type: 'proposal',
          title: `Proposal accepted — draft contract created`,
          body: `${proposal.service_type ?? 'General'} · ${proposal.value ?? 0}`,
          companyId: proposal.company_id ?? null,
          companyName: proposal.company,
          outcome: 'success',
        })
      }
    } catch (err) {
      console.error('[proposals/view] draft contract creation threw:', err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({ success: true, status: newStatus })
})
