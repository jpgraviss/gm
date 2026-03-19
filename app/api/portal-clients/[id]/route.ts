import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.company   !== undefined) update.company    = body.company
  if (body.service   !== undefined) update.service    = body.service
  if (body.access    !== undefined) update.access     = body.access
  if (body.lastLogin !== undefined) update.last_login = body.lastLogin
  if (body.contact   !== undefined) update.contact    = body.contact
  if (body.email     !== undefined) update.email      = body.email
  const { data, error } = await db.from('portal_clients').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[portal-clients/:id PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update portal client' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('portal_clients').delete().eq('id', id)
  if (error) {
    console.error('[portal-clients/:id DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete portal client' }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
