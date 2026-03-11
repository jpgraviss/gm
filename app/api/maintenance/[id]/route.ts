import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.status !== undefined)             update.status = body.status
  if (body.monthlyFee !== undefined)         update.monthly_fee = body.monthlyFee
  if (body.nextBillingDate !== undefined)    update.next_billing_date = body.nextBillingDate
  if (body.documents !== undefined)         update.documents = body.documents
  if (body.cancellationWindow !== undefined) update.cancellation_window = body.cancellationWindow
  const { data, error } = await db.from('maintenance_records').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('maintenance_records').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: id })
}
