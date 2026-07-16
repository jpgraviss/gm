import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

export const DELETE = withErrorHandler('saved-filters/[id] DELETE', async (req, ctx) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await ctx!.params
  const db = createServiceClient()
  const { error } = await db.from('saved_filters').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json({ success: true })
})
