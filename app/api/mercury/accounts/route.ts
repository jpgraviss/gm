import { NextResponse } from 'next/server'
import { listAccounts } from '@/lib/mercury'

export async function GET() {
  try {
    const accounts = await listAccounts()
    return NextResponse.json({ accounts })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Mercury API error'
    const status = msg.includes('not configured') ? 400 : 502
    return NextResponse.json({ error: msg }, { status })
  }
}
