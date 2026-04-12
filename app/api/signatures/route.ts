import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import crypto from 'crypto'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    const contractId = req.nextUrl.searchParams.get('contractId')
    if (!contractId) {
      return NextResponse.json({ error: 'contractId query param is required' }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from('signature_requests')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[signatures GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Map snake_case → camelCase for the frontend
    const mapped = (data ?? []).map(row => ({
      id: row.id,
      contractId: row.contract_id,
      token: row.token,
      signerEmail: row.signer_email,
      signerName: row.signer_name,
      type: row.type,
      status: row.status,
      signedAt: row.signed_at,
      signerIp: row.signer_ip,
      signatureData: row.signature_data,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }))

    return NextResponse.json(mapped)
  } catch (err) {
    console.error('Signatures GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { contractId, signerEmail, signerName, type } = await req.json()

    if (!contractId || !signerEmail) {
      return NextResponse.json({ error: 'contractId and signerEmail are required' }, { status: 400 })
    }

    const db = createServiceClient()
    const token = crypto.randomUUID()
    const id = `sig-${Date.now()}`

    const { data, error } = await db
      .from('signature_requests')
      .insert({
        id,
        contract_id: contractId,
        token,
        signer_email: signerEmail,
        signer_name: signerName || null,
        type: type || 'client',
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('[signatures POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch contract details for the email
    const { data: contract } = await db
      .from('contracts')
      .select('company, value, service_type')
      .eq('id', contractId)
      .single()

    // Send signing email
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
      await fetch(`${appUrl}/api/email/sign-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signerEmail,
          signerName: signerName || null,
          company: contract?.company ?? '',
          value: contract?.value ?? 0,
        }),
      })
    } catch (emailErr) {
      console.error('Failed to send signing email:', emailErr)
      // Don't fail the request — the signature request was still created
    }

    const mapped = {
      id: data.id,
      contractId: data.contract_id,
      token: data.token,
      signerEmail: data.signer_email,
      signerName: data.signer_name,
      type: data.type,
      status: data.status,
      signedAt: data.signed_at,
      signerIp: data.signer_ip,
      signatureData: data.signature_data,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    }

    logAudit({ userName: 'system', action: 'signature_requested', module: 'contracts', type: 'action', metadata: { contractId, signerEmail } })
    return NextResponse.json(mapped, { status: 201 })
  } catch (err) {
    console.error('Signatures POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
