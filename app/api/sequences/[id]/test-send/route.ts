import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { Resend } from 'resend'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const subject = `[TEST] ${emailStep.subject || seq.name}`
  let body = emailStep.body || ''

  body = body
    .replace(/\{\{first_name\}\}/gi, 'Test')
    .replace(/\{\{last_name\}\}/gi, 'User')
    .replace(/\{\{full_name\}\}/gi, 'Test User')
    .replace(/\{\{company\}\}/gi, 'Test Company')
    .replace(/\{\{email\}\}/gi, email)

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

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromName = seq.from_name || 'Graviss Marketing'
    const fromEmail = seq.from_email || 'noreply@gravissmarketing.com'

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject,
      html,
    })

    return NextResponse.json({ success: true, subject })
  } catch {
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 })
  }
}
