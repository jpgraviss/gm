import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, isConfigured } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (!isConfigured) {
    return NextResponse.json({ id, ...body })
  }
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.status !== undefined)            update.status = body.status
  if (body.value !== undefined)             update.value = body.value
  if (body.clientSigned !== undefined)      update.client_signed = body.clientSigned
  if (body.internalSigned !== undefined)    update.internal_signed = body.internalSigned
  if (body.assignedRep !== undefined)       update.assigned_rep = body.assignedRep
  if (body.billingStructure !== undefined)  update.billing_structure = body.billingStructure
  if (body.renewalDate !== undefined)       update.renewal_date = body.renewalDate

  const { data, error } = await db.from('contracts').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isConfigured) {
    return NextResponse.json({ deleted: id })
  }
  const db = createServiceClient()
  const { error } = await db.from('contracts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}
