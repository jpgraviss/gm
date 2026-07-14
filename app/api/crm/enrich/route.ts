import { NextRequest, NextResponse } from 'next/server'
import dns from 'dns/promises'
import net from 'net'
import { withErrorHandler } from '@/lib/api-handler'
import { chatCompletion } from '@/lib/ai-client'
import { requireRole } from '@/lib/rbac'

const INDUSTRIES = [
  'OOH', 'Real Estate', 'Healthcare', 'Technology', 'Finance', 'Retail',
  'Education', 'Construction', 'Hospitality', 'Legal', 'Non-Profit', 'Other',
]

// This route fetches a caller-supplied URL server-side, so it's a classic
// SSRF vector — without this check, an authenticated caller could point it
// at http://169.254.169.254/ (cloud metadata), an internal service, or
// localhost and read back whatever "enrichment" data comes back.
function isPrivateOrLoopbackIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase()
    return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')
  }
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true
  const [a, b] = parts
  if (a === 127) return true // loopback
  if (a === 10) return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 169 && b === 254) return true // link-local / cloud metadata
  if (a === 0) return true
  return false
}

async function isSafeToFetch(url: URL): Promise<boolean> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    return addresses.every(a => !isPrivateOrLoopbackIp(a.address))
  } catch {
    return false
  }
}

export const POST = withErrorHandler('crm/enrich POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

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

  if (!(await isSafeToFetch(url))) {
    return NextResponse.json({ error: 'This URL cannot be enriched' }, { status: 400 })
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

  let aiAnalysis: {
    industry?: string
    companySize?: string
    keyServices?: string[]
    targetMarket?: string
    linkedInUrl?: string
  } = {}

  if (socialLinks.linkedin) {
    aiAnalysis.linkedInUrl = socialLinks.linkedin
  }

  const textContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000)

  try {
    const result = await chatCompletion({
      system: 'You are a business analyst. Analyze website content and return ONLY valid JSON, no markdown.',
      messages: [{
        role: 'user',
        content: `Analyze this website content and return JSON with:\n- "industry": one of ${JSON.stringify(INDUSTRIES)}\n- "companySize": one of "small", "medium", "enterprise"\n- "keyServices": array of up to 4 key services offered\n- "targetMarket": one sentence describing their target market\n\nWebsite URL: ${url.toString()}\nContent:\n${textContent}`,
      }],
      maxTokens: 400,
      fast: true,
    })

    if (result.source !== 'none' && result.text) {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        aiAnalysis = { ...aiAnalysis, ...parsed }
      }
    }
  } catch {
    // AI analysis failed, continue with basic enrichment
  }

  return NextResponse.json({
    name,
    description,
    industry: aiAnalysis.industry || industry,
    logoUrl,
    phone,
    email,
    address,
    socialLinks,
    ai: {
      companySize: aiAnalysis.companySize,
      keyServices: aiAnalysis.keyServices,
      targetMarket: aiAnalysis.targetMarket,
      linkedInUrl: aiAnalysis.linkedInUrl,
    },
  })
})

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
