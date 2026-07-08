import { NextRequest, NextResponse } from 'next/server'
import { processScheduledEmails } from '@/lib/email-scheduler'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('email/scheduled/process POST', async (req: NextRequest) => {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  const expected = process.env.CRON_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processScheduledEmails()
  return NextResponse.json(result)
})
