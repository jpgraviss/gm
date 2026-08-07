import { NextRequest, NextResponse } from 'next/server'
import { listAccounts } from '@/lib/mercury'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { isNotConfigured } from '@/lib/integration-not-configured'

export const GET = withErrorHandler('mercury/accounts GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  try {
    const accounts = await listAccounts()
    return NextResponse.json({ accounts })
  } catch (err) {
    // AUDIT #778 — an unconfigured Mercury is no longer mapped to 400 here.
    // Rethrow so withErrorHandler answers 503 with the same shape every
    // other integration now uses; a real upstream failure still 502s below.
    if (isNotConfigured(err)) throw err
    const msg = err instanceof Error ? err.message : 'Mercury API error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
})
