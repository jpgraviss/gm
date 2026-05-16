import { fireAutomations } from '@/lib/automations-engine'

type TriggerType =
  | 'contact_created'
  | 'deal_stage_changed'
  | 'invoice_overdue'
  | 'contract_signed'
  | 'form_submitted'
  | 'proposal_accepted'
  | 'proposal_declined'

export function fireTrigger(triggerType: TriggerType, data: Record<string, unknown>) {
  fireAutomations(triggerType, data)
}
