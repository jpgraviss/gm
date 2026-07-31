// Shared by app/knowledge-base/page.tsx and app/client/help/page.tsx — was
// previously duplicated verbatim in both files.
//
// AUDIT #585 — the image/link substitutions interpolated a captured URL
// straight into a double-quoted src="..."/href="..." HTML attribute with no
// escaping of `"` and no scheme allowlist. A URL containing a literal `"`
// broke out of the attribute and injected arbitrary attributes (e.g.
// onerror=); `javascript:` URLs executed on click. Reachable by any Team
// Member authoring a KB article, and — since the portal merge — rendered
// directly to real external portal clients via app/client/help/page.tsx.
// Matches the scheme-allowlist convention already used for the same bug
// class on public funnel pages (#341's isSafeUrl in PublicFunnelPage.tsx).
const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const MEDIA_PROTOCOLS = new Set(['http:', 'https:'])

function isSafeUrl(url: string, allowed: Set<string>): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return true
  try {
    return allowed.has(new URL(trimmed).protocol)
  } catch {
    // Not a valid absolute URL (e.g. a bare relative path like "pricing")
    return true
  }
}

// Escapes `"` (and, defensively, `<`/`>`) so a validated URL can never break
// out of the double-quoted attribute it's interpolated into, regardless of
// what the scheme allowlist above does or doesn't catch.
function escapeAttr(url: string): string {
  return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) =>
    `<pre class="bg-gray-900 text-gray-100 text-[13px] rounded-lg p-4 my-3 overflow-x-auto font-mono"><code>${code.trim()}</code></pre>`)
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 mt-4 mb-1">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 mt-5 mb-2">$1</h2>')
  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-[13px] px-1.5 py-0.5 rounded font-mono text-gray-800">$1</code>')
  // Images ![alt](url) — rejected/unsafe URLs render with no src at all
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) =>
    isSafeUrl(url, MEDIA_PROTOCOLS)
      ? `<img src="${escapeAttr(url)}" alt="${alt}" class="rounded-lg max-w-full my-3" />`
      : '')
  // Links [text](url) — rejected/unsafe URLs render as plain text instead of a link
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) =>
    isSafeUrl(url, LINK_PROTOCOLS)
      ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" class="text-emerald-700 underline hover:text-emerald-900">${label}</a>`
      : label)
  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-emerald-300 pl-4 py-1 my-2 text-sm text-gray-600 italic">$1</blockquote>')
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700 text-sm leading-relaxed">$1</li>')
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700 text-sm leading-relaxed">$1</li>')
  html = html.replace(/(<li class="ml-4 list-disc.*<\/li>\n?)+/g, (match) => `<ul class="my-2 space-y-1">${match}</ul>`)
  html = html.replace(/(<li class="ml-4 list-decimal.*<\/li>\n?)+/g, (match) => `<ol class="my-2 space-y-1">${match}</ol>`)
  // Paragraphs
  html = html.replace(/\n{2,}/g, '</p><p class="text-sm text-gray-700 leading-relaxed mb-2">')
  html = `<p class="text-sm text-gray-700 leading-relaxed mb-2">${html}</p>`
  return html
}
