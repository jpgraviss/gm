import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole, getAuthUser } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

// AUDIT #688 — deletion was an unscoped delete-by-id, so any Team Member
// could destroy any colleague's saved filter. Smart lists are intentionally
// org-wide to *read* (SmartListBar renders everyone's), but that's not a
// reason anyone can delete someone else's work. Restricted to the creator,
// with managers and above kept as an escape hatch for cleaning up after a
// departed team member.
const ELEVATED_ROLES = new Set(['Dept Manager', 'Department Manager', 'Leadership', 'Super Admin'])

export const DELETE = withErrorHandler('saved-filters/[id] DELETE', async (req, ctx) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await ctx!.params
  const db = createServiceClient()

  const { data: filter } = await db
    .from('saved_filters')
    .select('created_by')
    .eq('id', id)
    .maybeSingle()
  if (!filter) {
    return NextResponse.json({ error: 'Saved filter not found' }, { status: 404 })
  }

  const actor = await getAuthUser(req)
  const isElevated = !!actor && (actor.isAdmin === true || ELEVATED_ROLES.has(actor.role ?? ''))
  // created_by is nullable on rows predating attribution — treat those as
  // unowned so they stay cleanable rather than orphaned permanently.
  const isOwner = !filter.created_by
    || (!!actor?.name && filter.created_by === actor.name)
    || (!!actor?.email && filter.created_by === actor.email)

  if (!isOwner && !isElevated) {
    return NextResponse.json({ error: 'You can only delete smart lists you created' }, { status: 403 })
  }

  const { error } = await db.from('saved_filters').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json({ success: true })
})
