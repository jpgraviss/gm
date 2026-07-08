import { NextRequest, NextResponse } from 'next/server'
import { listAccounts, listTransactions } from '@/lib/mercury'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('mercury/transactions GET', async (req) => {
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
    const msg = err instanceof Error ? err.message : 'Mercury API error'
    const status_code = msg.includes('not configured') ? 400 : 502
    return NextResponse.json({ error: msg }, { status: status_code })
  }
})
