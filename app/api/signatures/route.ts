import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import crypto from 'crypto'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('signatures GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
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
    throw new Error(error?.message || 'Failed to fetch signatures')
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
})

export const POST = withErrorHandler('signatures POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
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
    throw new Error(error?.message || 'Failed to create signature request')
  }

  // Fetch contract details for the email and document hash
  const { data: contract } = await db
    .from('contracts')
    .select('company, value, service_type, items, notes, start_date, end_date')
    .eq('id', contractId)
    .single()

  // Generate SHA-256 hash of the contract terms for audit trail
  const documentHash = contract
    ? crypto.createHash('sha256').update(JSON.stringify({
        company: contract.company,
        value: contract.value,
        service_type: contract.service_type,
        items: contract.items,
        notes: contract.notes,
        start_date: contract.start_date,
        end_date: contract.end_date,
      })).digest('hex')
    : null

  // Store the document hash on the signature request
  if (documentHash) {
    await db
      .from('signature_requests')
      .update({ document_hash: documentHash })
      .eq('id', id)
  }

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
})
