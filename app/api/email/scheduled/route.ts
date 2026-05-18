import { NextRequest, NextResponse } from 'next/server'
import { scheduleEmail, getScheduledEmails, cancelScheduledEmail } from '@/lib/email-scheduler'
import { validate, validationError } from '@/lib/validation'

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const type = req.nextUrl.searchParams.get('type') ?? undefined
  const limit = req.nextUrl.searchParams.get('limit') ? parseInt(req.nextUrl.searchParams.get('limit')!, 10) : 50
  const offset = req.nextUrl.searchParams.get('offset') ? parseInt(req.nextUrl.searchParams.get('offset')!, 10) : 0

  try {
    const emails = await getScheduledEmails({ status, type, limit, offset })
    return NextResponse.json(emails)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = validate(body, {
    to: { required: true, type: 'string', maxLength: 320 },
    subject: { required: true, type: 'string', maxLength: 500 },
    html: { required: true, type: 'string' },
    sendAt: { required: true, type: 'string' },
    type: { type: 'string', enum: ['report', 'template', 'broadcast', 'notification'] },
    recurring: { type: 'string', enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly'] },
  })
  if (!result.valid) return validationError(result.error)

  try {
    const scheduled = await scheduleEmail({
      to: body.to,
      toName: body.toName,
      subject: body.subject,
      html: body.html,
      sendAt: body.sendAt,
      type: body.type,
      recurring: body.recurring,
      metadata: body.metadata,
      createdBy: body.createdBy,
    })
    return NextResponse.json(scheduled, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to schedule' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })

  try {
    const cancelled = await cancelScheduledEmail(id)
    return NextResponse.json(cancelled)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to cancel' }, { status: 500 })
  }
}
