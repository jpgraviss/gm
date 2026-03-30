import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('sequence_enrollments')
    .select('*')
    .eq('sequence_id', id)
    .order('enrolled_at', { ascending: false })
  if (error) {
    console.error('[enrollments GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch enrollments' }, { status: 500 })
  }
  return NextResponse.json(
    (data ?? []).map(r => ({
      id: r.id,
      sequenceId: r.sequence_id,
      contactId: r.contact_id,
      contactName: r.contact_name,
      contactEmail: r.contact_email,
      enrolledAt: r.enrolled_at,
      currentStep: r.current_step,
      status: r.status,
      nextSendAt: r.next_send_at,
      lastSentAt: r.last_sent_at,
    }))
  )
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { enrollmentIds } = await req.json() as { enrollmentIds: string[] }

  if (!enrollmentIds?.length) {
    return NextResponse.json({ error: 'enrollmentIds array required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Count active enrollments being removed to update sequence counts
  const { data: toRemove } = await db
    .from('sequence_enrollments')
    .select('id, status')
    .eq('sequence_id', id)
    .in('id', enrollmentIds)

  const activeRemoved = (toRemove ?? []).filter(e => e.status === 'active').length
  const totalRemoved = (toRemove ?? []).length

  const { error } = await db
    .from('sequence_enrollments')
    .delete()
    .eq('sequence_id', id)
    .in('id', enrollmentIds)

  if (error) {
    console.error('[enrollments DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to remove enrollments' }, { status: 500 })
  }

  // Update sequence counts
  if (totalRemoved > 0) {
    const { data: seq } = await db
      .from('sequences')
      .select('enrolled_count, active_count')
      .eq('id', id)
      .single()

    if (seq) {
      await db
        .from('sequences')
        .update({
          enrolled_count: Math.max(0, (seq.enrolled_count ?? 0) - totalRemoved),
          active_count: Math.max(0, (seq.active_count ?? 0) - activeRemoved),
          last_modified: new Date().toISOString().split('T')[0],
        })
        .eq('id', id)
    }
  }

  return NextResponse.json({ removed: totalRemoved })
}
