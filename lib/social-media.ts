/**
 * Social media post types + publishing helpers.
 *
 * Supports: Facebook Pages, Instagram Business, LinkedIn Company Pages,
 * Google Business Profile posts. Each platform has its own API — the
 * publishing functions are called per-platform when a post goes live.
 *
 * Platform API access requires approved developer apps:
 * - Facebook/Instagram: developers.facebook.com (Pages API + Instagram Graph API)
 * - LinkedIn: linkedin.com/developers (Marketing API)
 * - GBP: already connected via Google Marketing OAuth
 */

export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'google_business'

export type PostStatus = 'draft' | 'scheduled' | 'pending_approval' | 'approved' | 'rejected' | 'publishing' | 'published' | 'failed'

export interface SocialPost {
  id: string
  companyId?: string
  companyName: string
  content: string
  mediaUrls: string[]
  platforms: SocialPlatform[]
  scheduledAt?: string
  publishedAt?: string
  status: PostStatus
  approvalStatus: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
  approvedAt?: string
  rejectionReason?: string
  platformPostIds: Record<string, string>
  platformErrors: Record<string, string>
  hashtags: string[]
  linkUrl?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface BrandKit {
  id: string
  companyId?: string
  companyName: string
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  fonts: string[]
  toneOfVoice?: string
  hashtags: string[]
  notes?: string
}

export const PLATFORM_META: Record<SocialPlatform, { label: string; color: string; icon: string }> = {
  facebook:        { label: 'Facebook',          color: '#1877F2', icon: 'F' },
  instagram:       { label: 'Instagram',         color: '#E4405F', icon: 'IG' },
  linkedin:        { label: 'LinkedIn',          color: '#0A66C2', icon: 'in' },
  google_business: { label: 'Google Business',   color: '#4285F4', icon: 'G' },
}

export const ALL_PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'linkedin', 'google_business']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPost(row: any): SocialPost {
  return {
    id:              row.id,
    companyId:       row.company_id ?? undefined,
    companyName:     row.company_name,
    content:         row.content ?? '',
    mediaUrls:       row.media_urls ?? [],
    platforms:       row.platforms ?? [],
    scheduledAt:     row.scheduled_at ?? undefined,
    publishedAt:     row.published_at ?? undefined,
    status:          row.status,
    approvalStatus:  row.approval_status ?? 'pending',
    approvedBy:      row.approved_by ?? undefined,
    approvedAt:      row.approved_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    platformPostIds: row.platform_post_ids ?? {},
    platformErrors:  row.platform_errors ?? {},
    hashtags:        row.hashtags ?? [],
    linkUrl:         row.link_url ?? undefined,
    createdBy:       row.created_by ?? undefined,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
  }
}

/**
 * Append hashtags to content text, avoiding duplicates.
 */
export function appendHashtags(content: string, hashtags: string[]): string {
  if (hashtags.length === 0) return content
  const existing = new Set(
    (content.match(/#\w+/g) ?? []).map(h => h.toLowerCase()),
  )
  const newTags = hashtags
    .map(h => (h.startsWith('#') ? h : `#${h}`))
    .filter(h => !existing.has(h.toLowerCase()))
  if (newTags.length === 0) return content
  return `${content}\n\n${newTags.join(' ')}`
}

/**
 * Truncate content to a platform's character limit with ellipsis.
 */
export function truncateForPlatform(content: string, platform: SocialPlatform): string {
  const limits: Record<SocialPlatform, number> = {
    facebook: 63206,
    instagram: 2200,
    linkedin: 3000,
    google_business: 1500,
  }
  const max = limits[platform]
  if (content.length <= max) return content
  return content.slice(0, max - 3) + '...'
}
