import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { sendEmail } from '@/lib/email'
import { generateWelcomeEmail } from '@/lib/templates/generate-welcome'
import { generateUsageGuideEmail } from '@/lib/templates/generate-usage-guide'
import { generateMonthlyReportHtml } from '@/lib/templates/generate-monthly-report'

const TEMPLATE_TYPES = ['welcome', 'usage_guide', 'monthly_report']
const SUBJECT_MAP: Record<string, string> = {
  welcome: 'Welcome to Graviss Marketing',
  usage_guide: 'Your Portal Usage Guide',
  monthly_report: 'Your Monthly Report',
}

function generateHtml(templateType: string, customizationData: Record<string, unknown>): string {
  switch (templateType) {
    case 'welcome':
      return generateWelcomeEmail({
        clientName: String(customizationData.clientName ?? ''),
        companyName: String(customizationData.companyName ?? 'Graviss Marketing'),
        projectName: String(customizationData.projectName ?? ''),
        portalUrl: String(customizationData.portalUrl ?? 'https://app.gravissmarketing.com'),
        teamMembers: (customizationData.teamMembers as Array<{ name: string; role: string; email: string }>) ?? [],
        serviceType: String(customizationData.serviceType ?? 'Website'),
      })
    case 'usage_guide':
      return generateUsageGuideEmail({
        clientName: String(customizationData.clientName ?? ''),
        serviceType: String(customizationData.serviceType ?? 'Website'),
        guideUrl: String(customizationData.guideUrl ?? 'https://app.gravissmarketing.com/guide'),
        helpCenterUrl: String(customizationData.helpCenterUrl ?? 'https://app.gravissmarketing.com/help'),
      })
    case 'monthly_report':
      return generateMonthlyReportHtml({
        clientName: String(customizationData.clientName ?? ''),
        companyName: String(customizationData.companyName ?? 'Graviss Marketing'),
        period: (customizationData.period as { start: string; end: string; label: string }) ?? { start: '', end: '', label: '' },
        metrics: (customizationData.metrics as Record<string, unknown>) ?? {},
        recommendations: (customizationData.recommendations as string[]) ?? [],
        changelog: (customizationData.changelog as string[]) ?? [],
      })
    default:
      throw new Error(`Unknown template type: ${templateType}`)
  }
}

const STEP_FOR_TEMPLATE: Record<string, number> = {
  welcome: 3,
  usage_guide: 6,
  monthly_report: 8,
}

const STEP_STATUS_COLUMN: Record<number, string> = {
  3: 'step_03_welcome',
  6: 'step_06_usage_guide',
  8: 'step_08_monthly_report',
}

const STEP_SENT_COLUMN: Record<number, string> = {
  3: 'step_03_email_sent_at',
  6: 'step_06_email_sent_at',
  8: 'step_08_last_sent_at',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = validate(body, {
    workflowId: { required: true, type: 'string', maxLength: 100 },
    step: { required: true, type: 'number', min: 1, max: 8 },
    templateType: { required: true, type: 'string', enum: TEMPLATE_TYPES },
    recipientEmail: { required: true, type: 'string', maxLength: 320 },
    customizationData: { type: 'object' },
    sendEmail: { type: 'boolean' },
  })
  if (!result.valid) return validationError(result.error)

  const {
    workflowId,
    step,
    templateType,
    recipientEmail,
    customizationData = {},
    sendEmail: shouldSend = false,
  } = body as {
    workflowId: string
    step: number
    templateType: string
    recipientEmail: string
    customizationData: Record<string, unknown>
    sendEmail: boolean
  }

  let html: string
  try {
    html = generateHtml(templateType, customizationData)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Template generation failed' }, { status: 400 })
  }

  const db = createServiceClient()
  const now = new Date().toISOString()

  let emailResult: { success: boolean; id?: string; error?: string } | null = null
  if (shouldSend) {
    emailResult = await sendEmail({
      to: recipientEmail,
      subject: SUBJECT_MAP[templateType] ?? 'Graviss Marketing',
      html,
    })
  }

  const mappedStep = STEP_FOR_TEMPLATE[templateType] ?? step
  const statusCol = STEP_STATUS_COLUMN[mappedStep]
  const sentCol = STEP_SENT_COLUMN[mappedStep]

  const update: Record<string, unknown> = { updated_at: now }
  if (statusCol) update[statusCol] = shouldSend ? 'Completed' : 'In Progress'
  if (sentCol && shouldSend) update[sentCol] = now

  const { data: workflow, error: updateErr } = await db
    .from('delivery_workflows')
    .update(update)
    .eq('id', workflowId)
    .select()
    .single()

  if (updateErr) {
    console.error('[delivery/send-template POST]', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  await db.from('delivery_events').insert({
    id: crypto.randomUUID(),
    workflow_id: workflowId,
    company_id: workflow.company_id,
    step: mappedStep,
    event_type: 'template_sent',
    description: `${templateType} template ${shouldSend ? 'sent to ' + recipientEmail : 'generated'}`,
    metadata: {
      templateType,
      recipientEmail,
      emailSent: shouldSend,
      emailId: emailResult?.id ?? null,
    },
  })

  return NextResponse.json({
    html,
    workflow,
    email: emailResult,
  })
}
