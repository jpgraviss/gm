import { NextRequest, NextResponse } from 'next/server'
import { listAccounts, listTransactions } from '@/lib/mercury'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { isNotConfigured } from '@/lib/integration-not-configured'

export const GET = withErrorHandler('mercury/transactions GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const start = searchParams.get('start') ?? undefined
  const end = searchParams.get('end') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const search = searchParams.get('search') ?? undefined

  try {
    let acctId = accountId
    if (!acctId) {
      const accounts = await listAccounts()
      if (!accounts.length) {
        return NextResponse.json({ error: 'No Mercury accounts found' }, { status: 404 })
      }
      acctId = accounts[0].id
    }

    const data = await listTransactions(acctId, { limit, offset, start, end, status, search })
    return NextResponse.json(data)
  } catch (err) {
    // AUDIT #778 — an unconfigured Mercury is no longer mapped to 400 here.
    // Rethrow so withErrorHandler answers 503 with the same shape every
    // other integration now uses; a real upstream failure still 502s below.
    if (isNotConfigured(err)) throw err
    const msg = err instanceof Error ? err.message : 'Mercury API error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
})
