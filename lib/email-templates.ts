import { createServiceClient } from '@/lib/supabase'

export interface TemplateBlock {
  id: string
  type: 'logo' | 'text' | 'button' | 'divider' | 'footer'
  content: Record<string, unknown>
}

export interface SystemEmailTemplate {
  name: string
  subject: string
  blocks: TemplateBlock[]
  lastEdited?: string
}

export type SystemTemplateName =
  | 'task_assigned'
  | 'task_due_today'
  | 'deal_stage_changed'
  | 'contract_signed'
  | 'invoice_overdue'
  | 'proposal_accepted'
  | 'proposal_declined'
  | 'new_ticket'
  | 'ticket_updated'
  | 'welcome_email'

export const TEMPLATE_LABELS: Record<SystemTemplateName, string> = {
  task_assigned: 'Task Assigned',
  task_due_today: 'Task Due Today',
  deal_stage_changed: 'Deal Stage Changed',
  contract_signed: 'Contract Signed',
  invoice_overdue: 'Invoice Overdue',
  proposal_accepted: 'Proposal Accepted',
  proposal_declined: 'Proposal Declined',
  new_ticket: 'New Ticket',
  ticket_updated: 'Ticket Updated',
  welcome_email: 'Welcome Email',
}

export const MERGE_FIELDS = [
  '{recipient_name}',
  '{company_name}',
  '{action_url}',
  '{details}',
  '{date}',
] as const

export const SAMPLE_DATA: Record<string, string> = {
  '{recipient_name}': 'Jane Smith',
  '{company_name}': 'Graviss Marketing',
  '{action_url}': 'https://app.gravissmarketing.com',
  '{details}': 'Your task "Q4 Campaign Review" has been assigned to you.',
  '{date}': 'May 16, 2026',
}

function uid(): string {
  return `tb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function defaultBlocks(name: SystemTemplateName): TemplateBlock[] {
  const subjects: Record<SystemTemplateName, string> = {
    task_assigned: 'A task has been assigned to you',
    task_due_today: 'Reminder: Task due today',
    deal_stage_changed: 'Deal stage updated',
    contract_signed: 'Contract has been signed',
    invoice_overdue: 'Invoice is overdue',
    proposal_accepted: 'Proposal has been accepted',
    proposal_declined: 'Proposal was declined',
    new_ticket: 'New support ticket created',
    ticket_updated: 'Support ticket updated',
    welcome_email: 'Welcome to {company_name}',
  }

  const body: Record<SystemTemplateName, string> = {
    task_assigned: '<p>Hi {recipient_name},</p><p>{details}</p><p>Please review and take action at your earliest convenience.</p>',
    task_due_today: '<p>Hi {recipient_name},</p><p>This is a reminder that your task is due today.</p><p>{details}</p>',
    deal_stage_changed: '<p>Hi {recipient_name},</p><p>A deal has been moved to a new stage.</p><p>{details}</p>',
    contract_signed: '<p>Hi {recipient_name},</p><p>Great news! A contract has been signed.</p><p>{details}</p>',
    invoice_overdue: '<p>Hi {recipient_name},</p><p>This is a reminder that an invoice is past due.</p><p>{details}</p>',
    proposal_accepted: '<p>Hi {recipient_name},</p><p>A proposal has been accepted!</p><p>{details}</p>',
    proposal_declined: '<p>Hi {recipient_name},</p><p>Unfortunately, a proposal was declined.</p><p>{details}</p>',
    new_ticket: '<p>Hi {recipient_name},</p><p>A new support ticket has been created.</p><p>{details}</p>',
    ticket_updated: '<p>Hi {recipient_name},</p><p>A support ticket has been updated.</p><p>{details}</p>',
    welcome_email: '<p>Hi {recipient_name},</p><p>Welcome to {company_name}! We are excited to have you on board.</p><p>If you have any questions, feel free to reach out.</p>',
  }

  void subjects

  return [
    { id: uid(), type: 'logo', content: {} },
    { id: uid(), type: 'text', content: { html: body[name] } },
    { id: uid(), type: 'button', content: { text: 'View Details', url: '{action_url}', bgColor: '#015035', textColor: '#ffffff' } },
    { id: uid(), type: 'divider', content: {} },
    { id: uid(), type: 'footer', content: { text: 'Sent by {company_name}' } },
  ]
}

export function getDefaultTemplate(name: SystemTemplateName): SystemEmailTemplate {
  const subjectMap: Record<SystemTemplateName, string> = {
    task_assigned: 'A task has been assigned to you',
    task_due_today: 'Reminder: Task due today',
    deal_stage_changed: 'Deal stage updated',
    contract_signed: 'Contract has been signed',
    invoice_overdue: 'Invoice is overdue',
    proposal_accepted: 'Proposal has been accepted',
    proposal_declined: 'Proposal was declined',
    new_ticket: 'New support ticket created',
    ticket_updated: 'Support ticket updated',
    welcome_email: 'Welcome to {company_name}',
  }

  return {
    name: TEMPLATE_LABELS[name],
    subject: subjectMap[name],
    blocks: defaultBlocks(name),
  }
}

function renderBlockToHtml(block: TemplateBlock): string {
  switch (block.type) {
    case 'logo':
      return '<div style="padding:24px;text-align:center;"><img src="/logo.png" alt="Logo" style="height:40px;" /></div>'
    case 'text':
      return `<div style="padding:0 24px;font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#374151;">${String(block.content.html ?? '')}</div>`
    case 'button': {
      const text = String(block.content.text ?? 'Click Here')
      const url = String(block.content.url ?? '#')
      const bg = String(block.content.bgColor ?? '#015035')
      const tc = String(block.content.textColor ?? '#ffffff')
      return `<div style="padding:16px 24px;text-align:center;"><a href="${url}" target="_blank" style="display:inline-block;background:${bg};color:${tc};font-size:16px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;">${text}</a></div>`
    }
    case 'divider':
      return '<div style="padding:16px 24px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></div>'
    case 'footer':
      return `<div style="padding:16px 24px;text-align:center;font-size:12px;color:#9ca3af;font-family:system-ui,-apple-system,sans-serif;">${String(block.content.text ?? '')}<br/><a href="{action_url}/unsubscribe" style="color:#9ca3af;">Unsubscribe</a></div>`
    default:
      return ''
  }
}

function replaceMergeFields(html: string, variables: Record<string, string>): string {
  let result = html
  for (const [key, value] of Object.entries(variables)) {
    const escaped = key.replace(/[{}]/g, '\\$&')
    result = result.replace(new RegExp(escaped, 'g'), value)
  }
  return result
}

export function renderTemplateHtml(template: SystemEmailTemplate): string {
  const body = template.blocks.map(renderBlockToHtml).join('\n')
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td>${body}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export async function renderTemplate(
  templateName: SystemTemplateName,
  variables: Record<string, string>,
): Promise<string> {
  let template: SystemEmailTemplate

  try {
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('email_templates')
      .eq('id', 'global')
      .maybeSingle()

    const stored = (data?.email_templates as Record<string, SystemEmailTemplate> | null)?.[templateName]
    template = stored ?? getDefaultTemplate(templateName)
  } catch {
    template = getDefaultTemplate(templateName)
  }

  const html = renderTemplateHtml(template)
  return replaceMergeFields(html, variables)
}

export function renderPreview(template: SystemEmailTemplate): string {
  const html = renderTemplateHtml(template)
  return replaceMergeFields(html, SAMPLE_DATA)
}

export function newTemplateBlock(type: TemplateBlock['type']): TemplateBlock {
  const defaults: Record<TemplateBlock['type'], Record<string, unknown>> = {
    logo: {},
    text: { html: '<p>Enter your text here...</p>' },
    button: { text: 'Click Here', url: '', bgColor: '#015035', textColor: '#ffffff' },
    divider: {},
    footer: { text: 'Sent by {company_name}' },
  }
  return { id: uid(), type, content: defaults[type] }
}
