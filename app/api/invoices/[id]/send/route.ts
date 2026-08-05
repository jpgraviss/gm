import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { blockIfPreview } from '@/lib/portal-auth'
import { logAudit } from '@/lib/audit'
import { sendInvoiceEmail } from '@/lib/invoice-send'

/**
 * POST /api/invoices/[id]/send — emails the invoice to the client's billing
 * contact and moves it Pending → Sent.
 *
 * Staff-only, unlike the sibling `checkout` route: that one is deliberately
 * reachable by the owning portal client (they click "Pay Now" themselves),
 * but nobody outside the agency should be able to make the app send an
 * invoice. Blocked in View-as-Client preview mode for the same reason the
 * checkout route is (AUDIT #506) — this sends real mail to a real client.
 */
export const POST = withErrorHandler('invoices/[id]/send POST', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const blocked = blockIfPreview(req)
  if (blocked) return blocked

  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })

  const actor = await getAuthUser(req)
  const result = await sendInvoiceEmail(id, { actorName: actor?.name || actor?.email })

  if (!result.ok) {
    // 400, not 500 — every failure path here is a real, actionable condition
    // (already paid, no billing contact, email rejected), not a server fault.
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action: 'invoice_sent',
    module: 'billing',
    type: 'action',
    metadata: { invoiceId: id, recipient: result.recipient, hadPayLink: !!result.payLink },
  })

  return NextResponse.json({
    ok: true,
    recipient: result.recipient,
    payLink: result.payLink,
    statusUnchanged: result.statusUnchanged,
  })
})
