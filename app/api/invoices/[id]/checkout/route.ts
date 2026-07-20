import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requirePortalClient } from '@/lib/portal-auth'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { getStripeSecretKey, createInvoiceCheckoutSession } from '@/lib/stripe'

// POST /api/invoices/[id]/checkout — generates a fresh Stripe Checkout
// Session for a single invoice. Called by both staff (to copy/send a
// payment link) and the owning portal client (clicking "Pay Now"
// themselves) — requirePortalClient(req, invoice.company) already handles
// both cases (active staff always pass; a portal client passes only for
// their own company's invoice).
export const POST = withErrorHandler('invoices/[id]/checkout POST', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()

  const { data: invoice } = await db.from('invoices').select('*').eq('id', id).single()
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const denied = await requirePortalClient(req, invoice.company)
  if (denied) return denied

  if (invoice.status === 'Paid') {
    return NextResponse.json({ error: 'This invoice has already been paid' }, { status: 400 })
  }

  const secretKey = await getStripeSecretKey(db)
  if (!secretKey) {
    return NextResponse.json({ error: 'Stripe is not connected — an admin needs to add a secret key in Settings > Integrations' }, { status: 400 })
  }

  // Best-effort prefill only — Stripe's hosted checkout page still lets the
  // payer type/change the email themselves, so a miss here isn't fatal.
  const callerEmail = await getAuthenticatedEmail(req)
  let customerEmail = callerEmail ?? undefined
  const { data: staffRow } = callerEmail
    ? await db.from('team_members').select('id').ilike('email', callerEmail).maybeSingle()
    : { data: null }
  if (staffRow) {
    // Caller is staff generating a link on the client's behalf — use the
    // portal client's own email instead of the staff member's.
    const { data: portalClient } = await db
      .from('portal_clients')
      .select('email')
      .eq('company', invoice.company)
      .not('email', 'is', null)
      .limit(1)
      .maybeSingle()
    customerEmail = portalClient?.email || undefined
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  const isStaff = !!staffRow
  // AUDIT.md #201/#154 — /portal/billing is structurally unreachable by a
  // real logged-in client (AppShell redirects every client session to
  // /client instead), so a real client paying would land on a page they
  // can never navigate back to. /client is what's actually reachable.
  const returnBase = isStaff ? `${appUrl}/billing` : `${appUrl}/client`

  try {
    const { url, sessionId } = await createInvoiceCheckoutSession({
      secretKey,
      invoiceId: invoice.id,
      amount: invoice.amount,
      companyName: invoice.company,
      serviceType: invoice.service_type ?? 'General',
      customerEmail,
      successUrl: `${returnBase}?paid=${invoice.id}`,
      cancelUrl: `${returnBase}?checkout=cancelled`,
    })

    await db.from('invoices').update({ stripe_checkout_session_id: sessionId }).eq('id', id)

    return NextResponse.json({ url })
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to create Stripe checkout session')
  }
})
