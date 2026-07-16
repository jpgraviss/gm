import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlaybook(row: any) {
  return {
    id:          row.id,
    workspaceId: row.workspace_id,
    title:       row.title,
    category:    row.category ?? undefined,
    content:     row.content ?? '',
    tags:        row.tags ?? [],
    status:      row.status,
    createdBy:   row.created_by ?? undefined,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

export const GET = withErrorHandler('playbooks GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const pag = parsePagination(req)
  const db = createServiceClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  let query = db
    .from('playbooks')
    .select('*')
  if (category) query = query.eq('category', category)
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch playbooks')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapPlaybook), nextCursor)
})

export const POST = withErrorHandler('playbooks POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

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
    throw new Error(error?.message || 'Failed to create playbook')
  }

  logAudit({ userName: 'system', action: 'created_playbook', module: 'playbooks', type: 'action', metadata: { playbookId: data.id, title: data.title } })
  return NextResponse.json(mapPlaybook(data), { status: 201 })
})
