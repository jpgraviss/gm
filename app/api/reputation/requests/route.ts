import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const db = createServiceClient()
  const { data: campaigns, error } = await db
    .from('review_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[reputation/requests GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ campaigns: campaigns ?? [], templates: {} })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, template, audience, scheduled_at, workspace_id } = body as {
    name: string
    template: string
    audience: string
    scheduled_at: string | null
    workspace_id?: string
  }

  if (!name || !template || !audience) {
    return NextResponse.json({ error: 'name, template, and audience are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('review_campaigns')
    .insert({
      workspace_id: workspace_id ?? null,
      name,
      template,
      audience,
      sent_count: 0,
      opened_count: 0,
      reviews_count: 0,
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[reputation/requests POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
