import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const db = createServiceClient()
  const { data: pipelines, error: pErr } = await db
    .from('pipelines')
    .select('*')
    .eq('active', true)
    .order('display_order')

  if (pErr) {
    console.error('[pipelines GET]', pErr)
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  const { data: stages, error: sErr } = await db
    .from('pipeline_stages')
    .select('*')
    .order('display_order')

  if (sErr) {
    console.error('[pipelines GET stages]', sErr)
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }

  const result = (pipelines ?? []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    stages: (stages ?? [])
      .filter(s => s.pipeline_id === p.id)
      .map(s => ({
        id: s.id,
        name: s.name,
        color: s.color,
        probability: s.probability,
        displayOrder: s.display_order,
      })),
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, name, description, stages } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const pipelineId = id || `pipeline-${Date.now()}`

  const { error: pErr } = await db
    .from('pipelines')
    .upsert({
      id: pipelineId,
      name: name.trim(),
      description: description?.trim() || null,
      display_order: body.displayOrder ?? 0,
    })

  if (pErr) {
    console.error('[pipelines POST]', pErr)
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  if (Array.isArray(stages)) {
    await db.from('pipeline_stages').delete().eq('pipeline_id', pipelineId)
    const stageRows = stages.map((s: { id?: string; name: string; color?: string; probability?: number }, i: number) => ({
      id: s.id || `${pipelineId}-stage-${i}`,
      pipeline_id: pipelineId,
      name: s.name,
      color: s.color ?? '#015035',
      probability: s.probability ?? 0,
      display_order: i,
    }))
    const { error: sErr } = await db.from('pipeline_stages').insert(stageRows)
    if (sErr) {
      console.error('[pipelines POST stages]', sErr)
      return NextResponse.json({ error: sErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: pipelineId, name: name.trim() }, { status: 201 })
}
