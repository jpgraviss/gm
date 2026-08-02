import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { withErrorHandler } from '@/lib/api-handler'

// AUDIT #669 — public/gi.js's placeholder sits inside a single-quoted JS
// string literal (`var SITE_ID = '__GI_SITE_ID__';`). Escapes backslashes,
// single quotes, CR/LF, and the two JS line-terminator code points (U+2028,
// U+2029 — valid inside a string literal, not inside unescaped source
// text) using numeric code-point comparison so no literal instance of
// either character needs to appear in this file's own source.
function escapeJsSingleQuoted(input: string): string {
  let out = ''
  for (const ch of input) {
    const code = ch.codePointAt(0)
    if (ch === '\\') out += '\\\\'
    else if (ch === "'") out += "\\'"
    else if (ch === '\r') out += '\\r'
    else if (ch === '\n') out += '\\n'
    else if (code === 0x2028) out += '\\u2028'
    else if (code === 0x2029) out += '\\u2029'
    else out += ch
  }
  return out
}

export const GET = withErrorHandler('intelligence/script GET', async (req) => {
  // This route is public, unauthenticated, and CORS-open — an unescaped
  // `site` param previously let anyone break out of the string literal
  // above and inject arbitrary JavaScript served from this app's own
  // trusted domain (`?site=x';alert(document.cookie);var y='`).
  const siteId = escapeJsSingleQuoted(new URL(req.url).searchParams.get('site') ?? 'default')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  const endpoint = `${appUrl}/api/intelligence/track`

  let script: string
  try {
    script = readFileSync(join(process.cwd(), 'public', 'gi.js'), 'utf-8')
  } catch {
    return new NextResponse('Script not found', { status: 404 })
  }

  script = script.replace('__GI_ENDPOINT__', endpoint).replace('__GI_SITE_ID__', siteId)

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
