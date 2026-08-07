/**
 * The one HTML escaper.
 *
 * AUDIT #766 — there were ten of these, copy-pasted into ten modules, in
 * three different strengths: five escaped `& < >` only, four added `"`, and
 * one (`lib/invoice-send.ts`) added `'` as well. That drift is not cosmetic.
 * `& < >` is enough for a text node but *not* for an attribute value:
 * `<a href="${escapeHtml(url)}">` with an unescaped `"` lets the value close
 * the attribute and add its own. `lib/uptime.ts` did exactly that with a
 * monitored site's URL, which is stored verbatim (the route validates with
 * `new URL()` but discards the result and saves the raw string).
 *
 * Having one implementation is the actual fix. The escaping-forgotten class
 * has recurred seven times (#77, #494, #563, #570, #585, #589, #602), and a
 * developer writing the eleventh email template is far more likely to import
 * a helper that exists than to reinvent one correctly.
 *
 * Escapes all five characters, which is safe in both contexts: in text,
 * `&quot;` and `&#39;` render as `"` and `'`, so nothing looks different.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
