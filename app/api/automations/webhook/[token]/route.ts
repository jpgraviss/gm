import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { fireAutomations } from '@/lib/automations-engine'

// Public, unauthenticated by necessity — this is the URL a third-party
// system (Zapier, Stripe, an ad platform, a client's own tooling) POSTs to.
// Each "Webhook Received" automation gets its own random token instead of
// one shared endpoint, so this route both identifies WHICH automation a
// call is for and acts as the auth boundary (the token IS the secret).
export const POST = withErrorHandler('automations/webhook/[token] POST', async (req: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params
  if (!token) {
    return NextResponse.json({ error: 'Missing webhook token' }, { status: 400 })
  }

  const db = createServiceClient()

  // Filtered in application code rather than a jsonb `->>` query-string
  // filter — a single agency has at most a handful of webhook-triggered
  // automations, so this trades a little efficiency for not depending on
  // PostgREST jsonb-filter syntax this codebase has never exercised
  // elsewhere and that can't be verified against a live DB from here.
  const { data: automations } = await db
    .from('automations')
    .select('id, status, config')
    .eq('trigger', 'Webhook Received')

  const automation = (automations ?? []).find(
    (a) => (a.config as Record<string, unknown> | null)?.webhookToken === token,
  )

  if (!automation) {
    return NextResponse.json({ error: 'Unknown webhook' }, { status: 404 })
  }
  if (automation.status !== 'Active') {
    return NextResponse.json({ error: 'This automation is paused' }, { status: 409 })
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = await req.json()
  } catch {
    // Some webhook senders post an empty or non-JSON body — an automation
    // meant to fire purely on "did this call happen", with no payload
    // fields referenced by any action, is still a legitimate use case.
  }

  fireAutomations('webhook_received', {
    ...payload,
    webhookToken: token,
    // Public, unauthenticated endpoint — matches the marker already used
    // by every other public trigger (form-submit, funnel-submit) so
    // actions that shouldn't be forgeable by an arbitrary caller (e.g.
    // Rotate Contact Owner) refuse to run from it (AUDIT.md #46).
    _publicSource: true,
  })

  return NextResponse.json({ success: true })
})
