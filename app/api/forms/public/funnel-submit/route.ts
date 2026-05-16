import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { funnelSlug, data } = body

  if (!funnelSlug || !data) {
    return NextResponse.json({ error: 'Missing funnelSlug or data' }, { status: 400, headers: corsHeaders })
  }

  const db = createServiceClient()

  const { data: funnel } = await db
    .from('funnels')
    .select('id')
    .eq('slug', funnelSlug)
    .single()

  if (!funnel) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404, headers: corsHeaders })
  }

  const submissionId = `fsub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await db.from('form_submissions').insert({
    id: submissionId,
    form_id: `funnel:${funnel.id}`,
    data,
    source_url: req.headers.get('referer') ?? null,
    status: 'new',
  })

  const { data: firstPage } = await db
    .from('funnel_pages')
    .select('id, conversions')
    .eq('funnel_id', funnel.id)
    .order('sort_order', { ascending: true })
    .limit(1)
    .single()

  if (firstPage) {
    await db
      .from('funnel_pages')
      .update({ conversions: (firstPage.conversions ?? 0) + 1 })
      .eq('id', firstPage.id)
  }

  return NextResponse.json({ success: true, id: submissionId }, { status: 201, headers: corsHeaders })
}
