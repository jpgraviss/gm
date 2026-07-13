import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { fireAutomations } from '@/lib/automations-engine'

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

  return NextResponse.json({
    id: proposal.id,
    company: proposal.company,
    value: proposal.value,
    items: proposal.items ?? [],
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

  const { error: updateErr } = await db
    .from('proposals')
    .update({
      status: newStatus,
      client_notes: clientNotes || null,
      responded_date: new Date().toISOString().split('T')[0],
    })
    .eq('id', proposal.id)

  if (updateErr) {
    throw new Error(updateErr?.message || 'Failed to update proposal')
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

  return NextResponse.json({ success: true, status: newStatus })
})
