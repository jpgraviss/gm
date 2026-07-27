import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthenticatedEmail } from '@/lib/admin-auth'

/**
 * Verify that the caller is a portal client authorized for the given company.
 * Returns null if authorized, or an error response to send back.
 *
 * `companyId` is optional (backward-compatible — most call sites still only
 * have a `company` NAME string on hand). When the call site can supply it
 * (e.g. it already fetched a specific invoice/proposal/contract/ticket row
 * that itself has a `company_id` column) AND the caller's own portal_clients
 * row is linked to a real `company_id`, authorization is decided by comparing
 * those two ids instead of names — see AUDIT.md #469 below.
 */
export async function requirePortalClient(
  req: NextRequest,
  company: string,
  companyId?: string | null,
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
    .select('id, company, company_id, access, pending_approval')
    .ilike('email', email)
    .maybeSingle()

  if (!client) {
    return NextResponse.json({ error: 'No portal account found' }, { status: 403 })
  }

  if (client.access === 'Disabled') {
    return NextResponse.json({ error: 'Portal access disabled' }, { status: 403 })
  }

  // AUDIT.md #195 — defense-in-depth: the 3 real session-issuing routes now
  // reject a pending-approval client before ever minting a session, but a
  // session issued before that fix (or any future path that forgets the
  // check) shouldn't still be able to reach company-scoped data through
  // this gate, which nearly every portal-scoped route calls.
  if (client.pending_approval) {
    return NextResponse.json({ error: 'Portal access is awaiting admin approval' }, { status: 403 })
  }

  // AUDIT.md #469 (escalates #238, same underlying gap as #187) — this used
  // to authorize purely by case-insensitive NAME string equality. Two
  // portal-client companies that happen to share an identical `company`
  // string would both pass this check for each other's data, since nothing
  // here ever looked at the indexed, FK'd `portal_clients.company_id`.
  //
  // company_id is a nullable text column (see add_company_id_fks.sql) only
  // backfilled where a row's company name exactly matched an existing
  // crm_companies row at migration time — real portal_clients rows can
  // still legitimately have company_id: null (never linked to a CRM
  // company). So this can only be the STRICT, collision-proof check when
  // BOTH sides are known: the caller's own row is linked (client.company_id)
  // and the call site was able to pass the target's real company_id (pulled
  // from the specific record being accessed, e.g. invoice.company_id) rather
  // than a name. When either side is missing, fall back to the original
  // name match rather than denying a real client outright — this mirrors
  // the #187 pattern (company_id when known, name-match fallback for
  // unlinked rows) rather than inventing a new one.
  if (client.company_id && companyId) {
    if (client.company_id !== companyId) {
      return NextResponse.json({ error: 'Access denied for this company' }, { status: 403 })
    }
    return null
  }

  if (client.company?.toLowerCase() !== company.toLowerCase()) {
    return NextResponse.json({ error: 'Access denied for this company' }, { status: 403 })
  }

  return null
}

// AUDIT.md #416 — requirePortalClient alone only checks tenancy (does the
// caller belong to `company`?), not which services that company is actually
// contracted for. The `/client/services/[slug]` detail pages gate which
// service a client can *see* purely client-side (React state from a fetch),
// so a client whose plan doesn't include e.g. Social Media could still get
// full Social Media data for their own company by calling the underlying
// route directly (devtools/curl), bypassing the UI gate entirely. This
// wraps requirePortalClient (reusing its tenancy + staff-bypass + disabled/
// pending-approval checks rather than duplicating them) and additionally
// requires `serviceName` to be present in that company's real
// `portal_clients.services` array — the same source of truth
// app/admin/portal-management/page.tsx's toggleServiceConfig keeps in sync
// with `services_config[key].enabled` on every write, and the fallback the
// service-detail page's own entitlement check already reads. Staff keep the
// same "any company, any service" bypass requirePortalClient already gives
// them — this only tightens the check for real portal clients.
export async function requireEntitledService(
  req: NextRequest,
  company: string,
  serviceName: string,
): Promise<NextResponse | null> {
  const denied = await requirePortalClient(req, company)
  if (denied) return denied

  if (await isStaffCaller(req)) return null

  const db = createServiceClient()
  const { data: client } = await db
    .from('portal_clients')
    .select('services')
    .ilike('company', company)
    .limit(1)
    .maybeSingle()

  const services: string[] = (client?.services as string[]) ?? []
  if (!services.includes(serviceName)) {
    return NextResponse.json(
      { error: `${serviceName} is not included in your current plan` },
      { status: 403 },
    )
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
