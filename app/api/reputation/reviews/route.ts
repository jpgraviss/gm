import { NextRequest, NextResponse } from 'next/server'

type ReviewSource = 'Google' | 'Yelp' | 'Facebook'
type ReviewStatus = 'pending' | 'responded'

interface Review {
  id: string
  workspace_id: string
  source: ReviewSource
  reviewer_name: string
  rating: number
  text: string
  date: string
  response: string | null
  response_date: string | null
  status: ReviewStatus
}

const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev-001',
    workspace_id: 'ws-1',
    source: 'Google',
    reviewer_name: 'Sarah Mitchell',
    rating: 5,
    text: 'Graviss Marketing completely transformed our online presence. Our website traffic increased by 300% in just three months. The team is responsive, professional, and truly understands digital marketing.',
    date: '2026-05-14T10:30:00Z',
    response: 'Thank you so much, Sarah! It has been a pleasure working with your team and seeing those incredible results.',
    response_date: '2026-05-14T14:00:00Z',
    status: 'responded',
  },
  {
    id: 'rev-002',
    workspace_id: 'ws-1',
    source: 'Google',
    reviewer_name: 'James Rodriguez',
    rating: 5,
    text: 'Best marketing agency we have ever worked with. They built us a stunning website and our Google Ads campaigns are finally profitable. Highly recommend!',
    date: '2026-05-12T08:15:00Z',
    response: null,
    response_date: null,
    status: 'pending',
  },
  {
    id: 'rev-003',
    workspace_id: 'ws-1',
    source: 'Yelp',
    reviewer_name: 'Patricia Wong',
    rating: 4,
    text: 'Great experience overall. The SEO work has been solid and we are seeing more leads each month. Only reason for 4 stars is that onboarding took a bit longer than expected.',
    date: '2026-05-10T16:45:00Z',
    response: 'Thanks for the feedback, Patricia! We have streamlined our onboarding process since then and appreciate your patience.',
    response_date: '2026-05-11T09:00:00Z',
    status: 'responded',
  },
  {
    id: 'rev-004',
    workspace_id: 'ws-1',
    source: 'Facebook',
    reviewer_name: 'Michael Chen',
    rating: 5,
    text: 'Our social media engagement has skyrocketed since partnering with Graviss. The content they create is top-notch and perfectly aligned with our brand voice.',
    date: '2026-05-08T12:00:00Z',
    response: null,
    response_date: null,
    status: 'pending',
  },
  {
    id: 'rev-005',
    workspace_id: 'ws-1',
    source: 'Google',
    reviewer_name: 'Linda Foster',
    rating: 3,
    text: 'Decent work on our website redesign. The design looks good but there were some bugs at launch that took a couple weeks to fix. Communication could be improved.',
    date: '2026-05-06T09:30:00Z',
    response: null,
    response_date: null,
    status: 'pending',
  },
  {
    id: 'rev-006',
    workspace_id: 'ws-1',
    source: 'Yelp',
    reviewer_name: 'Robert Kline',
    rating: 5,
    text: 'Five stars! They helped us rank #1 for our most important keywords. The ROI on their SEO services has been phenomenal. Truly a partner, not just a vendor.',
    date: '2026-05-04T14:20:00Z',
    response: 'We appreciate the kind words, Robert! Seeing your business grow has been incredibly rewarding for our team.',
    response_date: '2026-05-04T16:30:00Z',
    status: 'responded',
  },
  {
    id: 'rev-007',
    workspace_id: 'ws-1',
    source: 'Google',
    reviewer_name: 'Diana Patel',
    rating: 2,
    text: 'We hired them for PPC management and did not see the results we were promised. After 3 months the cost per lead was still too high. Ended up switching agencies.',
    date: '2026-05-02T11:00:00Z',
    response: null,
    response_date: null,
    status: 'pending',
  },
  {
    id: 'rev-008',
    workspace_id: 'ws-1',
    source: 'Facebook',
    reviewer_name: 'Kevin O\'Brien',
    rating: 4,
    text: 'Really happy with the branding work they did for us. The new logo and brand guidelines are fantastic. Would love to see more proactive suggestions for improvement.',
    date: '2026-04-28T15:45:00Z',
    response: 'Thanks Kevin! We will make sure to be more proactive with recommendations going forward.',
    response_date: '2026-04-29T10:00:00Z',
    status: 'responded',
  },
  {
    id: 'rev-009',
    workspace_id: 'ws-1',
    source: 'Google',
    reviewer_name: 'Amanda Torres',
    rating: 1,
    text: 'Very disappointed. The project was delivered late and the quality was not what we expected. Had to hire another agency to redo most of the work.',
    date: '2026-04-25T08:00:00Z',
    response: 'Amanda, we are sorry to hear about your experience. We would love the opportunity to discuss this further and make it right. Please reach out to our team directly.',
    response_date: '2026-04-25T12:00:00Z',
    status: 'responded',
  },
  {
    id: 'rev-010',
    workspace_id: 'ws-1',
    source: 'Yelp',
    reviewer_name: 'Thomas Nguyen',
    rating: 5,
    text: 'Incredible team! They not only redesigned our website but also set up our entire marketing automation pipeline. Our lead generation is now on autopilot.',
    date: '2026-04-20T13:30:00Z',
    response: null,
    response_date: null,
    status: 'pending',
  },
  {
    id: 'rev-011',
    workspace_id: 'ws-1',
    source: 'Google',
    reviewer_name: 'Emily Richardson',
    rating: 4,
    text: 'Solid agency with a good track record. They have been managing our Google Ads for 6 months and the results are consistently improving. Responsive to our requests.',
    date: '2026-04-15T10:00:00Z',
    response: 'Thank you Emily! We are glad the campaigns are delivering strong results.',
    response_date: '2026-04-15T15:00:00Z',
    status: 'responded',
  },
  {
    id: 'rev-012',
    workspace_id: 'ws-1',
    source: 'Facebook',
    reviewer_name: 'Carlos Mendez',
    rating: 3,
    text: 'The social media management is okay but nothing exceptional. Posts are published on time but they lack creativity. I expected more for the price.',
    date: '2026-04-10T09:15:00Z',
    response: null,
    response_date: null,
    status: 'pending',
  },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const source = searchParams.get('source') as ReviewSource | null
  const rating = searchParams.get('rating')
  const status = searchParams.get('status') as ReviewStatus | null

  let filtered = [...MOCK_REVIEWS]

  if (source) {
    filtered = filtered.filter((r) => r.source === source)
  }
  if (rating) {
    const ratingNum = parseInt(rating, 10)
    filtered = filtered.filter((r) => r.rating === ratingNum)
  }
  if (status) {
    filtered = filtered.filter((r) => r.status === status)
  }

  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { reviewId, response } = body as { reviewId: string; response: string }

  if (!reviewId || !response) {
    return NextResponse.json({ error: 'reviewId and response are required' }, { status: 400 })
  }

  const review = MOCK_REVIEWS.find((r) => r.id === reviewId)
  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  review.response = response
  review.response_date = new Date().toISOString()
  review.status = 'responded'

  return NextResponse.json(review)
}
