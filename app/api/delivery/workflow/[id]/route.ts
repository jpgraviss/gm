import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing workflow id' }, { status: 400 })

  const db = createServiceClient()

  const [workflowRes, eventsRes] = await Promise.all([
    db.from('delivery_workflows').select('*').eq('id', id).single(),
    db.from('delivery_events').select('*').eq('workflow_id', id).order('created_at', { ascending: false }),
  ])

  if (workflowRes.error) {
    console.error('[delivery/workflow GET]', workflowRes.error)
    const status = workflowRes.error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: workflowRes.error.message }, { status })
  }

  return NextResponse.json({
    ...workflowRes.data,
    events: eventsRes.data ?? [],
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing workflow id' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from('delivery_workflows').delete().eq('id', id)

  if (error) {
    console.error('[delivery/workflow DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
