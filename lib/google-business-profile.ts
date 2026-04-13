import { getValidMarketingToken } from '@/lib/google-marketing'

/**
 * Google Business Profile API wrapper.
 *
 * GBP is split across multiple API hosts:
 *   - mybusinessaccountmanagement.googleapis.com   (accounts)
 *   - mybusinessbusinessinformation.googleapis.com (locations)
 *   - mybusiness.googleapis.com v4                 (reviews — still v4)
 *
 * API docs:
 *   https://developers.google.com/my-business/reference/accountmanagement/rest
 *   https://developers.google.com/my-business/reference/businessinformation/rest
 *   https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews
 */

/**
 * Low-level fetch wrapper — takes a full URL (since GBP spans several hosts)
 * and attaches a valid access token for the `business_profile` product.
 */
export async function gbpFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const auth = await getValidMarketingToken('business_profile')
  if (!auth) throw new Error('Google Business Profile not connected')

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GBP ${url} failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<T>
}

interface GBPAccount {
  name: string            // "accounts/123"
  accountName?: string
  type?: string
  role?: string
}

interface GBPLocationRaw {
  name: string            // "locations/456"
  title?: string
  storefrontAddress?: {
    addressLines?: string[]
    locality?: string
    administrativeArea?: string
    postalCode?: string
    regionCode?: string
  }
  phoneNumbers?: {
    primaryPhone?: string
  }
  categories?: {
    primaryCategory?: { displayName?: string; name?: string }
  }
}

export interface GBPLocation {
  accountName:     string   // "accounts/123"
  locationName:    string   // "accounts/123/locations/456"
  title:           string
  address:         string
  phone:           string
  primaryCategory: string
}

function formatAddress(addr: GBPLocationRaw['storefrontAddress']): string {
  if (!addr) return ''
  const parts = [
    ...(addr.addressLines ?? []),
    addr.locality,
    addr.administrativeArea,
    addr.postalCode,
    addr.regionCode,
  ].filter(Boolean)
  return parts.join(', ')
}

/**
 * List all accounts the authorized user can access.
 */
async function listGBPAccounts(): Promise<GBPAccount[]> {
  const data = await gbpFetch<{ accounts?: GBPAccount[] }>(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
  )
  return data.accounts ?? []
}

/**
 * List all locations under a given account.
 * The Business Information API requires an explicit readMask.
 */
async function listGBPLocationsForAccount(accountName: string): Promise<GBPLocationRaw[]> {
  const readMask = [
    'name',
    'title',
    'storefrontAddress',
    'phoneNumbers',
    'categories',
  ].join(',')

  const url =
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations` +
    `?readMask=${encodeURIComponent(readMask)}&pageSize=100`

  const data = await gbpFetch<{ locations?: GBPLocationRaw[] }>(url)
  return data.locations ?? []
}

/**
 * List every location the authorized user manages, flattened across accounts.
 */
export async function listGBPLocations(): Promise<GBPLocation[]> {
  const accounts = await listGBPAccounts()

  const results: GBPLocation[] = []
  for (const account of accounts) {
    try {
      const locations = await listGBPLocationsForAccount(account.name)
      for (const loc of locations) {
        results.push({
          accountName:     account.name,
          locationName:    `${account.name}/${loc.name}`,
          title:           loc.title ?? '(untitled)',
          address:         formatAddress(loc.storefrontAddress),
          phone:           loc.phoneNumbers?.primaryPhone ?? '',
          primaryCategory: loc.categories?.primaryCategory?.displayName ?? '',
        })
      }
    } catch (err) {
      console.error(`[gbp] Failed to list locations for ${account.name}`, err)
    }
  }
  return results
}

export type GBPStarRating =
  | 'STAR_RATING_UNSPECIFIED'
  | 'ONE'
  | 'TWO'
  | 'THREE'
  | 'FOUR'
  | 'FIVE'

export interface GBPReviewReply {
  comment:    string
  updateTime: string
}

export interface GBPReview {
  reviewId:     string
  reviewer:     { displayName: string; profilePhotoUrl?: string }
  starRating:   GBPStarRating
  comment:      string
  createTime:   string
  updateTime:   string
  reviewReply?: GBPReviewReply
}

interface GBPReviewsResponse {
  reviews?: Array<{
    reviewId:    string
    reviewer?:   { displayName?: string; profilePhotoUrl?: string }
    starRating?: GBPStarRating
    comment?:    string
    createTime?: string
    updateTime?: string
    reviewReply?: { comment?: string; updateTime?: string }
  }>
  averageRating?:    number
  totalReviewCount?: number
  nextPageToken?:    string
}

const STAR_TO_NUMBER: Record<GBPStarRating, number> = {
  STAR_RATING_UNSPECIFIED: 0,
  ONE:   1,
  TWO:   2,
  THREE: 3,
  FOUR:  4,
  FIVE:  5,
}

/**
 * Fetch reviews for a location. `locationName` must be the fully-qualified
 * "accounts/{accountId}/locations/{locationId}" path.
 */
export async function getGBPReviews(
  locationName: string,
  limit = 50,
): Promise<{
  reviews:          GBPReview[]
  totalReviewCount: number
  averageRating:    number
}> {
  const url =
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews` +
    `?pageSize=${Math.min(limit, 50)}`

  const data = await gbpFetch<GBPReviewsResponse>(url)

  const reviews: GBPReview[] = (data.reviews ?? []).map((r) => ({
    reviewId:   r.reviewId,
    reviewer: {
      displayName:     r.reviewer?.displayName ?? 'Anonymous',
      profilePhotoUrl: r.reviewer?.profilePhotoUrl,
    },
    starRating: r.starRating ?? 'STAR_RATING_UNSPECIFIED',
    comment:    r.comment ?? '',
    createTime: r.createTime ?? '',
    updateTime: r.updateTime ?? '',
    reviewReply: r.reviewReply?.comment
      ? {
          comment:    r.reviewReply.comment,
          updateTime: r.reviewReply.updateTime ?? '',
        }
      : undefined,
  }))

  return {
    reviews,
    totalReviewCount: data.totalReviewCount ?? reviews.length,
    averageRating:    data.averageRating ?? 0,
  }
}

/**
 * Post (or overwrite) a reply to a specific review.
 */
export async function replyToGBPReview(
  locationName: string,
  reviewId: string,
  comment: string,
): Promise<GBPReviewReply> {
  const url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews/${reviewId}/reply`

  const data = await gbpFetch<{ comment?: string; updateTime?: string }>(url, {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  })

  return {
    comment:    data.comment ?? comment,
    updateTime: data.updateTime ?? new Date().toISOString(),
  }
}

/**
 * Summary metrics for a location over the last N days:
 * how many new reviews have come in, average rating, total count.
 */
export async function getGBPSummary(
  locationName: string,
  days = 28,
): Promise<{
  newReviews:       number
  averageRating:    number
  totalReviewCount: number
}> {
  const { reviews, totalReviewCount, averageRating } = await getGBPReviews(locationName, 50)

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const newReviews = reviews.filter((r) => {
    const t = Date.parse(r.createTime)
    return Number.isFinite(t) && t >= cutoff
  }).length

  // Prefer the API's aggregate average; fall back to computing locally.
  let avg = averageRating
  if (!avg && reviews.length > 0) {
    const total = reviews.reduce((sum, r) => sum + STAR_TO_NUMBER[r.starRating], 0)
    avg = total / reviews.length
  }

  return {
    newReviews,
    averageRating:    avg,
    totalReviewCount,
  }
}
