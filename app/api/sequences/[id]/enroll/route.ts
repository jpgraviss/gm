import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { contacts } = await req.json() as { contacts: { id?: string; name: string; email: string }[] }

  if (!contacts?.length) {
    return NextResponse.json({ error: 'contacts array required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Fetch the sequence to get steps and counts
  const { data: seq, error: seqErr } = await db
    .from('sequences')
    .select('steps, enrolled_count, active_count')
    .eq('id', id)
    .single()
  if (seqErr || !seq) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: any[] = seq.steps ?? []
  const firstDays: number = steps[0]?.day ?? 0

  // Check for already-enrolled contacts to avoid duplicates
  const emails = contacts.filter(c => c.email).map(c => c.email)
  const { data: existing } = await db
    .from('sequence_enrollments')
    .select('contact_email')
    .eq('sequence_id', id)
    .in('contact_email', emails)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alreadyEnrolled = new Set((existing ?? []).map((r: any) => r.contact_email as string))

  const toEnroll = contacts.filter(c => c.email && !alreadyEnrolled.has(c.email))
  if (!toEnroll.length) return NextResponse.json({ enrolled: 0 })

  const now = new Date()
  const nextSendAt = new Date(now.getTime() + firstDays * 24 * 60 * 60 * 1000)

  const rows = toEnroll.map(c => ({
    id: `enr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sequence_id: id,
    contact_id: c.id ?? null,
    contact_name: c.name,
    contact_email: c.email,
    current_step: 0,
    status: 'active',
    next_send_at: nextSendAt.toISOString(),
  }))

  const { error: insertErr } = await db.from('sequence_enrollments').insert(rows)
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Update sequence aggregate counts
  await db
    .from('sequences')
    .update({
      enrolled_count: (seq.enrolled_count ?? 0) + toEnroll.length,
      active_count: (seq.active_count ?? 0) + toEnroll.length,
      last_modified: now.toISOString().split('T')[0],
    })
    .eq('id', id)

  return NextResponse.json({ enrolled: toEnroll.length })
}
