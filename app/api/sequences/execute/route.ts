import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST() {
  const db = createServiceClient()
  const now = new Date()

  // Fetch all active enrollments that are due
  const { data: enrollments, error: fetchErr } = await db
    .from('sequence_enrollments')
    .select('*')
    .eq('status', 'active')
    .lte('next_send_at', now.toISOString())

  if (fetchErr) {
    console.error('[sequences/execute POST]', fetchErr)
    return NextResponse.json({ error: fetchErr?.message || 'Failed to execute sequences' }, { status: 500 })
  }
  if (!enrollments?.length) return NextResponse.json({ processed: 0, sent: 0, completed: 0 })

  // Fetch all relevant sequences in one query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seqIds = [...new Set(enrollments.map((e: any) => e.sequence_id as string))]
  const { data: sequences } = await db
    .from('sequences')
    .select('id, name, status, steps, active_count, completed_count')
    .in('id', seqIds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seqMap = new Map((sequences ?? []).map((s: any) => [s.id as string, s]))

  let sent = 0
  let completed = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const enrollment of enrollments as any[]) {
    const seq = seqMap.get(enrollment.sequence_id)
    // Only process active sequences
    if (!seq || seq.status !== 'Active') continue

    const steps: { id: string; type: string; day: number; subject?: string; body?: string }[] = seq.steps ?? []
    const step = steps[enrollment.current_step]
    if (!step) continue

    const update: Record<string, unknown> = {}

    if (step.type === 'email') {
      const { error: emailErr } = await resend.emails.send({
        from: 'Graviss Marketing <noreply@app.gravissmarketing.com>',
        replyTo: 'info@gravissmarketing.com',
        to: [enrollment.contact_email],
        subject: step.subject ?? `Message from ${seq.name}`,
        html: sequenceEmailHtml({
          body: step.body ?? '',
          contactName: enrollment.contact_name,
          sequenceName: seq.name,
        }),
      })
      if (!emailErr) {
        sent++
        update.last_sent_at = now.toISOString()
      }
    }
    // wait/task/condition steps: no email — just advance

    // Advance to next step
    const nextStepIndex = enrollment.current_step + 1
    if (nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex]
      const daysDiff = Math.max(1, nextStep.day - step.day)
      const nextSendAt = new Date(now.getTime() + daysDiff * 24 * 60 * 60 * 1000)
      update.current_step = nextStepIndex
      update.next_send_at = nextSendAt.toISOString()
    } else {
      // All steps complete
      update.status = 'completed'
      completed++
      await db
        .from('sequences')
        .update({
          active_count: Math.max(0, (seq.active_count ?? 1) - 1),
          completed_count: (seq.completed_count ?? 0) + 1,
        })
        .eq('id', seq.id)
    }

    await db
      .from('sequence_enrollments')
      .update(update)
      .eq('id', enrollment.id)
  }

  return NextResponse.json({ processed: enrollments.length, sent, completed })
}

function sequenceEmailHtml({
  body,
  contactName,
  sequenceName,
}: {
  body: string
  contactName: string
  sequenceName: string
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#012b1e;padding:28px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.08em;font-family:Georgia,serif;">GRAVISS MARKETING</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">${sequenceName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi ${contactName || 'there'},</p>
            <div style="color:#374151;font-size:15px;line-height:1.7;">${body.replace(/\n/g, '<br>')}</div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} Graviss Marketing &nbsp;&middot;&nbsp;
              <a href="mailto:info@gravissmarketing.com" style="color:#015035;">info@gravissmarketing.com</a>
              &nbsp;&middot;&nbsp; To unsubscribe, reply with &ldquo;unsubscribe&rdquo;.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
