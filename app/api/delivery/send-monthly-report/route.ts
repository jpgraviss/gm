import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { sendEmail } from '@/lib/email'
import { scheduleEmail } from '@/lib/email-scheduler'
import { getSettings } from '@/lib/settings'
import { generateMonthlyReportHtml, type MonthlyReportData } from '@/lib/templates/generate-monthly-report'

export const POST = withErrorHandler('delivery/send-monthly-report POST', async (req) => {
  const body = await req.json()
  const result = validate(body, {
    workflowId: { required: true, type: 'string', maxLength: 100 },
    reportDate: { type: 'string', maxLength: 10 },
    scheduleAt: { type: 'string' },
    recurring: { type: 'string', enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly'] },
  })
  if (!result.valid) return validationError(result.error)

  const { workflowId, reportDate, scheduleAt, recurring } = body as {
    workflowId: string
    reportDate?: string
    scheduleAt?: string
    recurring?: string
  }
  void reportDate

  const db = createServiceClient()

  const { data: workflow, error: wfErr } = await db
    .from('delivery_workflows')
    .select('*')
    .eq('id', workflowId)
    .single()

  if (wfErr) {
    if (wfErr.code === 'PGRST116') {
      return NextResponse.json({ error: wfErr.message }, { status: 404 })
    }
    throw new Error(wfErr.message)
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
  const settings = await getSettings()
  const html = generateMonthlyReportHtml(reportData, settings)

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
  let scheduledResult: { id: string } | null = null

  if (recipientEmail && scheduleAt) {
    const scheduled = await scheduleEmail({
      to: recipientEmail,
      subject: `Monthly Report - ${reportData.period.label}`,
      html,
      sendAt: scheduleAt,
      type: 'report',
      recurring: (recurring as 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly') ?? 'none',
      metadata: { workflowId, period: reportData.period },
    })
    scheduledResult = { id: scheduled.id }
  } else if (recipientEmail) {
    emailResult = await sendEmail({
      to: recipientEmail,
      subject: `Monthly Report - ${reportData.period.label}`,
      html,
    })

    if (emailResult.success && recurring === 'monthly') {
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      await scheduleEmail({
        to: recipientEmail,
        subject: `Monthly Report - ${reportData.period.label}`,
        html,
        sendAt: nextMonth.toISOString(),
        type: 'report',
        recurring: 'monthly',
        metadata: { workflowId, period: reportData.period },
      })
    }
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
    throw new Error(updateErr.message)
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
    scheduled: scheduledResult,
    recipientEmail,
  })
})
