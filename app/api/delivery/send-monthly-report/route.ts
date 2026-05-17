import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { sendEmail } from '@/lib/email'
import { generateMonthlyReportHtml, type MonthlyReportData } from '@/lib/templates/generate-monthly-report'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = validate(body, {
    workflowId: { required: true, type: 'string', maxLength: 100 },
    reportDate: { type: 'string', maxLength: 10 },
  })
  if (!result.valid) return validationError(result.error)

  const { workflowId, reportDate } = body as { workflowId: string; reportDate?: string }
  void reportDate

  const db = createServiceClient()

  const { data: workflow, error: wfErr } = await db
    .from('delivery_workflows')
    .select('*')
    .eq('id', workflowId)
    .single()

  if (wfErr) {
    const status = wfErr.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: wfErr.message }, { status })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const reportRes = await fetch(`${baseUrl}/api/delivery/monthly-report/${workflowId}`, {
    headers: { 'Content-Type': 'application/json' },
  })

  if (!reportRes.ok) {
    const errBody = await reportRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: (errBody as Record<string, string>).error ?? 'Failed to aggregate report data' },
      { status: reportRes.status },
    )
  }

  const reportData = (await reportRes.json()) as MonthlyReportData
  const html = generateMonthlyReportHtml(reportData)

  const companyId = workflow.company_id as string | null
  let recipientEmail: string | null = null

  if (companyId) {
    const { data: contacts } = await db
      .from('crm_contacts')
      .select('emails')
      .eq('company_id', companyId)
      .eq('is_primary', true)
      .limit(1)

    if (contacts && contacts.length > 0) {
      const emails = (contacts[0] as { emails: string[] }).emails
      if (emails && emails.length > 0) recipientEmail = emails[0]
    }
  }

  let emailResult: { success: boolean; id?: string; error?: string } | null = null
  if (recipientEmail) {
    emailResult = await sendEmail({
      to: recipientEmail,
      subject: `Monthly Report - ${reportData.period.label}`,
      html,
    })
  }

  const now = new Date().toISOString()
  const { data: updated, error: updateErr } = await db
    .from('delivery_workflows')
    .update({
      step_08_monthly_report: 'Completed',
      step_08_last_sent_at: now,
      updated_at: now,
    })
    .eq('id', workflowId)
    .select()
    .single()

  if (updateErr) {
    console.error('[delivery/send-monthly-report POST]', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  await db.from('delivery_events').insert({
    id: crypto.randomUUID(),
    workflow_id: workflowId,
    company_id: workflow.company_id,
    step: 8,
    event_type: 'monthly_report_sent',
    description: `Monthly report for ${reportData.period.label} ${recipientEmail ? 'sent to ' + recipientEmail : 'generated (no recipient found)'}`,
    metadata: {
      period: reportData.period,
      recipientEmail,
      emailSent: !!emailResult?.success,
      emailId: emailResult?.id ?? null,
    },
  })

  return NextResponse.json({
    html,
    workflow: updated,
    email: emailResult,
    recipientEmail,
  })
}
