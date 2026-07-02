import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

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
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

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
    console.error('[proposals/view/:token PATCH]', updateErr)
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: newStatus })
}
