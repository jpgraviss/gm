import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplate(row: any) {
  return {
    id:          row.id,
    workspaceId: row.workspace_id,
    title:       row.title,
    category:    row.category ?? undefined,
    content:     row.content ?? '',
    subject:     row.subject ?? undefined,
    tags:        row.tags ?? [],
    usageCount:  row.usage_count ?? 0,
    status:      row.status,
    createdBy:   row.created_by ?? undefined,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const pag = parsePagination(req)
  const db = createServiceClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  let query = db
    .from('sales_templates')
    .select('*')
  if (category) query = query.eq('category', category)
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    console.error('[sales-templates GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapTemplate), nextCursor)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // If useTemplate flag is set, increment usage_count on an existing template
  if (body.useTemplate && body.id) {
    const { data: existing, error: fetchErr } = await db
      .from('sales_templates')
      .select('usage_count')
      .eq('id', body.id)
      .single()
    if (fetchErr || !existing) {
      console.error('[sales-templates POST useTemplate]', fetchErr)
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    const { data, error } = await db
      .from('sales_templates')
      .update({ usage_count: (existing.usage_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .select()
      .single()
    if (error || !data) {
      console.error('[sales-templates POST useTemplate update]', error)
      return NextResponse.json({ error: error?.message || 'Failed to increment usage' }, { status: 500 })
    }
    return NextResponse.json(mapTemplate(data))
  }

  const { data, error } = await db
    .from('sales_templates')
    .insert({
      id:           `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workspace_id: body.workspaceId ?? null,
      title:        body.title,
      category:     body.category ?? null,
      content:      body.content ?? null,
      subject:      body.subject ?? null,
      tags:         body.tags ?? [],
      usage_count:  0,
      status:       body.status ?? 'Active',
      created_by:   body.createdBy ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[sales-templates POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logAudit({ userName: 'system', action: 'created_sales_template', module: 'sales-templates', type: 'action', metadata: { templateId: data.id, title: data.title } })
  return NextResponse.json(mapTemplate(data), { status: 201 })
}
