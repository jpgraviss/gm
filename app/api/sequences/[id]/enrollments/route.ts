import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('sequences/[id]/enrollments GET', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('sequence_enrollments')
    .select('*')
    .eq('sequence_id', id)
    .order('enrolled_at', { ascending: false })
  if (error) {
    throw new Error(error?.message || 'Failed to fetch enrollments')
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
      assignedRepId: r.assigned_rep_id,
      company: r.company,
      dealId: r.deal_id,
      unenrollReason: r.unenroll_reason,
      deliveryStatus: r.delivery_status,
      lastMessageId: r.last_message_id,
      abVariant: r.ab_variant,
    }))
  )
})

export const DELETE = withErrorHandler('sequences/[id]/enrollments DELETE', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
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
    throw new Error(error?.message || 'Failed to remove enrollments')
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
})
