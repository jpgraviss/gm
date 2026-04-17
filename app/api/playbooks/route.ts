import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlaybook(row: any) {
  return {
    id:          row.id,
    workspaceId: row.workspace_id,
    title:       row.title,
    category:    row.category ?? '',
    content:     row.content ?? '',
    tags:        row.tags ?? [],
    status:      row.status,
    createdBy:   row.created_by ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const { limit, cursor } = parsePagination(req)
  const db = createServiceClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  let query = db
    .from('playbooks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (cursor) query = query.lt('created_at', cursor)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) {
    console.error('[playbooks GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], limit, 'created_at')
  return paginatedJson(rows.map(mapPlaybook), nextCursor)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data, error } = await db
    .from('playbooks')
    .insert({
      id:           `pb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workspace_id: body.workspaceId ?? null,
      title:        body.title,
      category:     body.category ?? null,
      content:      body.content ?? null,
      tags:         body.tags ?? [],
      status:       body.status ?? 'Active',
      created_by:   body.createdBy ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[playbooks POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logAudit({ userName: 'system', action: 'created_playbook', module: 'sales_enablement', type: 'action', metadata: { playbookId: data.id, title: data.title } })
  return NextResponse.json(mapPlaybook(data), { status: 201 })
}
