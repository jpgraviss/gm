import { NextRequest, NextResponse } from 'next/server'
import { listAccounts } from '@/lib/mercury'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('mercury/accounts GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  try {
    const accounts = await listAccounts()
    return NextResponse.json({ accounts })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Mercury API error'
    const status = msg.includes('not configured') ? 400 : 502
    return NextResponse.json({ error: msg }, { status })
  }
})
