// Stripe payment processing for client invoices (roadmap B1). Follows the
// same inert-until-configured pattern as every other keyed integration in
// this codebase (see lib/granola.ts): credentials live in
// app_settings.stripe (not an env var — this is a per-workspace secret a
// staff member pastes into Settings, same UX as Granola/HubSpot), nothing
// is called until a secret key is saved, and testStripeConnection() gives
// an honest real/failed result instead of ever faking success.
//
// Deliberately scoped to "generate a payment link, mark the invoice paid
// when it's actually paid" — not card-on-file or auto-recharge, which
// need a persistent Stripe Customer + saved payment method and are closer
// to Phase C's subscription-billing territory than this item's real need
// (a client paying an existing invoice).

import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'
import { decrypt } from '@/lib/encryption'

const STRIPE_API_VERSION = '2026-06-24.dahlia' as const

export interface StripeSettings {
  secretKey?: string
  webhookSecret?: string
}

async function getStripeSettings(db: SupabaseClient): Promise<StripeSettings> {
  const { data } = await db
    .from('app_settings')
    .select('stripe')
    .eq('id', 'global')
    .maybeSingle()
  const settings = (data?.stripe as StripeSettings) ?? {}
  // secretKey/webhookSecret are encrypted at rest (app/api/settings/route.ts
  // PATCH); decrypt() safely no-ops on legacy rows saved before encryption
  // was added.
  return {
    ...settings,
    secretKey: settings.secretKey ? decrypt(settings.secretKey) : settings.secretKey,
    webhookSecret: settings.webhookSecret ? decrypt(settings.webhookSecret) : settings.webhookSecret,
  }
}

export async function isStripeConfigured(db?: SupabaseClient): Promise<boolean> {
  const settings = await getStripeSettings(db ?? createServiceClient())
  return !!settings.secretKey
}

export async function getStripeSecretKey(db?: SupabaseClient): Promise<string | null> {
  const settings = await getStripeSettings(db ?? createServiceClient())
  return settings.secretKey ?? null
}

export async function getStripeWebhookSecret(db?: SupabaseClient): Promise<string | null> {
  const settings = await getStripeSettings(db ?? createServiceClient())
  return settings.webhookSecret ?? null
}

function client(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
}

// Real, single round-trip call — used by both the Settings "Test
// Connection" button and to fail fast/loud if a key is ever revoked or
// malformed, matching testGranolaConnection()'s contract.
export async function testStripeConnection(secretKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await client(secretKey).balance.retrieve()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to reach Stripe' }
  }
}

export interface CreateInvoiceCheckoutParams {
  secretKey: string
  invoiceId: string
  amount: number
  companyName: string
  serviceType: string
  customerEmail?: string
  successUrl: string
  cancelUrl: string
}

// Creates a fresh, one-time Stripe Checkout Session for a single invoice.
// Checkout Sessions expire (24h default) and are meant to be single-use —
// a durable "payment link" stored on the invoice row would go stale, so
// this is generated on demand every time someone clicks Pay Now/Copy Link,
// not persisted as a long-lived URL.
export async function createInvoiceCheckoutSession(params: CreateInvoiceCheckoutParams): Promise<{ url: string; sessionId: string }> {
  const stripe = client(params.secretKey)
  const amountCents = Math.round(params.amount * 100)
  if (amountCents <= 0) {
    throw new Error('Invoice amount must be greater than $0 to generate a payment link')
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: amountCents,
        product_data: {
          name: `Invoice — ${params.companyName}`,
          description: params.serviceType,
        },
      },
      quantity: 1,
    }],
    customer_email: params.customerEmail || undefined,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    // The webhook is the source of truth for marking an invoice paid, not
    // the browser redirect (which a client could hit without actually
    // paying) — metadata is how that webhook finds its way back to the
    // right invoice row.
    metadata: { invoiceId: params.invoiceId },
  })

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL')
  }
  return { url: session.url, sessionId: session.id }
}

export function constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string, secretKey: string): Stripe.Event {
  return client(secretKey).webhooks.constructEvent(rawBody, signature, webhookSecret)
}
