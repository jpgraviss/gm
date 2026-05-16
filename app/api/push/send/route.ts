import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push-notifications'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, title, body: notifBody, url } = body

  if (!userId || !title) {
    return NextResponse.json({ error: 'userId and title are required' }, { status: 400 })
  }

  try {
    const result = await sendPushNotification({
      userId,
      title,
      body: notifBody ?? '',
      url,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[push/send POST]', err)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}
