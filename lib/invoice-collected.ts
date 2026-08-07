/**
 * How much money an invoice actually brought in.
 *
 * AUDIT #776. `invoices.amount_paid` is `numeric not null default 0`, and the
 * Stripe webhook is the only thing that ever writes it. Marking an invoice
 * Paid by hand — which is how a cheque, ACH transfer or cash payment is
 * recorded, and for most agencies that is the majority of invoices — leaves
 * the column at its default `0`.
 *
 * Four call sites then read it as `amount_paid ?? amount`. Because `0` is not
 * nullish, `??` does not fall back: every hand-marked Paid invoice counted as
 * zero dollars collected. "Revenue Collected" read $0 with paid invoices
 * plainly listed on the same screen, and the Activity timeline recorded
 * "Invoice paid — $0.00".
 *
 * The intent behind preferring `amount_paid` was right and is preserved: it
 * records what Stripe actually charged, which can differ from the invoice
 * face value if the invoice was edited after payment (#358/#587). It just
 * needs a predicate that distinguishes "a payment was recorded" from "the
 * column is at its default", and `> 0` is that predicate — a zero-dollar
 * charge is not a payment in any case worth counting.
 *
 * This lives in one place because the previous arrangement was the shape that
 * has produced most of this audit's findings: the same rule written out
 * separately in several files, free to drift.
 */

/** Anything with the two amount fields, in either the DB or the API casing. */
type InvoiceAmounts = {
  amount?: number | string | null
  amountPaid?: number | string | null
  amount_paid?: number | string | null
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * The amount to count as collected for an invoice.
 *
 * Callers are responsible for filtering to Paid invoices — this answers "how
 * much", not "was it paid".
 */
export function collectedAmount(invoice: InvoiceAmounts): number {
  const recorded = num(invoice.amountPaid ?? invoice.amount_paid)
  return recorded > 0 ? recorded : num(invoice.amount)
}
