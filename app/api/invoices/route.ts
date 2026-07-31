import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { validate, validationError, INVOICE_STATUSES } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { requirePortalClient } from '@/lib/portal-auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(row: any) {
  return {
    id:          row.id,
    contractId:  row.contract_id ?? '',
    companyId:   row.company_id || null,
    company:     row.company,
    amount:      row.amount,
    status:      row.status,
    dueDate:     row.due_date ?? '',
    issuedDate:  row.issued_date ?? '',
    paidDate:    row.paid_date ?? undefined,
    serviceType: row.service_type,
    // AUDIT — captured by the Stripe webhook on payment but never returned
    // anywhere, so the actual amount Stripe collected and the payment
    // intent id (needed to look the charge up in Stripe) were invisible
    // in the app despite being in the database.
    amountPaid:  row.amount_paid ?? undefined,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? undefined,
  }
}

export const GET = withErrorHandler('invoices GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const contractId = searchParams.get('contractId')
  const status     = searchParams.get('status')
  const company    = searchParams.get('company')

  // Portal clients (billing/dashboard pages) legitimately call this scoped
  // to their own company — see matching comment in app/api/proposals/route.ts.
  const denied = company
    ? await requirePortalClient(req, company)
    : await requireRole(req, 'Team Member')
  if (denied) return denied

  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('invoices')
    .select('*')
  if (contractId) query = query.eq('contract_id', contractId)
  if (status)     query = query.eq('status', status)
  if (company)    query = query.eq('company', company)
  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch invoices')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapInvoice), nextCursor)
})

export const POST = withErrorHandler('invoices POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const body = await req.json()

  const result = validate(body, {
    company:      { required: true, type: 'string', maxLength: 200 },
    amount:       { required: true, type: 'number', min: 0 },
    status:       { type: 'string', enum: [...INVOICE_STATUSES] },
    dueDate:      { type: 'string', maxLength: 30 },
    issuedDate:   { type: 'string', maxLength: 30 },
    paidDate:     { type: 'string', maxLength: 30 },
    serviceType:  { type: 'string', maxLength: 100 },
    contractId:   { type: 'string', maxLength: 100 },
    timeEntryIds: { type: 'array' },
  })
  if (!result.valid) return validationError(result.error)

  const today = new Date().toISOString().split('T')[0]
  const db = createServiceClient()
  const { data, error } = await db
    .from('invoices')
    .insert({
      // AUDIT #590 — missing the random suffix its sibling create routes
      // (renewals, maintenance) both have; two requests landing in the
      // same millisecond collided on this text primary key.
      id:           `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      company_id:   body.companyId ?? null,
      company:      body.company,
      amount:       body.amount,
      status:       body.status ?? 'Pending',
      due_date:     body.dueDate ?? null,
      // AUDIT #510 — issuedDate/paidDate weren't in this schema at all, so
      // both were silently swallowed no matter what a caller sent — invisible
      // for CreateInvoiceModal (which never sends them, #421) but a real bug
      // for the CSV importer (#511), which does.
      issued_date:  body.issuedDate || today,
      paid_date:    body.paidDate || null,
      service_type: body.serviceType ?? 'General',
      contract_id:  body.contractId ?? null,
      source:       'manual',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error?.message || 'Failed to create invoice')
  }

  // AUDIT.md #224 — `time_entries.invoiced` was read by the billable-summary
  // panel but never written by any code path, so "Unbilled Time" showed
  // every billable entry ever logged as outstanding forever. The decided
  // fix: when time entries are attached to an invoice at creation time
  // (via the "Create Invoice from Unbilled Time" action), mark them
  // invoiced and point them at this invoice. Scoped to billable,
  // not-yet-invoiced entries so a stale/duplicate id list can't
  // double-bill or steal an entry from another invoice.
  const rawTimeEntryIds: unknown[] = Array.isArray(body.timeEntryIds) ? body.timeEntryIds : []
  const timeEntryIds = rawTimeEntryIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (timeEntryIds.length > 0) {
    // AUDIT #435 — defense in depth alongside the billable-summary filter:
    // that route no longer surfaces Rejected entries for selection, but
    // this endpoint takes raw timeEntryIds from the client, so a stale
    // page, a replayed request, or a direct API call could still try to
    // invoice one. Uses `.or(...)` rather than a plain `.neq('approval_status',
    // 'rejected')` for the same reason as billable-summary: Postgres' NULL-
    // propagating `<>` would silently exclude (and thus never mark
    // invoiced) any row whose approval_status happens to be NULL. Any
    // Rejected row in the id list simply won't match this filter and
    // silently won't be marked invoiced, which is the desired outcome.
    // AUDIT #421 — this update previously never checked how many rows it
    // actually affected. Its own `.eq('invoiced', false)` filter means a
    // second "Create Invoice" request racing this one over the same
    // unbilled group (both fired before the "Unbilled Time" panel had a
    // chance to refresh) could each independently create an invoice, with
    // whichever ran second silently claiming zero (or a partial subset) of
    // the entries it thought it was billing — two invoices for the same
    // work, no error, no signal to either staff member. `.select('id')`
    // here so the affected-row count can be compared against what the
    // client asked to claim.
    const { data: claimedRows, error: timeEntriesError } = await db
      .from('time_entries')
      .update({ invoiced: true, invoice_id: data.id })
      .in('id', timeEntryIds)
      .eq('billable', true)
      .eq('invoiced', false)
      .or('approval_status.is.null,approval_status.neq.rejected')
      .select('id')
    if (timeEntriesError) {
      throw new Error(timeEntriesError.message || 'Invoice created but failed to mark time entries as invoiced')
    }

    const claimedCount = claimedRows?.length ?? 0
    if (claimedCount < timeEntryIds.length) {
      // Fewer entries were actually claimed than requested — someone else
      // (another concurrent request, or an entry that was rejected/already
      // invoiced in the meantime) beat this one to some of them. The
      // invoice just created above was priced/described for the full
      // original set, so leaving it in place would double-bill the client
      // for entries another invoice already covers. Roll it back rather
      // than silently keeping a partial/incorrect invoice, and surface a
      // clear error so the caller knows to refresh and retry instead of
      // assuming success.
      await db.from('invoices').delete().eq('id', data.id)
      return NextResponse.json({
        error: `Only ${claimedCount} of ${timeEntryIds.length} time entries could be claimed — the rest were already invoiced or changed by another request. Refresh and try again.`,
      }, { status: 409 })
    }
  }

  return NextResponse.json(mapInvoice(data), { status: 201 })
})
