import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { fireAutomations } from '@/lib/automations-engine'
import { getStripeSecretKey, getStripeWebhookSecret, constructWebhookEvent } from '@/lib/stripe'

// POST /api/stripe/webhook — public (see proxy.ts PUBLIC_PREFIXES), no
// session auth. Self-authenticates via Stripe's own signature header
// instead, same pattern as the existing sequences/webhooks (Resend) route.
export const POST = withErrorHandler('stripe/webhook POST', async (req: NextRequest) => {
  const db = createServiceClient()
  const [secretKey, webhookSecret] = await Promise.all([
    getStripeSecretKey(db),
    getStripeWebhookSecret(db),
  ])
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 400 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // Signature verification needs the exact raw request bytes — must read
  // as text before any JSON parsing, which withErrorHandler doesn't do.
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(rawBody, signature, webhookSecret, secretKey)
  } catch (err) {
    console.error('[stripe/webhook] signature verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const invoiceId = session.metadata?.invoiceId
    if (invoiceId) {
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
      const amountPaid = (session.amount_total ?? 0) / 100
      const today = new Date().toISOString().split('T')[0]

      // Atomic claim — only proceed if this invoice isn't already marked
      // Paid, so Stripe's at-least-once webhook delivery (the same event
      // can arrive more than once) can't double-fire invoice_paid
      // automations or clobber a paid_date already set by this same event
      // on an earlier delivery attempt.
      const { data: claimed } = await db
        .from('invoices')
        .update({
          status: 'Paid',
          paid_date: today,
          amount_paid: amountPaid,
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq('id', invoiceId)
        .neq('status', 'Paid')
        .select()
        .maybeSingle()

      if (claimed) {
        fireAutomations('invoice_paid', { invoiceId, ...claimed })
      }
    } else {
      console.error('[stripe/webhook] checkout.session.completed with no invoiceId metadata:', session.id)
    }
  }

  return NextResponse.json({ received: true })
})
