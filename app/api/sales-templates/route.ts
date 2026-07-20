import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'

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

export const GET = withErrorHandler('sales-templates GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

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
    throw new Error(error.message || 'Failed to fetch templates')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapTemplate), nextCursor)
})

export const POST = withErrorHandler('sales-templates POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const body = await req.json()

  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // If useTemplate flag is set, increment usage_count on an existing
  // template. Uses increment_template_usage() (AUDIT #167) — the whole
  // read-modify-write happens inside one atomic UPDATE, under the row's
  // own lock, instead of a separate SELECT + write that two concurrent
  // callers could race.
  if (body.useTemplate && body.id) {
    const { error: rpcErr } = await db.rpc('increment_template_usage', { p_id: body.id })
    if (rpcErr) {
      console.error('[sales-templates POST useTemplate]', rpcErr)
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    const { data, error } = await db
      .from('sales_templates')
      .select()
      .eq('id', body.id)
      .single()
    if (error || !data) {
      throw new Error(error?.message || 'Failed to load updated template')
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
    throw new Error(error.message || 'Failed to create template')
  }

  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'created_sales_template', module: 'sales-templates', type: 'action', metadata: { templateId: data.id, title: data.title } })
  return NextResponse.json(mapTemplate(data), { status: 201 })
})
