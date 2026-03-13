import { createServiceClient } from '@/lib/supabase'

export async function logAudit(params: {
  userName: string
  action: string
  module: string
  type?: 'info' | 'action' | 'success' | 'warning' | 'error'
  metadata?: Record<string, unknown>
}) {
  try {
    const db = createServiceClient()
    await db.from('audit_logs').insert({
      id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_name: params.userName,
      action: params.action,
      module: params.module,
      type: params.type ?? 'action',
      metadata: params.metadata ?? {},
    })
  } catch (err) {
    // Audit logging should never break the request
    console.error('[audit] Failed to write audit log:', err)
  }
}
