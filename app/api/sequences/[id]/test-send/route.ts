import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const POST = withErrorHandler('sequences/[id]/test-send POST', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email address required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: seq, error: seqErr } = await db
    .from('sequences')
    .select('id, name, steps, send_via, from_name, from_email')
    .eq('id', id)
    .single()

  if (seqErr || !seq) {
    return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
  }

  const steps = (typeof seq.steps === 'string' ? JSON.parse(seq.steps) : seq.steps) as Array<{
    type: string
    subject?: string
    body?: string
  }>

  const emailStep = steps.find(s => s.type === 'email')
  if (!emailStep) {
    return NextResponse.json({ error: 'No email step found in sequence' }, { status: 400 })
  }

  const fromName = seq.from_name || 'Graviss Marketing'
  const fromEmail = seq.from_email || 'noreply@gravissmarketing.com'

  // AUDIT #615 — sender merge tokens were never replaced here, unlike the
  // real send path (replaceMergeFields() in execute/route.ts), so a test
  // preview showed literal `{{sender_name}}`/`{{sender_email}}` syntax.
  const subject = `[TEST] ${(emailStep.subject || seq.name)
    .replace(/\{\{sender_name\}\}/gi, fromName)
    .replace(/\{\{sender_email\}\}/gi, fromEmail)}`
  let body = emailStep.body || ''

  body = body
    .replace(/\{\{first_name\}\}/gi, 'Test')
    .replace(/\{\{last_name\}\}/gi, 'User')
    .replace(/\{\{full_name\}\}/gi, 'Test User')
    .replace(/\{\{company\}\}/gi, 'Test Company')
    .replace(/\{\{email\}\}/gi, email)
    .replace(/\{\{sender_name\}\}/gi, fromName)
    .replace(/\{\{sender_email\}\}/gi, fromEmail)

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px;font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;background:#fff;">
  <div style="max-width:600px;margin:0 auto;">
    <div style="background:#015035;padding:20px 24px;border-radius:10px 10px 0 0;">
      <p style="margin:0;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.6;">TEST EMAIL</p>
      <p style="margin:4px 0 0;color:#fff;font-size:16px;font-weight:700;">${subject.replace('[TEST] ', '')}</p>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:24px;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi Test User,</p>
      <div style="color:#374151;font-size:15px;line-height:1.7;">${body.replace(/\n/g, '<br>')}</div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">This is a test email from the sequence &ldquo;${seq.name}&rdquo;. Merge fields have been replaced with placeholder values.</p>
      </div>
    </div>
  </div>
</body></html>`

  // AUDIT #615 — this used to instantiate `new Resend()` directly and
  // never check the returned {error}, unconditionally reporting success
  // even on a real send failure (bad from-domain, invalid address) —
  // defeating the one tool whose purpose is catching config problems
  // before a sequence goes live. Every other send path in this module goes
  // through sendEmail(), which correctly surfaces its result.
  const result = await sendEmail({
    to: email,
    from: `${fromName} <${fromEmail}>`,
    subject,
    html,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to send test email' }, { status: 502 })
  }

  return NextResponse.json({ success: true, subject })
})
