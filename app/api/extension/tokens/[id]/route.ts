import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { withErrorHandler } from '@/lib/api-handler'

async function currentTeamMemberId(req: NextRequest): Promise<string | null> {
  const email = await getAuthenticatedEmail(req)
  if (!email) return null
  const db = createServiceClient()
  const { data } = await db.from('team_members').select('id').eq('email', email).maybeSingle()
  return data?.id ?? null
}

export const DELETE = withErrorHandler('extension/tokens/[id] DELETE', async (req, ctx) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const teamMemberId = await currentTeamMemberId(req)
  if (!teamMemberId) return NextResponse.json({ error: 'Could not resolve caller' }, { status: 401 })

  const { id } = await ctx!.params
  const db = createServiceClient()

  // Ownership check — a staff member can only revoke their own extension
  // tokens, not another team member's.
  const { data: existing } = await db.from('extension_tokens').select('team_member_id').eq('id', id).maybeSingle()
  if (!existing || existing.team_member_id !== teamMemberId) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  const { error } = await db.from('extension_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)

  return NextResponse.json({ success: true })
})
