import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/lib/markdown-render'

// AUDIT #585 — image/link substitutions previously interpolated a captured
// URL straight into a double-quoted src/href attribute with no escaping of
// `"` and no scheme allowlist, letting a URL containing a literal `"` break
// out of the attribute and inject arbitrary attributes, or a `javascript:`
// URL execute on click.

describe('renderMarkdown (#585)', () => {
  it('escapes a double-quote in an image URL instead of letting it break out of the attribute', () => {
    const html = renderMarkdown('![x](https://example.com/a.png"onerror="1)')
    expect(html).not.toContain('onerror="1"')
    expect(html).toContain('&quot;onerror=&quot;1')
  })

  it('escapes a double-quote in a link URL instead of letting it break out of the attribute', () => {
    const html = renderMarkdown('[click me](https://example.com/"onclick="1)')
    expect(html).not.toContain('onclick="1"')
    expect(html).toContain('&quot;onclick=&quot;1')
  })

  it('drops a javascript: link URL, rendering plain text instead of a clickable link', () => {
    const html = renderMarkdown('[click me](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<a ')
    expect(html).toContain('click me')
  })

  it('drops a javascript: image URL entirely', () => {
    const html = renderMarkdown('![x](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<img')
  })

  it('still renders a normal https image/link correctly', () => {
    const html = renderMarkdown('![alt text](https://example.com/a.png) and [a link](https://example.com/page)')
    expect(html).toContain('<img src="https://example.com/a.png" alt="alt text"')
    expect(html).toContain('<a href="https://example.com/page"')
  })

  it('still renders a relative/anchor URL correctly', () => {
    const html = renderMarkdown('[internal](/settings) and [anchor](#section)')
    expect(html).toContain('<a href="/settings"')
    expect(html).toContain('<a href="#section"')
  })
})
