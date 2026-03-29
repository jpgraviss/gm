import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import crypto from 'crypto'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
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

    // Fetch contract details
    const { data: contract } = await db
      .from('contracts')
      .select('company, value, service_type')
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
      contract: contract ? {
        company: contract.company,
        value: contract.value,
        serviceType: contract.service_type,
      } : null,
    })
  } catch (err) {
    console.error('Signature GET by token error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
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

    // Update the signature request
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
      .select()
      .single()

    if (updateErr) {
      console.error('[signature PATCH]', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // If a client just signed, auto-create an internal signature request
    if (sigReq.type === 'client') {
      try {
        // Look up the contract's service_type
        const { data: contract } = await db
          .from('contracts')
          .select('company, value, service_type')
          .eq('id', sigReq.contract_id)
          .single()

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

    // Check if both client and internal signatures are done for this contract
    const { data: allSigs } = await db
      .from('signature_requests')
      .select('type, status')
      .eq('contract_id', sigReq.contract_id)

    const clientSigned = allSigs?.some(s => s.type === 'client' && s.status === 'signed')
    const internalSigned = allSigs?.some(s => s.type === 'internal' && s.status === 'signed')

    if (clientSigned && internalSigned) {
      // Both signed — update contract to Fully Executed
      const today = new Date().toISOString().split('T')[0]
      await db
        .from('contracts')
        .update({
          status: 'Fully Executed',
          client_signed: today,
          internal_signed: today,
        })
        .eq('id', sigReq.contract_id)
    } else if (clientSigned) {
      // Only client signed — countersign needed
      const today = new Date().toISOString().split('T')[0]
      await db
        .from('contracts')
        .update({
          status: 'Countersign Needed',
          client_signed: today,
        })
        .eq('id', sigReq.contract_id)
    } else if (internalSigned) {
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
  } catch (err) {
    console.error('Signature PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
