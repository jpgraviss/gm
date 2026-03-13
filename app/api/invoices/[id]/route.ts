import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.status !== undefined)   update.status = body.status
  if (body.amount !== undefined)   update.amount = body.amount
  if (body.dueDate !== undefined)  update.due_date = body.dueDate
  if (body.paidDate !== undefined) update.paid_date = body.paidDate
  const { data, error } = await db.from('invoices').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[invoices/:id PATCH]', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('invoices').delete().eq('id', id)
  if (error) {
    console.error('[invoices/:id DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
