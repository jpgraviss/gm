-- Roadmap B1 — Stripe payment processing for client invoices.
--
-- app_settings.stripe holds the per-workspace secret key + webhook signing
-- secret, same "keyed integration, staff pastes it into Settings" pattern
-- as granola/mercury/hubspot on this same table.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS stripe jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Checkout Sessions are generated fresh per attempt (they expire, see
-- lib/stripe.ts), so only the latest attempt's ids are tracked — enough
-- for the webhook handler to correlate an incoming event back to this
-- invoice and to make the paid-status update idempotent under Stripe's
-- at-least-once webhook delivery retries.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_checkout_session_id
  ON public.invoices(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
