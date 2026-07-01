import { NextRequest, NextResponse } from 'next/server'
import { listPeople, getPerson, getPersonEvents } from '@/lib/maverick'

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const id = params.get('id')
  const events = params.get('events')
  const limit = params.get('limit') ?? '50'
  const cursor = params.get('cursor') ?? undefined
  const since = params.get('since') ?? undefined

  try {
    if (id && events) {
      const data = await getPersonEvents(id, { limit: Number(limit), cursor })
      return NextResponse.json(data)
    }

    if (id) {
      const person = await getPerson(id)
      return NextResponse.json(person)
    }

    const result = await listPeople({ limit: Number(limit), cursor, since })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg.includes('429') ? 429 : msg.includes('401') || msg.includes('403') ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
