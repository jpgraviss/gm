import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'

const ADDENDUM_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined'] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAddendum(row: any) {
  return {
    id:          row.id,
    contractId:  row.contract_id,
    title:       row.title,
    description: row.description,
    status:      row.status,
    createdDate: row.created_at?.split('T')[0] ?? '',
    sentDate:    row.sent_at?.split('T')[0] ?? undefined,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('contract_addendums')
    .select('*')
    .eq('contract_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[addendums GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json((data ?? []).map(mapAddendum))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params
  const body = await req.json()

  const result = validate(body, {
    title:       { required: true, type: 'string', maxLength: 300 },
    description: { required: true, type: 'string', maxLength: 5000 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  // Verify the contract exists
  const { data: contract, error: cErr } = await db
    .from('contracts')
    .select('id')
    .eq('id', contractId)
    .single()
  if (cErr || !contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  const { data, error } = await db
    .from('contract_addendums')
    .insert({
      id: `add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      contract_id: contractId,
      title: body.title,
      description: body.description,
      status: 'Draft',
    })
    .select()
    .single()

  if (error) {
    console.error('[addendums POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(mapAddendum(data), { status: 201 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // This PATCH uses a query param ?addendumId=xxx to identify the addendum
  const { id: contractId } = await params
  const body = await req.json()
  const addendumId = body.addendumId

  if (!addendumId) {
    return NextResponse.json({ error: 'addendumId is required' }, { status: 400 })
  }

  const result = validate(body, {
    status: { type: 'string', enum: [...ADDENDUM_STATUSES] },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  const update: Record<string, unknown> = {}
  if (body.status !== undefined) {
    update.status = body.status
    if (body.status === 'Sent') {
      update.sent_at = new Date().toISOString()
    }
  }

  const { data, error } = await db
    .from('contract_addendums')
    .update(update)
    .eq('id', addendumId)
    .eq('contract_id', contractId)
    .select()
    .single()

  if (error) {
    console.error('[addendums PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(mapAddendum(data))
}
