import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rawUrl = body.url?.trim()
  if (!rawUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  let url: URL
  try {
    const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
    url = new URL(normalized)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  let html: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GravHubBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    clearTimeout(timeout)
    if (!res.ok) {
      return NextResponse.json({ error: `Site returned ${res.status}` }, { status: 502 })
    }
    html = await res.text()
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out'
      : 'Could not reach the website'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const name = extractMeta(html, 'og:title') || extractTitle(html) || undefined
  const description = extractMeta(html, 'og:description') || extractMetaName(html, 'description') || undefined
  const logoUrl = extractMeta(html, 'og:image') || extractFavicon(html, url) || undefined
  const industry = extractMetaName(html, 'category') || extractMetaName(html, 'industry') || undefined
  const phone = extractPhone(html) || undefined
  const email = extractEmail(html) || undefined
  const address = extractAddress(html) || undefined
  const socialLinks = extractSocialLinks(html)

  return NextResponse.json({
    name,
    description,
    industry,
    logoUrl,
    phone,
    email,
    address,
    socialLinks,
  })
}

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+property=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegex(property)}["']`, 'i')
  return re.exec(html)?.[1] || re2.exec(html)?.[1] || null
}

function extractMetaName(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+name=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegex(name)}["']`, 'i')
  return re.exec(html)?.[1] || re2.exec(html)?.[1] || null
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([^<]+)<\/title>/i.exec(html)
  return m ? m[1].trim() : null
}

function extractFavicon(html: string, base: URL): string | null {
  const m = /<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i.exec(html)
  if (!m) return `${base.origin}/favicon.ico`
  try {
    return new URL(m[1], base.origin).toString()
  } catch {
    return m[1]
  }
}

function extractPhone(html: string): string | null {
  const patterns = [
    /href=["']tel:([^"']+)["']/i,
    /(\+?1?\s*[-.(]?\d{3}[-.)]\s*\d{3}[-.\s]\d{4})/,
    /(\(\d{3}\)\s*\d{3}[-.\s]\d{4})/,
  ]
  for (const p of patterns) {
    const m = p.exec(html)
    if (m) return m[1].trim()
  }
  return null
}

function extractEmail(html: string): string | null {
  const hrefMatch = /href=["']mailto:((?:info|contact|hello|support|sales)@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})["']/i.exec(html)
  if (hrefMatch) return hrefMatch[1]
  const generalMatch = /((?:info|contact|hello|support|sales)@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/i.exec(html)
  return generalMatch?.[1] || null
}

function extractAddress(html: string): string | null {
  const schemaPatterns = [
    /"streetAddress"\s*:\s*"([^"]+)"/,
    /"addressLocality"\s*:\s*"([^"]+)"/,
  ]
  const parts: string[] = []
  for (const p of schemaPatterns) {
    const m = p.exec(html)
    if (m) parts.push(m[1])
  }
  const regionMatch = /"addressRegion"\s*:\s*"([^"]+)"/.exec(html)
  if (regionMatch) parts.push(regionMatch[1])
  const postalMatch = /"postalCode"\s*:\s*"([^"]+)"/.exec(html)
  if (postalMatch) parts.push(postalMatch[1])
  if (parts.length > 0) return parts.join(', ')

  const addressTag = /<address[^>]*>([\s\S]*?)<\/address>/i.exec(html)
  if (addressTag) {
    const text = addressTag[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (text.length > 5 && text.length < 300) return text
  }
  return null
}

function extractSocialLinks(html: string): Record<string, string> {
  const links: Record<string, string> = {}
  const patterns: [string, RegExp][] = [
    ['linkedin', /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s]+)["']/i],
    ['facebook', /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)["']/i],
    ['twitter', /href=["'](https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^"'\s]+)["']/i],
    ['instagram', /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s]+)["']/i],
  ]
  for (const [name, re] of patterns) {
    const m = re.exec(html)
    if (m) links[name] = m[1]
  }
  return links
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
