import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('portal-clients/check-approval GET', async (req) => {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: client, error } = await db
    .from('portal_clients')
    .select('id, access, pending_approval, setup_completed')
    .ilike('email', email.toLowerCase().trim())
    .maybeSingle()

  if (error || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  return NextResponse.json({
    approved: client.access === 'Active' && !client.pending_approval,
    pending: client.pending_approval,
    setupCompleted: client.setup_completed,
  })
})
