import { describe, it, expect } from 'vitest'
import { renderTemplate } from '@/lib/templates/template-helpers'

// AUDIT #621 — renderTemplate() used to substitute values with zero HTML
// escaping, letting an XSS payload in any variable (accountManager name,
// a recommendations/changelog entry via the free-form send-template API)
// reach a real outbound branded email unescaped.

describe('renderTemplate (#621)', () => {
  it('escapes HTML metacharacters in a substituted value', () => {
    const html = renderTemplate('<p>Hi {name}</p>', { name: '<img src=x onerror="alert(1)">' })
    expect(html).not.toContain('<img src=x onerror="alert(1)">')
    expect(html).toBe('<p>Hi &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>')
  })

  it('still substitutes a plain value normally', () => {
    const html = renderTemplate('Hello {name}, welcome to {company}', { name: 'Jane', company: 'Acme & Co' })
    expect(html).toBe('Hello Jane, welcome to Acme &amp; Co')
  })
})
