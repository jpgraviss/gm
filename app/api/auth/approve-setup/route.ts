import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('auth/approve-setup POST', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const { userId, approved } = await req.json()

  if (!userId || typeof approved !== 'boolean') {
    return NextResponse.json({ error: 'userId and approved (boolean) are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: member, error: memberErr } = await db
    .from('team_members')
    .select('id, name, email, pending_approval')
    .eq('id', userId)
    .single()

  if (memberErr || !member) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!member.pending_approval) {
    return NextResponse.json({ error: 'User is not pending approval' }, { status: 400 })
  }

  if (approved) {
    await db
      .from('team_members')
      .update({ status: 'active', pending_approval: false })
      .eq('id', userId)

    logAudit({
      userName: 'admin',
      action: `approved_setup for ${member.name} (${member.email})`,
      module: 'admin',
      type: 'action',
    })

    return NextResponse.json({ success: true, status: 'approved' })
  } else {
    await db
      .from('team_members')
      .update({
        status: 'suspended',
        pending_approval: false,
        suspended_reason: 'Setup denied by admin',
      })
      .eq('id', userId)

    logAudit({
      userName: 'admin',
      action: `denied_setup for ${member.name} (${member.email})`,
      module: 'admin',
      type: 'action',
    })

    return NextResponse.json({ success: true, status: 'denied' })
  }
})

export const GET = withErrorHandler('auth/approve-setup GET', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('team_members')
    .select('id, name, email, role, unit, initials, verification_code, pending_approval, created_at')
    .eq('pending_approval', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('Failed to fetch pending approvals')
  }

  return NextResponse.json(data ?? [])
})
