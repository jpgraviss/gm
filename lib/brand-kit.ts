// Looks up a company's Brand Kit (app/admin/brand-kits/page.tsx, backed by
// app/api/brand-kits/*) so AI content-generation prompts can match a
// client's established voice instead of writing in Graviss's generic
// default voice for every client.
import { createServiceClient } from '@/lib/supabase'

export interface BrandVoice {
  toneOfVoice?: string
  hashtags: string[]
  primaryColor?: string
  secondaryColor?: string
}

export async function getBrandVoice(companyName?: string | null): Promise<BrandVoice | null> {
  const trimmed = companyName?.trim()
  if (!trimmed) return null

  const db = createServiceClient()
  const { data } = await db
    .from('brand_kits')
    .select('tone_of_voice, hashtags, primary_color, secondary_color')
    .ilike('company_name', trimmed)
    .maybeSingle()

  if (!data) return null
  return {
    toneOfVoice: data.tone_of_voice ?? undefined,
    hashtags: data.hashtags ?? [],
    primaryColor: data.primary_color ?? undefined,
    secondaryColor: data.secondary_color ?? undefined,
  }
}

// Appended to an AI system prompt so a matched brand kit nudges tone and
// hashtag choices without overriding the house style rules that precede it.
export function brandVoicePromptAddendum(brand: BrandVoice | null): string {
  if (!brand) return ''
  const lines: string[] = []
  if (brand.toneOfVoice) {
    lines.push(`This client's brand voice/tone to match: ${brand.toneOfVoice}.`)
  }
  if (brand.hashtags.length) {
    lines.push(`This client's preferred hashtags (use where relevant, don't force them): ${brand.hashtags.map(h => `#${h}`).join(' ')}.`)
  }
  if (!lines.length) return ''
  return `\n\n${lines.join(' ')}`
}
