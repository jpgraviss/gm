import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

// Public, unauthenticated-by-design (mirrors portal-clients/check-approval):
// the setup-account wizard polls this while the new hire has no session yet
// (they've only entered an email + code). Returns only approval-status
// booleans, never anything else about the account.
export const GET = withErrorHandler('team-members/check-approval GET', async (req) => {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: member, error } = await db
    .from('team_members')
    .select('status, pending_approval, setup_completed')
    .ilike('email', email.toLowerCase().trim())
    .maybeSingle()

  if (error || !member) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    approved: member.status === 'active' && !member.pending_approval,
    pending: member.pending_approval,
    denied: member.status === 'suspended',
    setupCompleted: member.setup_completed,
  })
})
