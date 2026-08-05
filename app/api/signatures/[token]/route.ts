import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import crypto from 'crypto'
import { logAudit } from '@/lib/audit'
import { computeContractDocumentHash } from '@/lib/contract-hash'
import { fireAutomations } from '@/lib/automations-engine'
import { onContractFullyExecuted } from '@/lib/delivery-sync'

export const GET = withErrorHandler('signatures/[token] GET', async (
  _req,
  { params }: { params: Promise<{ token: string }> }
) => {
  const { token } = await params
  const db = createServiceClient()

  const { data: sigReq, error } = await db
    .from('signature_requests')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !sigReq) {
    return NextResponse.json({ error: 'Signature request not found' }, { status: 404 })
  }

  // Fetch contract details including scope/terms
  const { data: contract } = await db
    .from('contracts')
    .select('company, value, service_type, items, notes, start_date, end_date, billing_cycle, status')
    .eq('id', sigReq.contract_id)
    .single()

  return NextResponse.json({
    id: sigReq.id,
    contractId: sigReq.contract_id,
    token: sigReq.token,
    signerEmail: sigReq.signer_email,
    signerName: sigReq.signer_name,
    type: sigReq.type,
    status: sigReq.status,
    signedAt: sigReq.signed_at,
    signerIp: sigReq.signer_ip,
    createdAt: sigReq.created_at,
    expiresAt: sigReq.expires_at,
    documentHash: sigReq.document_hash,
    contract: contract ? {
      company: contract.company,
      value: contract.value,
      serviceType: contract.service_type,
      items: contract.items,
      notes: contract.notes,
      startDate: contract.start_date,
      endDate: contract.end_date,
      billingCycle: contract.billing_cycle,
      status: contract.status,
    } : null,
  })
})

export const PATCH = withErrorHandler('signatures/[token] PATCH', async (
  req,
  { params }: { params: Promise<{ token: string }> }
) => {
  const { token } = await params
  const { signerName, signatureData, companyName, signatureDate } = await req.json()

  if (!signatureData) {
    return NextResponse.json({ error: 'signatureData is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const signerIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  // Fetch current signature request
  const { data: sigReq, error: fetchErr } = await db
    .from('signature_requests')
    .select('*')
    .eq('token', token)
    .single()

  if (fetchErr || !sigReq) {
    return NextResponse.json({ error: 'Signature request not found' }, { status: 404 })
  }

  if (sigReq.status === 'signed') {
    return NextResponse.json({ error: 'Already signed' }, { status: 400 })
  }

  // Check expiry
  if (sigReq.expires_at && new Date(sigReq.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Signature request has expired' }, { status: 400 })
  }

  // Fetch the contract's current terms — reused below both to verify the
  // document hash and (for a client signature) to look up the internal
  // signer's service type, so this is the single fetch for both purposes.
  const { data: contract } = await db
    .from('contracts')
    .select('company, value, service_type, items, notes, start_date, end_date, status')
    .eq('id', sigReq.contract_id)
    .single()

  // AUDIT.md #497 — document_hash was computed once at request creation but
  // never re-verified at signing time, so a contract edited after the sign
  // link went out could be silently signed under its old, already-sent
  // terms while the client (correctly) sees and signs the live current
  // values. Recompute the identical hash now and block signing on a
  // mismatch rather than let that happen unnoticed. A null document_hash
  // (pre-#497 requests, or the contract fetch failing at creation time)
  // has nothing to compare against, so it's not treated as a mismatch.
  if (sigReq.document_hash && contract) {
    const currentHash = computeContractDocumentHash(contract)
    if (currentHash !== sigReq.document_hash) {
      return NextResponse.json({
        error: 'This contract’s terms have changed since this signature request was sent. Please request a new signature link.',
      }, { status: 409 })
    }
  }

  // AUDIT #496 — conditional on status still being 'pending', matching the
  // atomic-claim pattern #81 established on
  // /api/reputation/review-request/[token]. The status/expiry checks above
  // read a snapshot that a near-simultaneous second submission (e.g. the
  // same signing link opened on two devices, or a replayed request) could
  // also pass before either write lands. Only the request whose UPDATE
  // actually claims the row (returns a row) proceeds — this prevents
  // duplicate internal-signature-request creation and duplicate signer
  // emails below.
  const { data: updated, error: updateErr } = await db
    .from('signature_requests')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signer_ip: signerIp,
      signer_name: signerName || sigReq.signer_name,
      signature_data: signatureData,
      company_name: companyName || null,
      signature_date: signatureDate || new Date().toISOString().split('T')[0],
    })
    .eq('token', token)
    .eq('status', 'pending')
    .select()
    .maybeSingle()

  if (updateErr) {
    throw new Error(updateErr?.message || 'Failed to update signature')
  }
  if (!updated) {
    return NextResponse.json({ error: 'Already signed' }, { status: 400 })
  }

  // Audit log for signature recording
  logAudit({
    userName: signerName || sigReq.signer_name || sigReq.signer_email,
    action: 'signature_signed',
    module: 'contracts',
    type: 'action',
    metadata: {
      contractId: sigReq.contract_id,
      signerEmail: sigReq.signer_email,
      signerIp,
      documentHash: sigReq.document_hash || null,
    },
  })

  // If a client just signed, auto-create an internal signature request
  if (sigReq.type === 'client') {
    try {
      // Reuses the contract row already fetched above for the document-hash
      // check — same row, no need for a second query.
      // Determine internal signer based on service type
      const serviceType = (contract?.service_type || '').toLowerCase()
      const isSales = serviceType.includes('sales')
      const internalSignerName = isSales ? 'JG Graviss' : 'Jonathan Graviss'
      const internalSignerEmail = isSales
        ? 'jgraviss@gravissmarketing.com'
        : 'jonathan@gravissmarketing.com'

      // Create internal signature request
      const internalToken = crypto.randomUUID()
      const internalId = `sig-${Date.now()}`

      // AUDIT #515 — this insert never set document_hash, so the mismatch
      // check above (`if (sigReq.document_hash && contract)`) silently
      // skipped for every internal countersignature: a contract edited
      // between the client's signature and the internal countersignature
      // went undetected, exactly the scenario #497 was built to catch, just
      // uncovered for this one signer type. Same contract row already
      // fetched above, same helper #497's client-facing request uses.
      await db
        .from('signature_requests')
        .insert({
          id: internalId,
          contract_id: sigReq.contract_id,
          token: internalToken,
          signer_email: internalSignerEmail,
          signer_name: internalSignerName,
          type: 'internal',
          status: 'pending',
          document_hash: contract ? computeContractDocumentHash(contract) : null,
        })

      // Send signing email to the internal signer
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
      await fetch(`${appUrl}/api/email/sign-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: internalToken,
          signerEmail: internalSignerEmail,
          signerName: internalSignerName,
          company: contract?.company ?? '',
          value: contract?.value ?? 0,
        }),
      })
    } catch (internalErr) {
      console.error('Failed to create internal signature request:', internalErr)
      // Don't fail the client's signature — the internal request is a follow-up
    }
  }

  // Check if both client and internal signatures are done for this contract.
  // AUDIT #691 — if the contract was independently moved to a terminal state
  // (Terminated/Expired) after this sign link went out, a client completing
  // a still-pending signature shouldn't be able to push it back to Fully
  // Executed / Countersign Needed, bypassing the transition graph
  // app/api/contracts/[id]/route.ts's VALID_TRANSITIONS enforces everywhere
  // else. Not importing that map here (it's a local, unexported PATCH-route
  // concern) — a plain terminal-state check covers the real risk.
  const contractIsTerminal = contract?.status === 'Terminated' || contract?.status === 'Expired'

  const { data: allSigs } = await db
    .from('signature_requests')
    .select('type, status')
    .eq('contract_id', sigReq.contract_id)

  const clientSigned = allSigs?.some(s => s.type === 'client' && s.status === 'signed')
  const internalSigned = allSigs?.some(s => s.type === 'internal' && s.status === 'signed')

  if (!contractIsTerminal && clientSigned && internalSigned) {
    // Both signed — update contract to Fully Executed
    const today = new Date().toISOString().split('T')[0]
    const { data: executedContract } = await db
      .from('contracts')
      .update({
        status: 'Fully Executed',
        client_signed: today,
        internal_signed: today,
      })
      .eq('id', sigReq.contract_id)
      .select()
      .maybeSingle()

    // AUDIT #691 — this is the real, intended path a contract gets fully
    // executed through (a client signing via /sign/[token]), but unlike the
    // staff-manual-status-change path in app/api/contracts/[id]/route.ts,
    // this route never fired the 'contract_executed' automation trigger —
    // any automation built on "Contract Fully Executed" (auto-create
    // project, onboarding notification, etc.) silently never ran for a
    // genuinely-signed contract. Mirrors the PATCH route's own call.
    if (executedContract) {
      fireAutomations('contract_executed', { contractId: sigReq.contract_id, ...executedContract })
      // Delivery step 1 ("Contract Signed") used to sit Pending until a
      // staff member remembered to tick it on the Delivery dashboard — even
      // though this is the exact moment the app learns the contract is
      // signed, and the client sees that same step on /client/workflow.
      onContractFullyExecuted(executedContract)
    }
  } else if (!contractIsTerminal && clientSigned) {
    // Only client signed — countersign needed
    const today = new Date().toISOString().split('T')[0]
    await db
      .from('contracts')
      .update({
        status: 'Countersign Needed',
        client_signed: today,
      })
      .eq('id', sigReq.contract_id)
  } else if (!contractIsTerminal && internalSigned) {
    // Only internal signed
    const today = new Date().toISOString().split('T')[0]
    await db
      .from('contracts')
      .update({
        status: 'Countersign Needed',
        internal_signed: today,
      })
      .eq('id', sigReq.contract_id)
  }

  return NextResponse.json({
    id: updated.id,
    contractId: updated.contract_id,
    token: updated.token,
    signerEmail: updated.signer_email,
    signerName: updated.signer_name,
    type: updated.type,
    status: updated.status,
    signedAt: updated.signed_at,
    signerIp: updated.signer_ip,
    createdAt: updated.created_at,
    expiresAt: updated.expires_at,
  })
})
