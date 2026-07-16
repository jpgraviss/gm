import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthenticatedEmail } from '@/lib/admin-auth'

/**
 * Verify that the caller is a portal client authorized for the given company.
 * Returns null if authorized, or an error response to send back.
 */
export async function requirePortalClient(
  req: NextRequest,
  company: string,
): Promise<NextResponse | null> {
  const email = await getAuthenticatedEmail(req)

  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const db = createServiceClient()

  // Staff members can access any company's portal data — status is checked
  // so a suspended/deleted staff member can't use this bypass to reach
  // every company's portal data via a still-live session.
  const { data: staff } = await db
    .from('team_members')
    .select('id, status')
    .ilike('email', email)
    .maybeSingle()

  if (staff && staff.status === 'active') return null

  // Portal clients can only access their own company
  const { data: client } = await db
    .from('portal_clients')
    .select('id, company, access')
    .ilike('email', email)
    .maybeSingle()

  if (!client) {
    return NextResponse.json({ error: 'No portal account found' }, { status: 403 })
  }

  if (client.access === 'Disabled') {
    return NextResponse.json({ error: 'Portal access disabled' }, { status: 403 })
  }

  if (client.company?.toLowerCase() !== company.toLowerCase()) {
    return NextResponse.json({ error: 'Access denied for this company' }, { status: 403 })
  }

  return null
}

// requirePortalClient only checks that the caller may touch a record
// belonging to its CURRENT company — it doesn't restrict which fields they
// may change. A route that lets a portal client PATCH a record's `company`/
// `companyId` (a reassignment, not a status update) needs this to know
// whether to restrict the field set: a portal client should never be able
// to move a record they own to a different company, or edit fields their
// own portal UI never sends in the first place.
export async function isStaffCaller(req: NextRequest): Promise<boolean> {
  const email = await getAuthenticatedEmail(req)
  if (!email) return false
  const db = createServiceClient()
  const { data: staff } = await db
    .from('team_members')
    .select('id, status')
    .ilike('email', email)
    .maybeSingle()
  return !!staff && staff.status === 'active'
}
