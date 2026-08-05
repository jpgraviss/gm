import { createServiceClient } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { wrapBrandedEmail } from '@/lib/email-template'
import { getSettings } from '@/lib/settings'
import { getStripeSecretKey, createInvoiceCheckoutSession } from '@/lib/stripe'
import { logActivity } from '@/lib/activity-log'
import { formatUsd } from '@/lib/format-currency'
import { normalizeCompanyName } from '@/lib/company-match'

/**
 * Emails an invoice to the client, with a Stripe payment link when Stripe is
 * connected, and transitions it Pending → Sent.
 *
 * The gap this closes: **nothing in the app could send an invoice.** The
 * `Sent` status existed, the billing dashboard showed an "Invoices Sent" KPI,
 * the cron's overdue sweep transitioned `Sent → Overdue`, and the automations
 * engine had an `Invoice Overdue` trigger — an entire accounts-receivable
 * pipeline whose first step had no implementation. `Sent` could only be
 * reached by a staff member manually editing the status dropdown after
 * emailing the invoice from somewhere else entirely.
 *
 * That became load-bearing once `lib/recurring-billing.ts` started generating
 * retainer invoices automatically: those are created as `Pending`, and the
 * overdue sweep only looks at `Sent`, so an auto-generated invoice would sit
 * forever — never delivered to the client, never aged, never chased.
 *
 * Ordering is deliberate: send the email FIRST, then claim the status. If the
 * email fails, the invoice stays Pending and can be retried. The reverse
 * order would mark an invoice Sent that no client ever received.
 */

export interface SendInvoiceResult {
  ok: boolean
  /** Populated on failure — safe to show to staff. */
  error?: string
  recipient?: string
  /** Null when Stripe isn't connected; the email still goes out without it. */
  payLink?: string | null
  /** True when the email sent but the status claim didn't take. */
  statusUnchanged?: boolean
}

interface InvoiceRow {
  id: string
  company: string | null
  company_id: string | null
  amount: number | string | null
  status: string | null
  due_date: string | null
  service_type: string | null
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Human date, or the raw string if it isn't parseable. */
function formatDate(value: string | null): string {
  if (!value) return 'on receipt'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/**
 * The portal client to bill. Prefers the `company_id` FK and only falls back
 * to a normalized name for rows predating the backfill — same preference
 * order as lib/company-match, applied here against a live query.
 */
async function resolveRecipient(
  db: SupabaseClient,
  invoice: InvoiceRow,
): Promise<{ email: string; contact: string | null } | null> {
  // Filtered in the query, not in JS over every portal client — this repo
  // has a long history of silent 100/1000-row truncation, and "we scanned
  // the first N clients and yours wasn't there" is exactly the failure mode
  // that would look like a missing billing contact.
  const query = db.from('portal_clients').select('email, contact, company, company_id, access')
  const { data: rows } = invoice.company_id
    ? await query.eq('company_id', invoice.company_id)
    : await query.ilike('company', (invoice.company ?? '').trim())

  const candidates = ((rows ?? []) as Record<string, string | null>[])
    .filter(r => !!r.email)
    // A disabled portal account is still a real billing contact — `access`
    // controls who can log in, not who receives an invoice. The name branch
    // re-checks under normalization since `ilike` without wildcards is only
    // case-insensitive, not whitespace-tolerant.
    .filter(r => invoice.company_id
      ? true
      : normalizeCompanyName(r.company) === normalizeCompanyName(invoice.company))

  if (candidates.length === 0) return null
  // Prefer an active account when a company has several contacts.
  const preferred = candidates.find(c => c.access === 'Active') ?? candidates[0]
  return { email: preferred.email as string, contact: preferred.contact ?? null }
}

export async function sendInvoiceEmail(
  invoiceId: string,
  opts: { actorName?: string } = {},
  client?: SupabaseClient,
): Promise<SendInvoiceResult> {
  const db = client ?? createServiceClient()

  const { data: invoice } = await db
    .from('invoices')
    .select('id, company, company_id, amount, status, due_date, service_type')
    .eq('id', invoiceId)
    .maybeSingle()

  if (!invoice) return { ok: false, error: 'Invoice not found' }
  const inv = invoice as InvoiceRow

  if (inv.status === 'Paid') return { ok: false, error: 'This invoice is already paid' }
  if (inv.status === 'Cancelled') return { ok: false, error: 'This invoice has been cancelled' }

  const amount = Number(inv.amount) || 0
  if (amount <= 0) return { ok: false, error: 'This invoice has no amount to bill' }

  const recipient = await resolveRecipient(db, inv)
  if (!recipient) {
    // Named explicitly rather than failing vaguely — the fix is a specific,
    // findable action (link a portal contact to this company).
    return {
      ok: false,
      error: `No billing contact found for ${inv.company ?? 'this company'}. Add a portal client for them first.`,
    }
  }

  // ── Payment link (best effort) ─────────────────────────────────────────
  // Stripe Checkout Sessions expire, so this is generated fresh per send
  // rather than stored — same reasoning as the Pay Now route. If Stripe
  // isn't connected, or the call fails, the invoice still goes out; the
  // client just pays however they already do.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  let payLink: string | null = null
  try {
    const secretKey = await getStripeSecretKey(db)
    if (secretKey) {
      const session = await createInvoiceCheckoutSession({
        secretKey,
        invoiceId: inv.id,
        amount,
        companyName: inv.company ?? '',
        serviceType: inv.service_type ?? 'Services',
        customerEmail: recipient.email,
        successUrl: `${appUrl}/client?paid=1`,
        cancelUrl: `${appUrl}/client`,
      })
      payLink = session.url
    }
  } catch (err) {
    console.error('[invoice-send] Stripe link failed, sending without it:', err instanceof Error ? err.message : err)
  }

  // ── Email ──────────────────────────────────────────────────────────────
  const settings = await getSettings()
  const greeting = escapeHtml(recipient.contact || inv.company || 'there')
  const amountLabel = escapeHtml(formatUsd(amount))
  const dueLabel = escapeHtml(formatDate(inv.due_date))
  const serviceLabel = escapeHtml(inv.service_type ?? 'Services')
  const companyName = escapeHtml(settings.company.name)
  const primary = settings.branding.primaryColor

  const body = `
    <h2 style="margin:0 0 12px;color:#111827;font-size:18px;font-weight:700;">Hi ${greeting},</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.6;">
      Here's your latest invoice from ${companyName}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;">Amount due</p>
        <p style="margin:0 0 16px;font-size:28px;font-weight:700;color:#111827;">${amountLabel}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#4b5563;"><strong>Service:</strong> ${serviceLabel}</p>
        <p style="margin:0;font-size:14px;color:#4b5563;"><strong>Due:</strong> ${dueLabel}</p>
      </td></tr>
    </table>
    ${payLink
      ? `<p style="margin:0 0 16px;"><a href="${escapeHtml(payLink)}" style="display:inline-block;background:${primary};color:#ffffff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Pay Invoice &rarr;</a></p>
         <p style="margin:0;font-size:12px;color:#9ca3af;">This payment link expires in 24 hours — you can always pay from your portal instead.</p>`
      : `<p style="margin:0;"><a href="${appUrl}/client" style="display:inline-block;background:${primary};color:#ffffff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">View in Portal &rarr;</a></p>`}
  `

  const html = await wrapBrandedEmail(body, 'INVOICE')
  const result = await sendEmail({
    to: recipient.email,
    subject: `Invoice from ${settings.company.name} — ${formatUsd(amount)}`,
    html,
  })

  if (!result.success) {
    // Status untouched, so this is safely retryable.
    return { ok: false, error: result.error ?? 'Failed to send the invoice email', recipient: recipient.email }
  }

  // ── Status claim ───────────────────────────────────────────────────────
  // Only Pending advances. An Overdue invoice being re-sent as a reminder
  // must NOT be walked back to Sent — that would reset the cron's aging and
  // silently drop it out of the overdue KPI it belongs in.
  const { data: claimed } = await db
    .from('invoices')
    .update({ status: 'Sent' })
    .eq('id', inv.id)
    .eq('status', 'Pending')
    .select('id')
    .maybeSingle()

  logActivity({
    type: 'invoice',
    title: `Invoice sent — ${formatUsd(amount)}`,
    body: `${inv.service_type ?? 'Services'} · to ${recipient.email}${payLink ? ' · payment link included' : ''}`,
    companyId: inv.company_id,
    companyName: inv.company,
    userName: opts.actorName || 'System',
  }, db)

  return {
    ok: true,
    recipient: recipient.email,
    payLink,
    // Not an error: a re-send of an already-Sent or Overdue invoice lands
    // here by design. Surfaced so the caller can word its toast honestly.
    statusUnchanged: !claimed,
  }
}
