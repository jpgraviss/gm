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

  // Staff members can access any company's portal data
  const { data: staff } = await db
    .from('team_members')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (staff) return null

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
